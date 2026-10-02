import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { PLANS, questionsRestantes } from "../billing/plans";

/**
 * Compteur mensuel des questions posées au conseiller.
 *
 * Le mois sert de clé plutôt qu'une date de remise à zéro stockée : une
 * ligne par mois, et la précédente cesse simplement d'être lue. Aucune tâche
 * planifiée à écrire, rien qui puisse ne pas s'exécuter le 1er du mois.
 */

/** Mois courant au format AAAA-MM, en temps universel. */
export function moisCourant(maintenant: Date = new Date()): string {
  return `${maintenant.getUTCFullYear()}-${String(maintenant.getUTCMonth() + 1).padStart(2, "0")}`;
}

@Injectable()
export class UsageConseilService {
  constructor(
    private prisma: PrismaService,
    private billing: BillingService
  ) {}

  private async posees(organizationId: string): Promise<number> {
    const ligne = await this.prisma.conseilUsage.findUnique({
      where: { organizationId_mois: { organizationId, mois: moisCourant() } },
    });
    return ligne?.questions ?? 0;
  }

  async restantes(organizationId: string): Promise<number> {
    const abonnement = await this.billing.pourOrganisation(organizationId);
    return questionsRestantes(PLANS[abonnement.plan], await this.posees(organizationId));
  }

  async etat(organizationId: string) {
    const abonnement = await this.billing.pourOrganisation(organizationId);
    const plan = PLANS[abonnement.plan];
    const posees = await this.posees(organizationId);
    return {
      posees,
      incluses: plan.quotas.questionsConseil,
      restantes: questionsRestantes(plan, posees),
      formule: plan.label,
    };
  }

  /**
   * Incrémente le compteur du mois.
   *
   * `upsert` plutôt que lecture puis écriture : deux questions simultanées
   * liraient la même valeur et n'en compteraient qu'une. L'incrément est
   * fait par la base, sur la clé unique (organisation, mois).
   */
  async enregistrer(
    organizationId: string,
    consommation: { entree: number; sortie: number }
  ): Promise<void> {
    const mois = moisCourant();
    await this.prisma.conseilUsage.upsert({
      where: { organizationId_mois: { organizationId, mois } },
      create: {
        organizationId,
        mois,
        questions: 1,
        jetonsEntree: consommation.entree,
        jetonsSortie: consommation.sortie,
      },
      update: {
        questions: { increment: 1 },
        jetonsEntree: { increment: consommation.entree },
        jetonsSortie: { increment: consommation.sortie },
      },
    });
  }
}
