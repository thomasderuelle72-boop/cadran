import { IsDateString, IsString, MinLength } from "class-validator";

export class CreatePeriodDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
