import { ActionStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { RATIO_IDS } from "../../ratios/engine";

export class CreateActionPlanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  constat!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  action!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  /**
   * Un identifiant inconnu rendrait l'action inmesurable sans que rien ne le
   * signale : on le refuse à la saisie plutôt que d'afficher « n/d » plus tard.
   */
  @IsOptional()
  @IsIn(RATIO_IDS, { message: "Ce ratio n'existe pas dans le moteur de calcul." })
  ratioId?: string;

  @IsOptional()
  @IsNumber()
  valeurInitiale?: number;

  @IsOptional()
  @IsNumber()
  valeurCible?: number;

  @IsOptional()
  @IsNumber()
  impactEstime?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;

  @IsOptional()
  @IsDateString()
  echeance?: string;
}

export class UpdateActionPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  constat?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  action?: string;

  @IsOptional()
  @IsIn(RATIO_IDS, { message: "Ce ratio n'existe pas dans le moteur de calcul." })
  ratioId?: string;

  @IsOptional()
  @IsNumber()
  valeurInitiale?: number;

  @IsOptional()
  @IsNumber()
  valeurCible?: number;

  @IsOptional()
  @IsNumber()
  impactEstime?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;

  @IsOptional()
  @IsDateString()
  echeance?: string;

  @IsOptional()
  @IsEnum(ActionStatus)
  statut?: ActionStatus;
}
