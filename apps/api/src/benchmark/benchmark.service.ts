import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EntitiesService } from "../entities/entities.service";
import { lireAgregats } from "../ratios/engine";
import { construireExercices } from "../pluriannuel/agregation";
import { comparer, type ComparaisonSectorielle, type ReferenceSecteur } from "./comparaison";
import { codesSecteur } from "./secteurs";
import { validerImport } from "./import-reference";

/** La seule source chargeable aujourd'hui. */
const SOURCE = "BANQUE_DE_FRANCE";

/**
 * Pourquoi un dossier n'a pas de comparaison sectorielle.
 *
 * Chaque cas appelle un geste différent — charger le référentiel, renseigner
 * le code NAF, importer un exercice complet — et l'écran doit pouvoir dire
 * lequel. Un simple « indisponible » ne laisserait que l'impression d'un
 * défaut.
 */
export type RaisonIndisponible = "referentiel_absent" | "naf_absent" | "secteur_absent" | "exercice_absent";

export type ReponseComparaison =
  | ({ disponible: true; exercice: string } & ComparaisonSectorielle)
  | { disponible: false; raison: RaisonIndisponible; codeNaf?: string | null };

@Injectable()
export class BenchmarkService {
  constructor(
    private prisma: PrismaService,
    private entities: EntitiesService,
  ) {}

  async comparaison(organizationId: string, entityId: string): Promise<ReponseComparaison> {
    const entite = await this.entities.getOrThrow(organizationId, entityId);

    const millesime = await this.prisma.referenceSectorielle.findFirst({
      where: { source: SOURCE },
      orderBy: { millesime: "desc" },
      select: { millesime: true },
    });
    if (!millesime) return { disponible: false, raison: "referentiel_absent" };

    const codes = codesSecteur(entite.nafCode);
    if (!codes) return { disponible: false, raison: "naf_absent", codeNaf: entite.nafCode };

    // La division d'abord, plus proche du métier ; la section à défaut.
    let niveau: "division" | "section" = "division";
    let lignes = await this.prisma.referenceSectorielle.findMany({
      where: { source: SOURCE, millesime: millesime.millesime, codeSecteur: codes.division },
    });
    if (lignes.length === 0) {
      niveau = "section";
      lignes = await this.prisma.referenceSectorielle.findMany({
        where: { source: SOURCE, millesime: millesime.millesime, codeSecteur: codes.section },
      });
    }
    if (lignes.length === 0) return { disponible: false, raison: "secteur_absent", codeNaf: entite.nafCode };

    const periodes = await this.prisma.accountingPeriod.findMany({
      where: { entityId },
      orderBy: { startDate: "asc" },
      include: { ratioResult: true },
    });
    const complets = construireExercices(
      periodes
        .filter((p) => p.ratioResult)
        .map((p) => ({
          id: p.id,
          label: p.label,
          debut: p.startDate,
          fin: p.endDate,
          aggregates: lireAgregats(p.ratioResult!.aggregates),
        })),
    ).filter((e) => e.complet);

    const dernier = complets[complets.length - 1];
    if (!dernier) return { disponible: false, raison: "exercice_absent" };

    /*
     * Une variation ne se calcule que d'une année sur l'autre. Si l'exercice
     * précédent manque — un trou dans les imports —, comparer 2025 à 2022
     * donnerait une « croissance annuelle » qui en couvre trois.
     */
    const avant = complets[complets.length - 2];
    const precedent = avant && avant.annee === dernier.annee - 1 ? { aggregates: avant.aggregates } : null;

    const reference: ReferenceSecteur = {
      source: SOURCE,
      millesime: millesime.millesime,
      miseAJour: lignes[0].miseAJour,
      codeSecteur: lignes[0].codeSecteur,
      libelleSecteur: lignes[0].libelleSecteur,
      niveau,
      valeurs: new Map(
        lignes.map((l) => [l.ratioId, { q1: l.q1, q2: l.q2, q3: l.q3, nombreEntreprises: l.nombreEntreprises }]),
      ),
    };

    return {
      disponible: true,
      exercice: dernier.label,
      ...comparer(reference, {
        aggregates: dernier.aggregates,
        derived: dernier.derived,
        precedent,
        effectif: entite.headcount,
      }),
    };
  }

  /** Ce qui est chargé, par source et millésime. */
  async referentiels() {
    const groupes = await this.prisma.referenceSectorielle.groupBy({
      by: ["source", "millesime", "miseAJour"],
      _count: { _all: true },
      _max: { importeLe: true },
      orderBy: { millesime: "desc" },
    });
    return Promise.all(
      groupes.map(async (g) => {
        const secteurs = await this.prisma.referenceSectorielle.findMany({
          where: { source: g.source, millesime: g.millesime },
          distinct: ["codeSecteur"],
          select: { codeSecteur: true },
        });
        return {
          source: g.source,
          millesime: g.millesime,
          miseAJour: g.miseAJour.toISOString(),
          secteurs: secteurs.length,
          lignes: g._count._all,
          importeLe: g._max.importeLe?.toISOString() ?? null,
        };
      }),
    );
  }

  /**
   * Remplace d'un bloc le référentiel d'une source et d'un millésime.
   *
   * Dans une transaction : un import interrompu ne doit pas laisser un
   * référentiel à moitié remplacé, où certains secteurs seraient du nouveau
   * millésime et d'autres de l'ancien sans que rien ne le montre.
   */
  async importer(contenu: Buffer) {
    let brut: unknown;
    try {
      brut = JSON.parse(contenu.toString("utf8"));
    } catch {
      throw new BadRequestException("Le fichier n'est pas un JSON valide.");
    }

    const verdict = validerImport(brut);
    if (!verdict.valide) throw new BadRequestException(verdict.motif);

    const { source, millesime } = verdict.lignes[0];
    await this.prisma.$transaction([
      this.prisma.referenceSectorielle.deleteMany({ where: { source, millesime } }),
      this.prisma.referenceSectorielle.createMany({ data: verdict.lignes }),
    ]);
    return { source, millesime, secteurs: verdict.secteurs, lignes: verdict.lignes.length };
  }

  async supprimer(source: string, millesime: number) {
    const { count } = await this.prisma.referenceSectorielle.deleteMany({ where: { source, millesime } });
    return { supprimees: count };
  }
}
