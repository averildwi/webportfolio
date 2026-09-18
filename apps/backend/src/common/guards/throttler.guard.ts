import { Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { hashViewer } from '../helpers/viewer-hash.helper';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly accessSecret?: string;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Optional() private readonly jwtService?: JwtService,
    @Optional() configService?: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.accessSecret = configService?.get<string>('JWT_SECRET');
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(this.resolveTracker(req));
  }

  private resolveTracker(req: Record<string, unknown>): string {
    const url = typeof req.url === 'string' ? req.url : '';
    const method =
      typeof req.method === 'string' ? req.method.toUpperCase() : '';

    // Project view & like toggle → hash (IP + User-Agent).
    // Konsisten dengan hash yang dipakai tabel ProjectLike.
    if (url.includes('/view') || url.includes('/like/toggle')) {
      return `hash-${hashViewer(req as never)}`;
    }

    // Guestbook POST → basis Visitor supaya satu visitor tidak bisa spam
    // walau berpindah IP.
    //
    // Guard global dieksekusi SEBELUM route guard (JwtAuthGuard), jadi
    // `req.user` belum tersedia di sini dan kita harus memverifikasi token
    // sendiri. Verifikasi signature wajib: men-decode payload saja membuat
    // attacker bisa mengirim `sub` acak tiap request untuk mendapat bucket
    // baru dan mem-bypass limit sepenuhnya.
    if (url.includes('/guestbook') && method === 'POST') {
      const visitorId = this.extractVerifiedSubject(req);
      if (visitorId) return `visitor-${visitorId}`;
    }

    // Default: IP. `req.ip` dipercaya karena `trust proxy` dikonfigurasi
    // eksplisit di main.ts — header XFF mentah tidak pernah dibaca.
    return `ip-${typeof req.ip === 'string' ? req.ip : 'unknown'}`;
  }

  private extractVerifiedSubject(req: Record<string, unknown>): string | null {
    if (!this.jwtService || !this.accessSecret) return null;

    const headers = (req.headers ?? {}) as Record<string, unknown>;
    const authHeader = headers['authorization'];
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    try {
      const payload = this.jwtService.verify<{ sub?: string; type?: string }>(
        authHeader.slice(7),
        { secret: this.accessSecret },
      );

      // Refresh token tidak boleh dipakai sebagai identitas request.
      if (payload.type === 'refresh') return null;

      return payload.sub ?? null;
    } catch {
      // Token invalid/expired → jatuh ke basis IP. Request-nya sendiri akan
      // ditolak 401 oleh JwtAuthGuard setelah ini.
      return null;
    }
  }
}
