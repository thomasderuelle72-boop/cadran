import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ActionStatus } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { ValeurService } from "./valeur.service";

const STATUTS = new Set<string>(Object.values(ActionStatus));

/**
 * Le bilan de valeur créée, en lecture pour tous les rôles. Les corrections
 * (gain retenu, exclusion) passent par la modification de l'action, avec ses
 * propres droits.
 */
@Controller("valeur-creee")
@UseGuards(JwtAuthGuard)
export class ValeurController {
  constructor(private valeur: ValeurService) {}

  @Get()
  bilan(
    @CurrentUser() user: AuthUser,
    @Query("depuis") depuis?: string,
    @Query("statuts") statuts?: string,
    @Query("entityId") entityId?: string,
  ) {
    const date = depuis ? new Date(depuis) : undefined;
    if (date && Number.isNaN(date.getTime())) throw new BadRequestException("Date de début invalide (AAAA-MM-JJ).");

    /* Par défaut : les actions faites et en cours. Une action abandonnée ou
     * pas encore commencée n'a rien créé qu'on puisse revendiquer. */
    const liste = (statuts ?? "FAITE,EN_COURS").split(",").filter(Boolean);
    if (liste.length === 0 || liste.some((s) => !STATUTS.has(s))) {
      throw new BadRequestException("Statuts attendus : A_FAIRE, EN_COURS, FAITE, ABANDONNEE.");
    }

    return this.valeur.bilan(user.organizationId, {
      depuis: date,
      statuts: liste as ActionStatus[],
      entityId: entityId || undefined,
    });
  }
}
