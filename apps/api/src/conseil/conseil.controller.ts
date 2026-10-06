import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ConseilService } from "./conseil.service";
import { UsageConseilService } from "./usage.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

/** Bornes de la question. */
const LONGUEUR_MIN = 5;
const LONGUEUR_MAX = 1000;

@Controller("conseil")
@UseGuards(JwtAuthGuard)
export class ConseilController {
  constructor(
    private conseil: ConseilService,
    private usage: UsageConseilService
  ) {}

  /** Ce que le frontend doit savoir avant d'afficher le champ de saisie. */
  @Get("etat")
  async etat(@CurrentUser() user: AuthUser) {
    const compteur = await this.usage.etat(user.organizationId, user.administrateurPlateforme);
    return { disponible: this.conseil.configure, ...compteur };
  }

  /**
   * Une question, une réponse.
   *
   * Limité plus sévèrement que le reste : chaque appel déclenche plusieurs
   * requêtes facturées à un modèle. Sans cela, un script ou une boucle
   * accidentelle dans le frontend épuiserait le quota du client en quelques
   * secondes, et la facture avec.
   */
  @Post("question")
  @HttpCode(200)
  @Throttle({ court: { limit: 5, ttl: 60_000 }, long: { limit: 60, ttl: 3_600_000 } })
  async question(@CurrentUser() user: AuthUser, @Body("question") question: unknown) {
    if (typeof question !== "string" || question.trim().length < LONGUEUR_MIN) {
      throw new BadRequestException("Posez une question d'au moins cinq caractères.");
    }
    if (question.length > LONGUEUR_MAX) {
      throw new BadRequestException(
        `Votre question dépasse ${LONGUEUR_MAX} caractères. Scindez-la en deux.`
      );
    }

    /* Le quota est vérifié avant l'appel, jamais après : constater le
     * dépassement une fois le modèle payé ne protège de rien. */
    const restantes = await this.usage.restantes(
      user.organizationId,
      user.administrateurPlateforme
    );
    if (restantes <= 0) {
      throw new ForbiddenException(
        "Vous avez utilisé toutes les questions incluses dans votre formule ce mois-ci. " +
          "Le compteur repart le 1er du mois prochain ; une formule supérieure en inclut davantage."
      );
    }

    const reponse = await this.conseil.repondre(user.organizationId, question.trim());

    /* Enregistré même en cas de réponse tronquée : les jetons ont été
     * consommés, donc facturés, qu'on ait abouti ou non. */
    await this.usage.enregistrer(user.organizationId, reponse.consommation);

    return {
      texte: reponse.texte,
      sources: reponse.sources,
      tronquee: reponse.tronquee,
      restantes: restantes - 1,
    };
  }
}
