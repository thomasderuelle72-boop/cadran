import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsString, MinLength, ValidateNested } from "class-validator";
import { LinePoste } from "@prisma/client";

export class LineItemInputDto {
  @IsString()
  @MinLength(1)
  accountCode!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsNumber()
  amount!: number;

  @IsEnum(LinePoste)
  poste!: LinePoste;
}

export class BulkLineItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemInputDto)
  items!: LineItemInputDto[];
}
