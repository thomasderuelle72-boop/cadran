import { BadRequestException, Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AnalysisService } from "./analysis.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { DELAI_PAIEMENT_DEFAUT_JOURS, type SensTiers } from "./encours";

function lireSens(valeur?: string): SensTiers {
  const normalise = (valeur ?? "CLIENT").toUpperCase();
  if (normalise !== "CLIENT" && normalise !== "FOURNISSEUR") {
    throw new BadRequestException("Le sens doit valoir CLIENT ou FOURNISSEUR.");
  }
  return normalise;
}

function lireDate(valeur: string | undefined, nom: string): Date | undefined {
  if (!valeur) return undefined;
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`Date ${nom} illisible.`);
  return date;
}

function lireDelai(valeur?: string): number {
  if (!valeur) return DELAI_PAIEMENT_DEFAUT_JOURS;
  const jours = Number(valeur);
  if (!Number.isFinite(jours) || jours < 0 || jours > 365) {
    throw new BadRequestException("Le délai de paiement doit être compris entre 0 et 365 jours.");
  }
  return jours;
}

@Controller("analysis")
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(private analysisService: AnalysisService) {}

  @Get("sig/:periodId")
  sig(@CurrentUser() user: AuthUser, @Param("periodId") periodId: string) {
    return this.analysisService.sig(user.organizationId, periodId);
  }

  @Get("diagnostic/:periodId")
  diagnostic(@CurrentUser() user: AuthUser, @Param("periodId") periodId: string) {
    return this.analysisService.diagnostic(user.organizationId, periodId);
  }

  @Get("flux/:periodId")
  flux(@CurrentUser() user: AuthUser, @Param("periodId") periodId: string) {
    return this.analysisService.flux(user.organizationId, periodId);
  }

  @Get("encours")
  encours(
    @CurrentUser() user: AuthUser,
    @Query("entityId") entityId: string,
    @Query("sens") sens?: string,
    @Query("date") date?: string,
    @Query("delai") delai?: string
  ) {
    if (!entityId) throw new BadRequestException("entityId est requis.");
    return this.analysisService.balanceAgee(
      user.organizationId,
      entityId,
      lireSens(sens),
      lireDate(date, "de référence"),
      lireDelai(delai)
    );
  }

  @Get("concentration")
  concentration(
    @CurrentUser() user: AuthUser,
    @Query("entityId") entityId: string,
    @Query("sens") sens?: string,
    @Query("debut") debut?: string,
    @Query("fin") fin?: string
  ) {
    if (!entityId) throw new BadRequestException("entityId est requis.");
    return this.analysisService.concentration(
      user.organizationId,
      entityId,
      lireSens(sens),
      lireDate(debut, "de début"),
      lireDate(fin, "de fin")
    );
  }
}
