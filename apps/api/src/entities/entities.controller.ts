import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { EntitiesService } from "./entities.service";
import { CreateEntityDto } from "./dto/create-entity.dto";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

@Controller("entities")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EntitiesController {
  constructor(private entitiesService: EntitiesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.entitiesService.list(user.organizationId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DAF)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEntityDto) {
    return this.entitiesService.create(user.organizationId, dto);
  }
}
