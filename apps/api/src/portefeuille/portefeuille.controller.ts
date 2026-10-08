import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { PortefeuilleService } from "./portefeuille.service";

/**
 * Le portefeuille de l'organisation, en lecture pour tous les rôles : un
 * collaborateur doit savoir quels dossiers l'attendent, même s'il ne peut
 * rien y modifier.
 */
@Controller("portefeuille")
@UseGuards(JwtAuthGuard)
export class PortefeuilleController {
  constructor(private portefeuille: PortefeuilleService) {}

  @Get()
  lister(@CurrentUser() user: AuthUser) {
    return this.portefeuille.lister(user.organizationId);
  }
}
