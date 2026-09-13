import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PlanId, Subscription } from "@prisma/client";
import type Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";
import { PLANS, PLAN_PAR_DEFAUT, accesOuvert, demandeAction, verifierQuota } from "./plans";
import { estEvenementSuivi, planDepuisTarif, statutDepuisStripe } from "./statuts-stripe";

/** Durée de l'essai accordé à l'inscription, sans carte bancaire. */
export const JOURS_ESSAI = 14;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private config: ConfigService
  ) {}

  /**
   * Abonnement d'une organisation, créé à la volée s'il manque.
   *
   * Une organisation sans ligne d'abonnement est une organisation créée avant
   * la mise en place de la facturation : lui accorder l'essai plutôt que de
   * lever une erreur évite de casser des comptes existants le jour du
   * déploiement.
   */
  async pourOrganisation(organizationId: string): Promise<Subscription> {
    const existant = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (existant) return existant;

    return this.prisma.subscription.create({
      data: {
        organizationId,
        plan: PLAN_PAR_DEFAUT,
        statut: "essai",
        finPeriode: new Date(Date.now() + JOURS_ESSAI * 24 * 60 * 60 * 1000),
      },
    });
  }

  /** Ce que le frontend a besoin de savoir pour afficher l'état du compte. */
  async etat(organizationId: string) {
    const abonnement = await this.pourOrganisation(organizationId);
    const plan = PLANS[abonnement.plan];

    const [entites, utilisateurs] = await Promise.all([
      this.prisma.entity.count({ where: { organizationId } }),
      this.prisma.user.count({ where: { organizationId } }),
    ]);

    return {
      plan: { id: plan.id, label: plan.label, promesse: plan.promesse, quotas: plan.quotas },
      statut: abonnement.statut,
      accesOuvert: accesOuvert(abonnement.statut),
      demandeAction: demandeAction(abonnement.statut),
      finPeriode: abonnement.finPeriode,
      resiliationDemandee: abonnement.resiliationDemandee,
      // Le paiement peut être indisponible sur cette instance : le dire
      // franchement vaut mieux qu'un bouton qui échouera au clic.
      paiementDisponible: this.stripe.configure,
      consommation: {
        entites,
        utilisateurs,
      },
    };
  }

  /**
   * Refuse une création qui ferait dépasser la formule.
   *
   * Le message nomme la limite atteinte et la formule en cours : « vous avez
   * atteint 1 entité sur 1 » se comprend et se résout, « formule
   * insuffisante » ne fait que frustrer.
   */
  async exigerQuota(
    organizationId: string,
    quota: "entites" | "utilisateurs" | "periodes",
    actuel: number
  ): Promise<void> {
    const abonnement = await this.pourOrganisation(organizationId);
    const plan = PLANS[abonnement.plan];
    const depassement = verifierQuota(plan, quota, actuel);
    if (!depassement) return;

    throw new ForbiddenException(
      `La formule « ${plan.label} » permet ${depassement.limite} ${depassement.libelle} ; ` +
        `vous y êtes. Changez de formule depuis la page Abonnement pour aller au-delà.`
    );
  }

  /** Refuse une fonction que la formule n'inclut pas. */
  async exigerFonction(organizationId: string, fonction: "consolidation" | "fec"): Promise<void> {
    const abonnement = await this.pourOrganisation(organizationId);
    const plan = PLANS[abonnement.plan];
    if (plan.quotas[fonction]) return;

    const libelles = { consolidation: "La consolidation de groupe", fec: "L'import FEC" };
    throw new ForbiddenException(
      `${libelles[fonction]} n'est pas incluse dans la formule « ${plan.label} ».`
    );
  }

  /** Ouvre la page de paiement Stripe pour une formule donnée. */
  async demarrerCheckout(organizationId: string, email: string, planId: PlanId) {
    const plan = PLANS[planId];
    if (!plan.variableTarif) {
      throw new BadRequestException("L'essai ne se souscrit pas : il est accordé à l'inscription.");
    }

    const priceId = this.config.get<string>(plan.variableTarif);
    if (!priceId) {
      throw new BadRequestException(
        `Aucun tarif Stripe n'est configuré pour la formule « ${plan.label} ».`
      );
    }

    const abonnement = await this.pourOrganisation(organizationId);
    const base = this.config.get<string>("APP_URL") ?? "http://localhost:5173";

    return this.stripe.creerSessionCheckout({
      priceId,
      organizationId,
      email,
      stripeCustomerId: abonnement.stripeCustomerId,
      urlSucces: `${base}/abonnement?paiement=succes`,
      urlAnnulation: `${base}/abonnement?paiement=annule`,
    });
  }

  /** Ouvre le portail Stripe : formule, carte, résiliation, factures. */
  async ouvrirPortail(organizationId: string) {
    const abonnement = await this.pourOrganisation(organizationId);
    if (!abonnement.stripeCustomerId) {
      throw new NotFoundException(
        "Aucun abonnement payant à gérer : vous êtes en période d'essai."
      );
    }
    const base = this.config.get<string>("APP_URL") ?? "http://localhost:5173";
    return this.stripe.creerSessionPortail(abonnement.stripeCustomerId, `${base}/abonnement`);
  }

  /**
   * Traite un événement Stripe, une seule fois.
   *
   * Stripe garantit une livraison « au moins une fois » : le même événement
   * peut arriver deux fois, et le rejouer accorderait deux fois un changement
   * de formule. L'insertion en base sert de verrou — si l'identifiant existe
   * déjà, l'événement a été traité et on s'arrête là.
   */
  async traiterEvenement(evenement: Stripe.Event): Promise<{ traite: boolean; raison?: string }> {
    if (!estEvenementSuivi(evenement.type)) {
      return { traite: false, raison: "événement non suivi" };
    }

    try {
      await this.prisma.stripeEvent.create({
        data: { id: evenement.id, type: evenement.type },
      });
    } catch {
      // Violation de clé primaire : l'événement est déjà passé.
      return { traite: false, raison: "déjà traité" };
    }

    try {
      await this.appliquer(evenement);
      await this.prisma.stripeEvent.update({
        where: { id: evenement.id },
        data: { traiteLe: new Date() },
      });
      return { traite: true };
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      // La trace est conservée pour pouvoir rejouer : un événement perdu, ce
      // sont des droits jamais accordés à un client qui a payé.
      await this.prisma.stripeEvent.update({
        where: { id: evenement.id },
        data: { erreur: message.slice(0, 500) },
      });
      this.logger.error(`Événement ${evenement.id} (${evenement.type}) en échec : ${message}`);
      throw erreur;
    }
  }

  private async appliquer(evenement: Stripe.Event): Promise<void> {
    switch (evenement.type) {
      case "checkout.session.completed": {
        const session = evenement.data.object as Stripe.Checkout.Session;
        const organizationId = session.client_reference_id;
        if (!organizationId) {
          throw new Error("Session de paiement sans client_reference_id : organisation inconnue.");
        }
        await this.prisma.subscription.update({
          where: { organizationId },
          data: {
            stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
            stripeSubscriptionId:
              typeof session.subscription === "string" ? session.subscription : undefined,
          },
        });
        // L'état réel (formule, échéance) arrive avec l'événement
        // d'abonnement : on ne le devine pas depuis la session.
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await this.synchroniserAbonnement(evenement.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_failed":
      case "invoice.paid": {
        const facture = evenement.data.object as Stripe.Invoice & { subscription?: string | null };
        const abonnementId =
          typeof facture.subscription === "string" ? facture.subscription : null;
        if (!abonnementId) break;
        const abonnement = await this.stripe.recupererAbonnement(abonnementId);
        await this.synchroniserAbonnement(abonnement);
        break;
      }
    }
  }

  /** Recopie l'état Stripe dans la base, sans jamais copier de montant. */
  private async synchroniserAbonnement(abonnement: Stripe.Subscription): Promise<void> {
    const organizationId = abonnement.metadata?.organizationId;
    const cible = organizationId
      ? { organizationId }
      : { stripeSubscriptionId: abonnement.id };

    const existant = await this.prisma.subscription.findFirst({ where: cible });
    if (!existant) {
      throw new Error(
        `Abonnement Stripe ${abonnement.id} sans organisation correspondante en base.`
      );
    }

    const priceId = abonnement.items.data[0]?.price?.id ?? null;
    const plan = planDepuisTarif(priceId, process.env);
    const statut = statutDepuisStripe(abonnement.status);

    // Une fin de période absente laisse le champ tel quel plutôt que de le
    // vider : une date effacée ferait croire à un accès sans échéance.
    const item = abonnement.items.data[0] as { current_period_end?: number } | undefined;
    const fin = item?.current_period_end;

    await this.prisma.subscription.update({
      where: { id: existant.id },
      data: {
        statut,
        ...(plan ? { plan } : {}),
        stripeSubscriptionId: abonnement.id,
        stripePriceId: priceId,
        ...(typeof abonnement.customer === "string"
          ? { stripeCustomerId: abonnement.customer }
          : {}),
        ...(fin ? { finPeriode: new Date(fin * 1000) } : {}),
        resiliationDemandee: abonnement.cancel_at_period_end ?? false,
      },
    });

    if (!plan && priceId) {
      // Un tarif créé à la main dans Stripe ne correspond à aucune formule :
      // le signaler plutôt que de laisser le client sur l'ancienne.
      this.logger.warn(
        `Tarif ${priceId} inconnu du catalogue : la formule n'a pas été modifiée.`
      );
    }
  }
}
