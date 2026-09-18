import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FeaturedPaginationDto, PaginationDto } from './pagination.dto';

/** Meniru opsi global ValidationPipe agar test mencerminkan perilaku runtime. */
const toDto = <T>(cls: new () => T, query: Record<string, unknown>): T =>
  plainToInstance(cls, query, { enableImplicitConversion: true });

describe('PaginationDto', () => {
  it('memakai default page=1 limit=20 saat query kosong', () => {
    const dto = toDto(PaginationDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.skip).toBe(0);
  });

  it('mengonversi string query menjadi number dan menghitung skip', () => {
    const dto = toDto(PaginationDto, { page: '3', limit: '10' });
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
    expect(dto.skip).toBe(20);
  });

  it('menolak limit di atas batas maksimum', () => {
    const errors = validateSync(toDto(PaginationDto, { limit: '9999' }));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('menolak page nol atau negatif (mencegah skip negatif)', () => {
    expect(validateSync(toDto(PaginationDto, { page: '0' }))).toHaveLength(1);
    expect(validateSync(toDto(PaginationDto, { page: '-5' }))).toHaveLength(1);
  });

  it('menolak nilai non-numerik', () => {
    expect(validateSync(toDto(PaginationDto, { page: 'abc' }))).toHaveLength(1);
  });
});

describe('FeaturedPaginationDto', () => {
  it('membedakan featured yang tidak dikirim dari featured=false', () => {
    expect(toDto(FeaturedPaginationDto, {}).featured).toBeUndefined();
    expect(toDto(FeaturedPaginationDto, { featured: 'false' }).featured).toBe(
      false,
    );
    expect(toDto(FeaturedPaginationDto, { featured: 'true' }).featured).toBe(
      true,
    );
  });

  it('menerima bentuk 1/0', () => {
    expect(toDto(FeaturedPaginationDto, { featured: '1' }).featured).toBe(true);
    expect(toDto(FeaturedPaginationDto, { featured: '0' }).featured).toBe(
      false,
    );
  });

  it('menolak nilai boolean yang tidak dikenali alih-alih diam-diam jadi true', () => {
    // Tanpa transform khusus, enableImplicitConversion membuat
    // Boolean('maybe') === true — bug senyap yang mengubah hasil filter.
    const dto = toDto(FeaturedPaginationDto, { featured: 'maybe' });
    expect(validateSync(dto)).toHaveLength(1);
  });

  it('mewarisi validasi pagination', () => {
    expect(
      validateSync(toDto(FeaturedPaginationDto, { limit: '500' })),
    ).toHaveLength(1);
  });
});
