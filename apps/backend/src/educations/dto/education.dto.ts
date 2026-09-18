import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateEducationDto {
  @ApiProperty({ example: 'Universitas Brawijaya' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  institution: string;

  @ApiProperty({ example: 'S1' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  degree: string;

  @ApiProperty({ example: 'Teknik Informatika' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  fieldOfStudy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: '2022-08-01T00:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Null jika masih menempuh pendidikan',
    example: '2026-08-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateEducationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  degree?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fieldOfStudy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Kirim null untuk menandai kembali "masih menempuh"',
    nullable: true,
  })
  // ValidateIf (bukan IsOptional) supaya `null` eksplisit lolos validasi dan
  // bisa dibedakan dari field yang tidak dikirim.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
