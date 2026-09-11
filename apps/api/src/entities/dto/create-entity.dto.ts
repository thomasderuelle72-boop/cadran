import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min, MinLength } from "class-validator";

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

  /** Code d'activité principal : quatre chiffres et une lettre, « 2599B ». */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}[A-Za-z]$/, { message: "Le code NAF doit s'écrire sous la forme 2599B." })
  nafCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  headcount?: number;
}
