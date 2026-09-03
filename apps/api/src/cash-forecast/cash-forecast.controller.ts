import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CashCategory, Role } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { CashForecastService, CASH_CATEGORY_LABELS } from "./cash-forecast.service";
import { CreateCashLineDto } from "./dto/create-cash-line.dto";

@Controller("entities/:entityId/cash-forecast")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashForecastController {
  constructor(private service: CashForecastService) {}

  @Get()
  projection(
    @CurrentUser() user: AuthUser,
    @Param("entityId") entityId: string,
    @Query("weeks") weeks?: string
  ) {
    const horizon = Math.min(52, Math.max(4, Number(weeks) || 13));
    return this.service.getProjection(user.organizationId, entityId, horizon);
  }

  @Get("categories")
  categories() {
    return Object.values(CashCategory).map((category) => ({ category, label: CASH_CATEGORY_LABELS[category] }));
  }

  @Get("lines")
  lines(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string) {
    return this.service.listLines(user.organizationId, entityId);
  }

  @Post("lines")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  createLine(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string, @Body() dto: CreateCashLineDto) {
    return this.service.createLine(user.organizationId, entityId, dto);
  }

  @Delete("lines/:lineId")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  deleteLine(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string, @Param("lineId") lineId: string) {
    return this.service.deleteLine(user.organizationId, entityId, lineId);
  }

  @Post("prefill")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  prefill(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string) {
    return this.service.prefillFromLatestPeriod(user.organizationId, entityId);
  }
}
