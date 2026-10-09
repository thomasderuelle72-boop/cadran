import { Body, Controller, Delete, Get, Param, Put, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { PreferencesService } from "./preferences.service";

/**
 * Les modèles du cabinet. Tout le monde les lit — c'est ce qui rend les
 * écrans identiques d'un collaborateur à l'autre ; seuls l'administrateur et
 * le directeur financier les changent, comme les autres paramètres.
 */
@Controller("preferences")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreferencesController {
  constructor(private preferences: PreferencesService) {}

  @Get(":cle")
  lire(@CurrentUser() user: AuthUser, @Param("cle") cle: string) {
    return this.preferences.lire(user.organizationId, cle);
  }

  @Put(":cle")
  @Roles(Role.ADMIN, Role.DAF)
  enregistrer(@CurrentUser() user: AuthUser, @Param("cle") cle: string, @Body() corps: unknown) {
    return this.preferences.enregistrer(user.organizationId, cle, corps);
  }

  @Delete(":cle")
  @Roles(Role.ADMIN, Role.DAF)
  effacer(@CurrentUser() user: AuthUser, @Param("cle") cle: string) {
    return this.preferences.effacer(user.organizationId, cle);
  }
}
