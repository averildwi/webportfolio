import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Autentikasi JWT, didaftarkan global lewat `APP_GUARD`.
 *
 * Dijadikan global secara sengaja: sebelumnya setiap handler terproteksi harus
 * menuliskan `@UseGuards(JwtAuthGuard, RolesGuard)` sendiri di ~40 tempat, dan
 * satu handler yang lupa berarti endpoint terbuka tanpa ada yang menandai.
 * Dengan default tertutup, kelalaian berujung 401 — gagal secara aman.
 *
 * Route publik menyatakan diri dengan `@Public()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }
}
