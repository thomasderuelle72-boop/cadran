import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { ConsolidationService } from "./consolidation.service";
import { BillingService } from "../billing/billing.service";

@Controller("consolidation")
@UseGuards(JwtAuthGuard)
export class ConsolidationController {
  constructor(
    private consolidationService: ConsolidationService,
    private billing: BillingService
  ) {}

  /*
   * Le garde porte sur les deux routes, pas seulement sur les ratios.
   *
   * La liste des groupes est déjà de la consolidation : elle révèle le
   * périmètre que le client a constitué. Et une seule route laissée ouverte
   * suffit à rendre la restriction décorative — c'est précisément ce qui
   * s'était passé ici, où `exigerFonction` existait sans qu'aucun appelant ne
   * l'invoque : la page de tarifs annonçait la consolidation à partir de
   * Cabinet, et l'essai y accédait.
   */
  @Get("groups")
  async listGroups(@CurrentUser() user: AuthUser) {
    await this.exiger(user);
    return this.consolidationService.listGroups(user.organizationId);
  }

  @Get("ratios")
  async getRatios(
    @CurrentUser() user: AuthUser,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException("startDate et endDate sont requis.");
    }
    await this.exiger(user);
    return this.consolidationService.getConsolidatedRatios(user.organizationId, startDate, endDate);
  }

  private exiger(user: AuthUser) {
    return this.billing.exigerFonction(
      user.organizationId,
      "consolidation",
      user.administrateurPlateforme
    );
  }
}
