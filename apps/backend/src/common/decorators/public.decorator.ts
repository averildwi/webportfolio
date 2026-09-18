import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Menandai route sebagai dapat diakses tanpa autentikasi.
 *
 * Autentikasi berlaku secara global (lihat `JwtAuthGuard` di `APP_GUARD`),
 * jadi route baru tertutup secara default dan endpoint yang lupa dipasangi
 * guard gagal secara aman — bukan terbuka. Konsekuensinya, setiap route publik
 * harus menyatakan dirinya publik secara eksplisit.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
