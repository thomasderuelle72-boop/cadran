import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { BudgetService } from "./budget.service";
import { BulkBudgetLinesDto } from "./dto/bulk-budget-lines.dto";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

@Controller("periods/:periodId/budget")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param("periodId") periodId: string) {
    return this.budgetService.list(user.organizationId, periodId);
  }

  @Get("variance")
  getVariance(@CurrentUser() user: AuthUser, @Param("periodId") periodId: string) {
    return this.budgetService.getVariance(user.organizationId, periodId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  replace(@CurrentUser() user: AuthUser, @Param("periodId") periodId: string, @Body() dto: BulkBudgetLinesDto) {
    return this.budgetService.replace(user.organizationId, periodId, dto);
  }
}
