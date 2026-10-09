import { Injectable, NotFoundException } from "@nestjs/common";
import { ActionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { lireAgregats } from "../ratios/engine";
import { construireExercices, type Exercice } from "../pluriannuel/agregation";
import { detecterOpportunites, type Opportunite, type Situation } from "./regles";

export interface OpportuniteDossier extends Opportunite {
  /** Une action ouverte du plan d'action la couvre déjà : on ne la repropose pas comme neuve. */
  dansLePlan: boolean;
}

export interface DossierOpportunites {
  entityId: string;
  nom: string;
  devise: string;
  /** L'exercice sur lequel les opportunités sont calculées, et celui de comparaison. */
  exercice: string | null;
  exerciceCompare: string | null;
  opportunites: OpportuniteDossier[];
}

function situation(e: Exercice): Situation {
  return { label: e.label, aggregates: e.aggregates, derived: e.derived, ratios: e.ratios };
}

/**
 * Les opportunités de mission, dossier par dossier.
 *
 * Calculées sur le dernier exercice **complet**, comparé à l'exercice
 * précédent : les mêmes chiffres que le portefeuille, pour que le montant
 * annoncé ici se retrouve là-bas. Un trimestre se prêterait mal à l'exercice
 * — un délai client calculé sur trois mois, ou une marge saisonnière,
 * proposerait des missions à contretemps.
 */
@Injectable()
export class OpportunitesService {
  constructor(private prisma: PrismaService) {}

  async lister(organizationId: string, entityId?: string): Promise<DossierOpportunites[]> {
    const entites = await this.prisma.entity.findMany({
      where: { organizationId, ...(entityId ? { id: entityId } : {}) },
      orderBy: { name: "asc" },
      include: {
        periods: { orderBy: { startDate: "asc" }, include: { ratioResult: true } },
      },
    });
    if (entityId && entites.length === 0) throw new NotFoundException("Dossier introuvable.");

    /*
     * Les actions ouvertes, en une requête pour tout le portefeuille. Une
     * opportunité est « dans le plan » quand une action ouverte du même
     * dossier suit le même indicateur, ou reprend mot pour mot la même
     * action — c'est ce que fait le bouton « Ajouter au plan d'action ».
     */
    const ouvertes = await this.prisma.actionPlan.findMany({
      where: {
        organizationId,
        entityId: { in: entites.map((e) => e.id) },
        statut: { in: [ActionStatus.A_FAIRE, ActionStatus.EN_COURS] },
      },
      select: { entityId: true, ratioId: true, action: true },
    });

    return entites.map((entite) => {
      const complets = construireExercices(
        entite.periods
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
      const precedent = dernier ? complets.find((e) => e.annee === dernier.annee - 1) ?? null : null;

      const actions = ouvertes.filter((a) => a.entityId === entite.id);
      const opportunites = dernier
        ? detecterOpportunites(situation(dernier), precedent ? situation(precedent) : null).map((o) => ({
            ...o,
            dansLePlan: actions.some(
              (a) => (o.suivi && a.ratioId === o.suivi.ratioId) || a.action === o.action,
            ),
          }))
        : [];

      return {
        entityId: entite.id,
        nom: entite.name,
        devise: entite.currency,
        exercice: dernier?.label ?? null,
        exerciceCompare: precedent?.label ?? null,
        opportunites,
      };
    });
  }
}
