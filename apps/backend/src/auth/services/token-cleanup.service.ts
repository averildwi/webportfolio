import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 jam

/**
 * Housekeeping tabel RefreshToken.
 *
 * Tanpa ini tabel tumbuh selamanya: setiap rotasi menambah satu baris dan
 * baris yang sudah revoked/expired tidak pernah punya pembaca lagi.
 *
 * Memakai `setInterval` alih-alih `@nestjs/schedule` secara sengaja: versi
 * terbaru paket itu ESM-only, yang memaksa Node >= 22.12 dan memecah runner
 * test berbasis CommonJS — harga yang terlalu mahal untuk satu job periodik.
 */
@Injectable()
export class TokenCleanupService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(TokenCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly refreshTokenService: RefreshTokenService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.purgeExpiredTokens();
    }, CLEANUP_INTERVAL_MS);

    // Jangan menahan event loop tetap hidup hanya karena timer ini.
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async purgeExpiredTokens(): Promise<void> {
    try {
      const removed = await this.refreshTokenService.purgeExpired();
      if (removed > 0) {
        this.logger.log(`Menghapus ${removed} refresh token kedaluwarsa`);
      }
    } catch (err) {
      // Cleanup gagal tidak boleh menjatuhkan aplikasi.
      this.logger.error(
        `Cleanup refresh token gagal: ${(err as Error).message}`,
      );
    }
  }
}
