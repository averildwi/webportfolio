import { createHash } from 'node:crypto';

/**
 * Hash identitas pengunjung anonim (IP + User-Agent) untuk deduplikasi
 * like/view dan sebagai tracker rate limit.
 *
 * Sengaja memakai `req.ip` dan BUKAN header `x-forwarded-for` mentah.
 * Express mengisi `req.ip` dari XFF hanya bila `trust proxy` dikonfigurasi
 * (lihat `main.ts`), sehingga client tidak bisa memalsukan identitasnya
 * untuk mem-bypass rate limit atau menggelembungkan like count.
 */
export function hashViewer(req: {
  ip?: string;
  headers: Record<string, unknown>;
}): string {
  const ip = req.ip || 'unknown';
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : '';

  return createHash('sha256').update(`${ip}:${userAgent}`).digest('hex');
}
