import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EntitiesService } from "../entities/entities.service";
import { Aggregates, Derived, RatioValue } from "../ratios/engine";
import { Exercice, PeriodeSource, construireExercices } from "./agregation";
import { MESURES } from "./mesures";
import { Bloc, TABLEAU_PAR_DEFAUT, validerBlocs } from "./blocs";
import {
  ExerciceProjete,
  HYPOTHESES_PAR_DEFAUT,
  Hypotheses,
  assainirHypotheses,
  projeter,
} from "./previsionnel";

/**
 * Le module pluriannuel : plusieurs exercices côte à côte, et ce qui vient
 * après.
 *
 * Ce service ne calcule rien lui-même. Il va chercher les périodes, les confie
 * aux fonctions pures d'agrégation et de projection, et range le résultat.
 * C'est volontaire : tout ce qui peut produire un chiffre faux vit dans des
 * fichiers sans base de données, donc vérifiables par des tests qui tournent
 * en quelques millisecondes.
 */

export interface SerieExercice {
  annee: number;
  label: string;
  reel: boolean;
  complet: boolean;
  /** Valeurs par identifiant de mesure. `null` quand la mesure est indisponible. */
  valeurs: Record<string, number | null>;
  /** Montant à financer, pour un exercice projeté qui ne boucle pas. */
  besoinFinancement?: number;
}

@Injectable()
export class PluriannuelService {
  constructor(
    private prisma: PrismaService,
    private entities: EntitiesService
  ) {}

  /** Le catalogue est statique : il ne dépend ni de l'entité ni des données. */
  mesures() {
    return MESURES;
  }

  private async periodes(organizationId: string, entityId: string): Promise<PeriodeSource[]> {
    await this.entities.getOrThrow(organizationId, entityId);

    const periodes = await this.prisma.accountingPeriod.findMany({
      where: { entityId },
      orderBy: { startDate: "asc" },
      include: { ratioResult: true },
    });

    return periodes
      .filter((periode) => periode.ratioResult)
      .map((periode) => ({
        id: periode.id,
        label: periode.label,
        debut: periode.startDate,
        fin: periode.endDate,
        aggregates: periode.ratioResult!.aggregates as unknown as Aggregates,
      }));
  }

  /**
   * Les exercices réalisés d'une entité, toutes mesures servies.
   *
   * On renvoie les 53 mesures pour chaque exercice plutôt que celles des
   * blocs : l'écran laisse changer de mesure d'un clic, et un aller-retour
   * serveur à chaque changement rendrait la configuration pénible au point
   * qu'on ne la toucherait plus.
   */
  async series(organizationId: string, entityId: string): Promise<SerieExercice[]> {
    const exercices = construireExercices(await this.periodes(organizationId, entityId));
    return exercices.map((exercice) => this.enSerie(exercice, true));
  }

  private enSerie(
    exercice: Exercice | (ExerciceProjete & { complet?: boolean }),
    reel: boolean
  ): SerieExercice {
    const source = {
      aggregates: exercice.aggregates,
      derived: exercice.derived as Derived,
      ratios: exercice.ratios as RatioValue[],
    };

    const valeurs: Record<string, number | null> = {};
    for (const mesure of MESURES) {
      const [prefixe, cle] = mesure.id.split(".", 2);
      if (prefixe === "agregat") valeurs[mesure.id] = source.aggregates[cle as keyof Aggregates] ?? null;
      else if (prefixe === "derive") valeurs[mesure.id] = source.derived[cle as keyof Derived] ?? null;
      else valeurs[mesure.id] = source.ratios.find((r) => r.id === cle)?.value ?? null;
    }

    return {
      annee: exercice.annee,
      label: exercice.label,
      reel,
      complet: "complet" in exercice ? (exercice.complet ?? true) : true,
      valeurs,
      ...("besoinFinancement" in exercice
        ? { besoinFinancement: exercice.besoinFinancement }
        : {}),
    };
  }

  /** Le tableau de bord enregistré, ou celui proposé par défaut. */
  async tableau(
    organizationId: string,
    entityId: string
  ): Promise<{ blocs: Bloc[]; hypotheses: Hypotheses; enregistre: boolean }> {
    await this.entities.getOrThrow(organizationId, entityId);
    const enBase = await this.prisma.tableauDeBord.findUnique({ where: { entityId } });

    if (!enBase) {
      return { blocs: TABLEAU_PAR_DEFAUT, hypotheses: HYPOTHESES_PAR_DEFAUT, enregistre: false };
    }

    /*
     * Revalidé à la lecture, et non seulement à l'écriture. Une configuration
     * enregistrée il y a six mois peut désigner une mesure que le moteur ne
     * produit plus, ou enfreindre une règle ajoutée depuis. La refuser serait
     * absurde — l'utilisateur n'y peut rien — mais l'afficher telle quelle
     * dessinerait un graphique faux. On retombe donc sur le tableau par
     * défaut, qui est au moins juste.
     */
    const verdict = validerBlocs(enBase.blocs);
    return {
      blocs: verdict.valide ? verdict.blocs : TABLEAU_PAR_DEFAUT,
      hypotheses: assainirHypotheses((enBase.hypotheses ?? {}) as Partial<Hypotheses>),
      enregistre: true,
    };
  }

  async enregistrerTableau(
    organizationId: string,
    entityId: string,
    blocsBruts: unknown
  ): Promise<{ blocs: Bloc[] }> {
    await this.entities.getOrThrow(organizationId, entityId);

    const verdict = validerBlocs(blocsBruts);
    if (!verdict.valide) throw new BadRequestException(verdict.motif);

    await this.prisma.tableauDeBord.upsert({
      where: { entityId },
      create: { entityId, blocs: verdict.blocs as unknown as object },
      update: { blocs: verdict.blocs as unknown as object },
    });
    return { blocs: verdict.blocs };
  }

  /**
   * Le prévisionnel, calculé à la volée.
   *
   * Les hypothèses sont enregistrées, le résultat non : le recalcul coûte
   * quelques microsecondes, et un résultat mis en cache finit toujours par
   * survivre à l'hypothèse qui l'a produit.
   */
  async previsionnel(
    organizationId: string,
    entityId: string,
    hypothesesBrutes?: Partial<Hypotheses>
  ): Promise<{ hypotheses: Hypotheses; exercices: SerieExercice[]; depart: number | null }> {
    const exercices = construireExercices(await this.periodes(organizationId, entityId));

    const enregistrees = hypothesesBrutes
      ? undefined
      : ((await this.prisma.tableauDeBord.findUnique({ where: { entityId } }))?.hypotheses as
          | Partial<Hypotheses>
          | null
          | undefined);
    const hypotheses = assainirHypotheses(hypothesesBrutes ?? enregistrees ?? HYPOTHESES_PAR_DEFAUT);

    /*
     * Le dernier exercice **complet** sert de point de départ, pas le dernier
     * tout court. Projeter une croissance à partir d'une année en cours de
     * trois mois donnerait un chiffre d'affaires futur divisé par quatre.
     */
    const complets = exercices.filter((exercice) => exercice.complet);
    const depart = complets[complets.length - 1];
    if (!depart) {
      return { hypotheses, exercices: [], depart: null };
    }

    const projetes = projeter({ annee: depart.annee, aggregates: depart.aggregates }, hypotheses);
    return {
      hypotheses,
      exercices: projetes.map((exercice) => this.enSerie(exercice, false)),
      depart: depart.annee,
    };
  }

  async enregistrerHypotheses(
    organizationId: string,
    entityId: string,
    brutes: Partial<Hypotheses>
  ): Promise<Hypotheses> {
    await this.entities.getOrThrow(organizationId, entityId);
    const hypotheses = assainirHypotheses(brutes);

    await this.prisma.tableauDeBord.upsert({
      where: { entityId },
      create: {
        entityId,
        blocs: TABLEAU_PAR_DEFAUT as unknown as object,
        hypotheses: hypotheses as unknown as object,
      },
      update: { hypotheses: hypotheses as unknown as object },
    });
    return hypotheses;
  }

  /** Vérifie l'existence de l'entité et donne son contexte d'affichage. */
  async contexte(organizationId: string, entityId: string) {
    const entity = await this.entities.getOrThrow(organizationId, entityId);
    if (!entity) throw new NotFoundException("Entité introuvable.");
    return { id: entity.id, nom: entity.name, devise: entity.currency };
  }
}
