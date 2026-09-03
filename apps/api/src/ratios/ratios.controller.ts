import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { RatiosService } from "./ratios.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class RatiosController {
  constructor(private ratiosService: RatiosService) {}

  @Get("periods/:id/ratios")
  getForPeriod(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.ratiosService.getForPeriod(user.organizationId, id);
  }

  @Get("ratios/trend")
  getTrend(@CurrentUser() user: AuthUser, @Query("entityId") entityId?: string) {
    return this.ratiosService.getTrend(user.organizationId, entityId);
  }
}
