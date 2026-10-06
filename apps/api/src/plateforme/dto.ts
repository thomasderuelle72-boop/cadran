import { PlanId, StatutAbonnement } from "@prisma/client";
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

/*
 * Les valeurs admissibles sont écrites ici en toutes lettres plutôt que
 * dérivées de l'enum Prisma : `forbidNonWhitelisted` rejette ce qui n'est pas
 * déclaré, et une formule inventée dans le corps de la requête n'arrive donc
 * jamais jusqu'à la base.
 */
const PLANS: PlanId[] = ["essai", "solo", "cabinet", "groupe"];
const STATUTS: StatutAbonnement[] = ["essai", "actif", "impaye", "resilie", "incomplet"];

export class ChangerFormuleDto {
  @IsOptional()
  @IsIn(PLANS)
  plan?: PlanId;

  @IsOptional()
  @IsIn(STATUTS)
  statut?: StatutAbonnement;

  /** `null` efface l'échéance ; absent la laisse telle quelle. */
  @IsOptional()
  @IsISO8601()
  finPeriode?: string | null;
}

export class SupprimerOrganisationDto {
  /** Le nom exact de l'organisation : voir plateforme.service.ts. */
  @IsString()
  @MaxLength(200)
  nom!: string;
}

export class DroitPlateformeDto {
  @IsBoolean()
  accorde!: boolean;
}
