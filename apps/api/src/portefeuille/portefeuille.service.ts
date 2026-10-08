import { Injectable } from "@nestjs/common";
import { ActionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { lireAgregats } from "../ratios/engine";
import { construireExercices, type Exercice } from "../pluriannuel/agregation";
import { evaluerDossier, moisEntre, type EtatDossier } from "./etat";

/**
 * Le portefeuille : tous les dossiers d'un cabinet, sur une ligne chacun.
 *
 * Les chiffres viennent du dernier exercice **complet**, jamais de la dernière
 * période. Comparer le chiffre d'affaires d'un dossier tenu en situations
 * mensuelles à celui d'un dossier tenu à l'année mettrait côte à côte un mois
 * et douze ; trier la colonne n'aurait plus aucun sens. L'agrégation par
 * exercice est celle du pluriannuel, réutilisée telle quelle : un même dossier
 * affiche le même chiffre d'affaires ici et là-bas.
 */

export interface LignePortefeuille {
  id: string;
  nom: string;
  nafCode: string | null;
  devise: string;
  etat: EtatDossier;
  motifs: string[];
  /** Fin de la dernière période importée, quelle qu'elle soit. */
  dernieresDonnees: string | null;
  moisDepuisDernieresDonnees: number | null;
  /** Le dernier exercice complet, base de tous les chiffres de la ligne. */
  exercice: string | null;
  chiffreAffaires: number | null;
  croissanceCa: number | null;
  margeEbitda: number | null;
  resultatNet: number | null;
  tresorerieNette: number | null;
  dso: number | null;
  alertesOuvertes: number;
  actionsEnRetard: number;
}

function ratio(exercice: Exercice | undefined, id: string): number | null {
  return exercice?.ratios.find((r) => r.id === id)?.value ?? null;
}

@Injectable()
export class PortefeuilleService {
  constructor(private prisma: PrismaService) {}

  async lister(organizationId: string, maintenant = new Date()): Promise<LignePortefeuille[]> {
    const entites = await this.prisma.entity.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: {
        periods: {
          orderBy: { startDate: "asc" },
          include: { ratioResult: true },
        },
      },
    });
    const ids = entites.map((e) => e.id);

    /*
     * Deux requêtes groupées pour tout le portefeuille, et non deux par
     * dossier : à quarante dossiers, la différence se compte en secondes.
     */
    const [alertes, actions] = await Promise.all([
      this.prisma.alertEvent.groupBy({
        by: ["entityId"],
        where: { entityId: { in: ids }, acknowledged: false, alertRule: { active: true } },
        _count: { _all: true },
      }),
      this.prisma.actionPlan.groupBy({
        by: ["entityId"],
        where: {
          organizationId,
          entityId: { in: ids },
          statut: { in: [ActionStatus.A_FAIRE, ActionStatus.EN_COURS] },
          echeance: { lt: maintenant },
        },
        _count: { _all: true },
      }),
    ]);
    const alertesPar = new Map(alertes.map((a) => [a.entityId, a._count._all]));
    const actionsPar = new Map(actions.map((a) => [a.entityId ?? "", a._count._all]));

    return entites.map((entite) => {
      const exercices = construireExercices(
        entite.periods
          .filter((p) => p.ratioResult)
          .map((p) => ({
            id: p.id,
            label: p.label,
            debut: p.startDate,
            fin: p.endDate,
            aggregates: lireAgregats(p.ratioResult!.aggregates),
          })),
      );
      const complets = exercices.filter((e) => e.complet);
      const dernier = complets[complets.length - 1];

      const finDernierePeriode = entite.periods.reduce<Date | null>(
        (max, p) => (!max || p.endDate > max ? p.endDate : max),
        null,
      );
      const moisDepuisDernieresDonnees = finDernierePeriode
        ? moisEntre(finDernierePeriode, maintenant)
        : null;

      const alertesOuvertes = alertesPar.get(entite.id) ?? 0;
      const actionsEnRetard = actionsPar.get(entite.id) ?? 0;

      const { etat, motifs } = evaluerDossier({
        aDesDonnees: Boolean(dernier),
        periodesImportees: entite.periods.length,
        capitauxPropres: dernier?.aggregates.capitauxPropres ?? null,
        tresorerieNette: dernier?.derived.tresorerieNette ?? null,
        resultatNet: dernier?.derived.resultatNet ?? null,
        alertesOuvertes,
        actionsEnRetard,
        moisDepuisDernieresDonnees,
      });

      return {
        id: entite.id,
        nom: entite.name,
        nafCode: entite.nafCode,
        devise: entite.currency,
        etat,
        motifs,
        dernieresDonnees: finDernierePeriode?.toISOString() ?? null,
        moisDepuisDernieresDonnees,
        exercice: dernier?.label ?? null,
        chiffreAffaires: dernier?.aggregates.chiffreAffaires ?? null,
        croissanceCa: ratio(dernier, "croissance_ca"),
        margeEbitda: ratio(dernier, "marge_ebitda"),
        resultatNet: dernier?.derived.resultatNet ?? null,
        tresorerieNette: dernier?.derived.tresorerieNette ?? null,
        dso: ratio(dernier, "dso"),
        alertesOuvertes,
        actionsEnRetard,
      };
    });
  }
}
