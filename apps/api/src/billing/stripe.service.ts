import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/**
 * Accès à Stripe, isolé derrière un service.
 *
 * L'application doit pouvoir démarrer, être développée et être testée sans
 * clé Stripe : tant qu'aucune société n'est immatriculée, il n'y a pas de
 * compte à brancher. Le service se déclare donc « non configuré » plutôt que
 * de faire échouer le démarrage, et chaque appel qui a réellement besoin de
 * Stripe refuse avec un message qui dit quoi faire.
 *
 * La conséquence à connaître : l'application tourne, mais aucun abonnement
 * payant ne peut être souscrit. C'est le comportement voulu — un paiement à
 * moitié branché serait bien pire.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;

  constructor(private config: ConfigService) {
    const cle = this.config.get<string>("STRIPE_SECRET_KEY");
    if (!cle) {
      this.logger.warn(
        "STRIPE_SECRET_KEY absente : les abonnements payants sont désactivés. " +
          "L'essai et l'application fonctionnent normalement."
      );
      this.client = null;
      return;
    }
    this.client = new Stripe(cle);
  }

  get configure(): boolean {
    return this.client !== null;
  }

  /** Le client Stripe, ou un refus explicite si la clé manque. */
  private get stripe(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Le paiement n'est pas encore activé sur cette instance. " +
          "Renseignez STRIPE_SECRET_KEY pour l'ouvrir."
      );
    }
    return this.client;
  }

  /**
   * Page de paiement hébergée par Stripe.
   *
   * On ne construit pas de formulaire de carte : la page de Stripe apporte la
   * conformité PCI, la traduction, les moyens de paiement locaux et le calcul
   * de TVA. Un formulaire maison coûterait tout cela, pour rien de plus.
   */
  async creerSessionCheckout(options: {
    priceId: string;
    organizationId: string;
    email: string;
    stripeCustomerId: string | null;
    urlSucces: string;
    urlAnnulation: string;
  }): Promise<{ url: string }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: options.priceId, quantity: 1 }],
      ...(options.stripeCustomerId
        ? { customer: options.stripeCustomerId }
        : { customer_email: options.email }),
      // L'identifiant d'organisation voyage avec la session : au retour du
      // webhook, c'est la seule façon de savoir qui vient de payer.
      client_reference_id: options.organizationId,
      subscription_data: { metadata: { organizationId: options.organizationId } },
      // Collecte du numéro de TVA : sans lui, impossible d'appliquer
      // l'autoliquidation à un client professionnel de l'Union.
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      customer_update: options.stripeCustomerId ? { name: "auto", address: "auto" } : undefined,
      billing_address_collection: "required",
      success_url: options.urlSucces,
      cancel_url: options.urlAnnulation,
      locale: "fr",
    });

    if (!session.url) {
      throw new ServiceUnavailableException("Stripe n'a pas renvoyé d'URL de paiement.");
    }
    return { url: session.url };
  }

  /**
   * Portail client : changement de formule, moyen de paiement, résiliation.
   *
   * Ce n'est pas seulement du confort. Le droit français impose qu'un
   * abonnement puisse être résilié en ligne aussi simplement qu'il a été
   * souscrit ; le portail répond nativement à cette obligation, là où une
   * interface maison devrait la réimplémenter et la maintenir.
   */
  async creerSessionPortail(stripeCustomerId: string, urlRetour: string): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: urlRetour,
      locale: "fr",
    });
    return { url: session.url };
  }

  /**
   * Vérifie la signature d'un webhook et renvoie l'événement.
   *
   * Sans cette vérification, n'importe qui connaissant l'URL pourrait
   * s'octroyer un abonnement en postant un faux événement. Elle exige le
   * corps *brut* de la requête : un corps déjà analysé en JSON puis
   * re-sérialisé ne produit pas la même signature.
   */
  construireEvenement(corpsBrut: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException(
        "STRIPE_WEBHOOK_SECRET absente : les webhooks ne peuvent pas être authentifiés."
      );
    }
    return this.stripe.webhooks.constructEvent(corpsBrut, signature, secret);
  }

  async recupererAbonnement(id: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(id);
  }
}
