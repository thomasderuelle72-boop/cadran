import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { OpportunitesService } from "./opportunites.service";

/**
 * Les missions à proposer, en lecture pour tous les rôles, comme le
 * portefeuille : un collaborateur doit voir ce qui attend ses dossiers.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class OpportunitesController {
  constructor(private opportunites: OpportunitesService) {}

  @Get("opportunites")
  lister(@CurrentUser() user: AuthUser) {
    return this.opportunites.lister(user.organizationId);
  }

  @Get("entities/:entityId/opportunites")
  async dossier(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string) {
    const [dossier] = await this.opportunites.lister(user.organizationId, entityId);
    return dossier;
  }
}
