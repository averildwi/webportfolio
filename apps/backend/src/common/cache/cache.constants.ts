/**
 * TTL untuk entri cache yang tidak boleh kedaluwarsa.
 *
 * Dipakai khusus untuk counter "list version" yang menjadi bagian dari cache
 * key list. Kalau counter ini ikut TTL default (60s) ia bisa reset ke 1,
 * sehingga versi cache tidak lagi monotonik dan payload lama bisa
 * dihidupkan kembali. `0` berarti "tanpa expiry" di cache-manager v7.
 */
export const NO_EXPIRE_TTL = 0;
