import { IsEnum, IsNumber, IsString, MinLength } from "class-validator";
import { AlertOperator } from "@prisma/client";

export class CreateAlertRuleDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsString()
  ratioId!: string;

  @IsEnum(AlertOperator)
  operator!: AlertOperator;

  @IsNumber()
  threshold!: number;
}
