import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PeriodsService } from "./periods.service";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { BulkLineItemsDto } from "./dto/bulk-line-items.dto";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

@Controller("periods")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodsController {
  constructor(private periodsService: PeriodsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.periodsService.list(user.organizationId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.periodsService.getOrThrow(user.organizationId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePeriodDto) {
    return this.periodsService.create(user.organizationId, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.periodsService.remove(user.organizationId, id);
  }

  @Get(":id/line-items")
  listLineItems(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.periodsService.listLineItems(user.organizationId, id);
  }

  @Post(":id/line-items/bulk")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  replaceLineItems(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: BulkLineItemsDto
  ) {
    return this.periodsService.replaceLineItems(user.organizationId, id, dto);
  }
}
