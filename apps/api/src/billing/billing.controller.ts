import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { Role } from "@prisma/client";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";
import { PLANS, PLAN_IDS, estPlanConnu } from "./plans";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

@Controller("billing")
export class BillingController {
  constructor(
    private billing: BillingService,
    private stripe: StripeService
  ) {}

  /**
   * Catalogue public : ce que chaque formule permet.
   *
   * Volontairement sans authentification — la page de tarifs du site doit
   * pouvoir l'afficher — et volontairement sans prix, qui viennent de Stripe.
   */
  @Get("formules")
  formules() {
    return PLAN_IDS.map((id) => ({
      id,
      label: PLANS[id].label,
      promesse: PLANS[id].promesse,
      quotas: PLANS[id].quotas,
    }));
  }

  @Get("etat")
  @UseGuards(JwtAuthGuard)
  etat(@CurrentUser() user: AuthUser) {
    return this.billing.etat(user.organizationId);
  }

  /**
   * Seul un administrateur engage une dépense pour l'organisation. Un lecteur
   * qui pourrait souscrire créerait une facture que personne n'a décidée.
   */
  @Post("checkout")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  checkout(@CurrentUser() user: AuthUser, @Body("plan") plan: string) {
    if (!plan || !estPlanConnu(plan)) {
      throw new BadRequestException(`Formule inconnue. Valeurs admises : ${PLAN_IDS.join(", ")}.`);
    }
    return this.billing.demarrerCheckout(user.organizationId, user.email, plan);
  }

  @Post("portail")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  portail(@CurrentUser() user: AuthUser) {
    return this.billing.ouvrirPortail(user.organizationId);
  }

  /**
   * Réception des événements Stripe.
   *
   * Sans authentification par JWT — l'appelant est Stripe, pas un utilisateur
   * — mais authentifiée par signature : sans elle, quiconque connaît l'URL
   * s'octroierait un abonnement en postant un faux événement.
   *
   * Le corps doit être lu brut. Un corps analysé en JSON puis re-sérialisé ne
   * produit plus la même signature, et la vérification échoue sans que la
   * cause soit évidente : d'où `rawBody: true` au démarrage (main.ts).
   */
  @Post("webhook")
  @HttpCode(200)
  // Exclu de la limitation de débit : c'est Stripe qui appelle, depuis un
  // petit nombre d'adresses. Le limiter ferait perdre des événements de
  // paiement lors d'une rafale légitime — un remboursement de masse, par
  // exemple — et un événement perdu, ce sont des droits jamais accordés.
  @SkipThrottle()
  async webhook(
    @Req() requete: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    if (!signature) {
      throw new BadRequestException("En-tête stripe-signature absent.");
    }
    if (!requete.rawBody) {
      throw new BadRequestException("Corps brut indisponible : vérifiez rawBody dans main.ts.");
    }

    const evenement = this.stripe.construireEvenement(requete.rawBody, signature);
    const resultat = await this.billing.traiterEvenement(evenement);

    // Toujours 200 quand l'événement est reçu et compris : un code d'erreur
    // déclenche une nouvelle tentative de Stripe, ce qui n'a de sens que si
    // le traitement a réellement échoué — auquel cas traiterEvenement lève.
    return { recu: true, ...resultat };
  }
}
