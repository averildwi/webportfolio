import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Otorisasi berbasis role, didaftarkan global lewat `APP_GUARD` setelah
 * `JwtAuthGuard` sehingga `request.user` sudah terisi saat guard ini berjalan.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Tidak ada @Roles(...) berarti route hanya butuh terautentikasi, tanpa
    // batasan role tertentu. JwtAuthGuard sudah menegakkan bagian itu.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Akses ditolak');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Kamu tidak punya akses untuk melakukan aksi ini',
      );
    }

    return true;
  }
}
