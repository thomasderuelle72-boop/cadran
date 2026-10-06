import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { Role } from "@prisma/client";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { PluriannuelService } from "./pluriannuel.service";
import type { Hypotheses } from "./previsionnel";

/**
 * Tableau de bord pluriannuel et prévisionnel d'une entité.
 *
 * La lecture est ouverte à tous les rôles — un collaborateur doit pouvoir
 * regarder. La configuration et les hypothèses sont réservées aux rôles qui
 * répondent des chiffres : un prévisionnel modifié par erreur se retrouve
 * dans un dossier remis à un banquier.
 */
@Controller("entities/:entityId/pluriannuel")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PluriannuelController {
  constructor(private pluriannuel: PluriannuelService) {}

  @Get("mesures")
  mesures() {
    return this.pluriannuel.mesures();
  }

  @Get("series")
  series(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string) {
    return this.pluriannuel.series(user.organizationId, entityId);
  }

  @Get("tableau")
  tableau(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string) {
    return this.pluriannuel.tableau(user.organizationId, entityId);
  }

  @Put("tableau")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  enregistrerTableau(
    @CurrentUser() user: AuthUser,
    @Param("entityId") entityId: string,
    @Body() corps: { blocs: unknown }
  ) {
    return this.pluriannuel.enregistrerTableau(user.organizationId, entityId, corps?.blocs);
  }

  /**
   * Le prévisionnel. Sans hypothèses en paramètre, il reprend celles qui sont
   * enregistrées — c'est l'ouverture de l'écran. Avec, il simule sans rien
   * enregistrer : on doit pouvoir essayer un scénario sans l'adopter.
   */
  @Get("previsionnel")
  previsionnel(
    @CurrentUser() user: AuthUser,
    @Param("entityId") entityId: string,
    @Query() parametres: Record<string, string>
  ) {
    const fournies = Object.keys(parametres).length > 0 ? nombres(parametres) : undefined;
    return this.pluriannuel.previsionnel(user.organizationId, entityId, fournies);
  }

  @Put("previsionnel")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  enregistrerHypotheses(
    @CurrentUser() user: AuthUser,
    @Param("entityId") entityId: string,
    @Body() corps: Partial<Hypotheses>
  ) {
    return this.pluriannuel.enregistrerHypotheses(user.organizationId, entityId, corps ?? {});
  }
}

/**
 * Les paramètres d'URL arrivent en chaînes.
 *
 * Les convertir ici plutôt que dans le moteur garde celui-ci purement
 * numérique ; `assainirHypotheses` écartera ensuite ce qui n'est pas fini,
 * donc une chaîne illisible retombe sur la valeur par défaut au lieu de
 * propager un NaN dans toute la projection.
 */
function nombres(parametres: Record<string, string>): Partial<Hypotheses> {
  const convertis: Record<string, number> = {};
  for (const [cle, valeur] of Object.entries(parametres)) {
    convertis[cle] = Number(valeur);
  }
  return convertis as Partial<Hypotheses>;
}
