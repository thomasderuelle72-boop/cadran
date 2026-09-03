import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { ConsolidationService } from "./consolidation.service";

@Controller("consolidation")
@UseGuards(JwtAuthGuard)
export class ConsolidationController {
  constructor(private consolidationService: ConsolidationService) {}

  @Get("groups")
  listGroups(@CurrentUser() user: AuthUser) {
    return this.consolidationService.listGroups(user.organizationId);
  }

  @Get("ratios")
  getRatios(
    @CurrentUser() user: AuthUser,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException("startDate et endDate sont requis.");
    }
    return this.consolidationService.getConsolidatedRatios(user.organizationId, startDate, endDate);
  }
}
