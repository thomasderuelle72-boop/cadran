import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { BenchmarkService } from "./benchmark.service";

/** La comparaison sectorielle d'un dossier, en lecture pour tous les rôles. */
@Controller("entities/:entityId/comparaison-sectorielle")
@UseGuards(JwtAuthGuard)
export class BenchmarkController {
  constructor(private benchmark: BenchmarkService) {}

  @Get()
  comparaison(@CurrentUser() user: AuthUser, @Param("entityId") entityId: string) {
    return this.benchmark.comparaison(user.organizationId, entityId);
  }
}
