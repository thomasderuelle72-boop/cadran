import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { PlateformeGuard } from "./plateforme.guard";
import { PlateformeService } from "./plateforme.service";
import { estProduction } from "../config/environnement";
import { ChangerFormuleDto, DroitPlateformeDto, SupprimerOrganisationDto } from "./dto";
import {
  COOKIE_CSRF,
  COOKIE_SESSION,
  DUREE_ACCES_SUPPORT_MS,
  emettreCsrf,
  optionsCsrf,
  optionsSession,
} from "../auth/session";

/**
 * Console d'exploitation.
 *
 * Toutes les routes exigent le droit d'administration de la plateforme, relu
 * en base à chaque appel (voir plateforme.guard.ts), et aucune ne renvoie de
 * donnée comptable : pour entrer dans un dossier client il faut ouvrir un
 * accès support, qui est tracé chez le client.
 */
@Controller("plateforme")
@UseGuards(JwtAuthGuard, PlateformeGuard)
export class PlateformeController {
  constructor(private plateforme: PlateformeService) {}

  private get production(): boolean {
    return estProduction();
  }

  @Get("sante")
  sante() {
    return this.plateforme.sante();
  }

  @Get("organisations")
  organisations() {
    return this.plateforme.organisations();
  }

  @Get("organisations/:id/utilisateurs")
  utilisateurs(@Param("id") id: string) {
    return this.plateforme.utilisateurs(id);
  }

  @Patch("organisations/:id/formule")
  changerFormule(@Param("id") id: string, @Body() dto: ChangerFormuleDto) {
    return this.plateforme.changerFormule(id, dto);
  }

  @Delete("organisations/:id")
  supprimer(@Param("id") id: string, @Body() dto: SupprimerOrganisationDto) {
    return this.plateforme.supprimerOrganisation(id, dto.nom);
  }

  /**
   * Mot de passe provisoire pour un compte client bloqué.
   *
   * Renvoyé une seule fois, dans cette réponse. Il n'est stocké qu'en
   * empreinte : s'il est perdu, on en refait un, on ne le retrouve pas.
   */
  @Post("utilisateurs/:id/mot-de-passe")
  motDePasse(@Param("id") id: string) {
    return this.plateforme.reinitialiserMotDePasse(id);
  }

  @Patch("utilisateurs/:id/droit-plateforme")
  droitPlateforme(@Param("id") id: string, @Body() dto: DroitPlateformeDto) {
    return this.plateforme.changerDroitPlateforme(id, dto.accorde);
  }

  /**
   * Entre dans le dossier d'un client, pour une heure.
   *
   * Remplace la session en cours plutôt que d'en ouvrir une seconde : deux
   * sessions actives dans le même navigateur, l'une sur son propre cabinet et
   * l'autre sur un client, est la configuration qui fait saisir une écriture
   * dans le mauvais dossier. On est quelque part, ou ailleurs.
   */
  @Post("organisations/:id/acces")
  @HttpCode(200)
  async acces(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Res({ passthrough: true }) reponse: Response
  ) {
    const { jeton, organisation } = await this.plateforme.ouvrirAcces(user.userId, id);
    /* Le jeton anti-CSRF est rendu dans le corps pour la même raison qu'à la
     * connexion : le frontend ne peut pas lire un cookie posé sur le domaine
     * de l'API (voir auth.controller.ts). Sans lui, la session support serait
     * ouverte mais incapable de modifier quoi que ce soit. */
    const jetonCsrf = emettreCsrf();
    reponse.cookie(COOKIE_SESSION, jeton, optionsSession(this.production, DUREE_ACCES_SUPPORT_MS));
    reponse.cookie(COOKIE_CSRF, jetonCsrf, optionsCsrf(this.production));
    return { organisation, jetonCsrf };
  }
}
