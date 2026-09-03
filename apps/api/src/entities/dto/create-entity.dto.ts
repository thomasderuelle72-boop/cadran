import { IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateEntityDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  fxRateToOrgCurrency?: number;
}
