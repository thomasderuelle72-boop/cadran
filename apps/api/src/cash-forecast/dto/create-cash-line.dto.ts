import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { CashCategory, CashRecurrence } from "@prisma/client";

export class CreateCashLineDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsEnum(CashCategory)
  category!: CashCategory;

  // Signé : positif = encaissement, négatif = décaissement.
  @IsNumber()
  amount!: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsEnum(CashRecurrence)
  recurrence?: CashRecurrence;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
