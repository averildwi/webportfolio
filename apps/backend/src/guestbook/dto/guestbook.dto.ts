import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { GuestbookStatus } from 'generated/prisma/client';

export class CreateGuestbookDto {
  @ApiProperty({ example: 'Cool portfolio! Keep it up!' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  message: string;
}

export class UpdateGuestbookStatusDto {
  @ApiProperty({ enum: GuestbookStatus, example: 'APPROVED' })
  @IsNotEmpty()
  @IsEnum(GuestbookStatus)
  status: GuestbookStatus;
}
