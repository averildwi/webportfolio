import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ContactStatus } from 'generated/prisma/client';

export class CreateContactDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'PT Example' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiProperty({ example: 'Collaboration Offer' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: "Hi Averil, I'd like to discuss..." })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message: string;
}

export class UpdateContactStatusDto {
  @ApiProperty({ enum: ContactStatus, example: 'REPLIED' })
  @IsNotEmpty()
  @IsEnum(ContactStatus)
  status: ContactStatus;
}
