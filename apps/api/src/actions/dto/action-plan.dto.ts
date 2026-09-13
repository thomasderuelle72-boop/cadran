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
  ValidateIf,
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

/**
 * Modification partielle d'une action.
 *
 * Les champs facultatifs acceptent `null` en plus d'une valeur : c'est ce qui
 * permet de retirer une cible ou une échéance posée par erreur. Absent veut
 * dire « ne touche pas », `null` veut dire « efface » — cf. mise-a-jour.ts.
 */
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
  @ValidateIf((_, valeur) => valeur !== null)
  @IsIn(RATIO_IDS, { message: "Ce ratio n'existe pas dans le moteur de calcul." })
  ratioId?: string | null;

  @IsOptional()
  @ValidateIf((_, valeur) => valeur !== null)
  @IsNumber()
  valeurInitiale?: number | null;

  @IsOptional()
  @ValidateIf((_, valeur) => valeur !== null)
  @IsNumber()
  valeurCible?: number | null;

  @IsOptional()
  @ValidateIf((_, valeur) => valeur !== null)
  @IsNumber()
  impactEstime?: number | null;

  @IsOptional()
  @ValidateIf((_, valeur) => valeur !== null)
  @IsString()
  @MaxLength(120)
  responsable?: string | null;

  @IsOptional()
  @ValidateIf((_, valeur) => valeur !== null)
  @IsDateString()
  echeance?: string | null;

  @IsOptional()
  @IsEnum(ActionStatus)
  statut?: ActionStatus;
}
