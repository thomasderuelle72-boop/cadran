import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, ValidateNested } from "class-validator";
import { LinePoste } from "@prisma/client";

export class BudgetLineInputDto {
  @IsEnum(LinePoste)
  poste!: LinePoste;

  @IsNumber()
  amountBudgeted!: number;
}

export class BulkBudgetLinesDto {
  // Un tableau vide est une valeur légitime : c'est le seul moyen de vider
  // un budget déjà enregistré (BudgetService.replace supprime d'abord toutes
  // les lignes existantes avant de recréer celles fournies ici).
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineInputDto)
  items!: BudgetLineInputDto[];
}
