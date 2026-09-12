import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ActionStatus, Role } from "@prisma/client";
import { ActionsService } from "./actions.service";
import { CreateActionPlanDto, UpdateActionPlanDto } from "./dto/action-plan.dto";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

function lireStatut(valeur?: string): ActionStatus | undefined {
  if (!valeur) return undefined;
  if (!(valeur in ActionStatus)) {
    throw new BadRequestException(
      `Statut inconnu. Valeurs admises : ${Object.values(ActionStatus).join(", ")}.`
    );
  }
  return valeur as ActionStatus;
}

@Controller("actions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActionsController {
  constructor(private actionsService: ActionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("entityId") entityId?: string,
    @Query("statut") statut?: string
  ) {
    return this.actionsService.list(user.organizationId, entityId, lireStatut(statut));
  }

  @Get("synthese")
  synthese(@CurrentUser() user: AuthUser) {
    return this.actionsService.synthese(user.organizationId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActionPlanDto) {
    // L'auteur est pris du jeton, jamais du corps : une recommandation ne
    // doit pas pouvoir être attribuée à quelqu'un d'autre.
    return this.actionsService.create(user.organizationId, user.email, dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateActionPlanDto
  ) {
    return this.actionsService.update(user.organizationId, id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.DAF)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.actionsService.remove(user.organizationId, id);
  }
}
