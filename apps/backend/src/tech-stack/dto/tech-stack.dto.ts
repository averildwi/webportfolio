import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TechCategory } from 'generated/prisma/client';

export class CreateTechStackDto {
  @ApiProperty({ example: 'React' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: TechCategory, example: 'FRONTEND' })
  @IsNotEmpty()
  @IsEnum(TechCategory)
  category: TechCategory;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateTechStackDto {
  @ApiPropertyOptional({ example: 'React JS' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: TechCategory, example: 'FRONTEND' })
  @IsOptional()
  @IsEnum(TechCategory)
  category?: TechCategory;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
