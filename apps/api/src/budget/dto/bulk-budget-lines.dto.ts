import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, ValidateNested } from "class-validator";
import { LinePoste } from "@prisma/client";

export class BudgetLineInputDto {
  @IsEnum(LinePoste)
  poste!: LinePoste;

  @IsNumber()
  amountBudgeted!: number;
}

export class BulkBudgetLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BudgetLineInputDto)
  items!: BudgetLineInputDto[];
}
