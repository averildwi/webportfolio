import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Nomor halaman',
    minimum: 1,
    default: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Jumlah data per halaman',
    minimum: 1,
    maximum: 100,
    default: 20,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

/**
 * Transform query string boolean ("true"/"false"/"1"/"0") menjadi boolean.
 *
 * Membaca nilai mentah dari `obj` (bukan `value`) karena global ValidationPipe
 * memakai `enableImplicitConversion`, yang sudah menjalankan `Boolean(value)`
 * lebih dulu — dan `Boolean('false')` bernilai `true`.
 *
 * Query param yang tidak dikirim tetap `undefined` supaya filter bisa
 * dibedakan antara "tidak difilter" dan "filter false".
 */
export const TransformQueryBoolean = () =>
  Transform(({ obj, key }: { obj: unknown; key: string }) => {
    const raw = (obj as Record<string, unknown> | undefined)?.[key];

    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return raw;
  });

export class FeaturedPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter hanya item featured',
    type: Boolean,
  })
  @IsOptional()
  @TransformQueryBoolean()
  @IsBoolean()
  featured?: boolean;
}
