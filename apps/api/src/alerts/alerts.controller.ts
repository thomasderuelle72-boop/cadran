import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AlertsService } from "./alerts.service";
import { CreateAlertRuleDto } from "./dto/create-alert-rule.dto";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get("alert-rules")
  listRules(@CurrentUser() user: AuthUser) {
    return this.alertsService.listRules(user.organizationId);
  }

  @Post("alert-rules")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  createRule(@CurrentUser() user: AuthUser, @Body() dto: CreateAlertRuleDto) {
    return this.alertsService.createRule(user.organizationId, dto);
  }

  @Delete("alert-rules/:id")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  deleteRule(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.alertsService.deleteRule(user.organizationId, id);
  }

  @Get("alerts")
  listEvents(@CurrentUser() user: AuthUser) {
    return this.alertsService.listEvents(user.organizationId);
  }

  @Patch("alerts/:id/acknowledge")
  acknowledge(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.alertsService.acknowledge(user.organizationId, id);
  }
}
