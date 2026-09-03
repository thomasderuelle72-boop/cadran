import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  // Consultation réservée aux rôles qui répondent de la conformité : la piste
  // d'audit expose qui a touché à quoi dans toute l'organisation.
  @Get()
  @Roles(Role.ADMIN, Role.DAF)
  list(@CurrentUser() user: AuthUser, @Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    const size = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.auditService.list(user.organizationId, size, cursor);
  }
}
