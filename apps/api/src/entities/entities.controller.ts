import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { EntitiesService } from "./entities.service";
import { CreateEntityDto } from "./dto/create-entity.dto";
import { SupprimerEntityDto } from "./dto/supprimer-entity.dto";
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

  @Post("demonstration")
  @HttpCode(200)
  @Roles(Role.ADMIN, Role.DAF)
  demonstration(@CurrentUser() user: AuthUser) {
    return this.entitiesService.demonstration(user.organizationId);
  }

  /** Réservé à l'administrateur : la suppression emporte toutes les données
   *  du dossier, sans retour possible. */
  @Delete(":id")
  @Roles(Role.ADMIN)
  supprimer(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SupprimerEntityDto) {
    return this.entitiesService.supprimer(user.organizationId, id, dto.nom);
  }
}
