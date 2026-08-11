import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, AdminPayload, VisitorPayload } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(
    payload: JwtPayload & { type?: string },
  ): Promise<AdminPayload | VisitorPayload> {
    if (payload.type === 'refresh') {
      throw new UnauthorizedException(
        'Refresh token tidak bisa dipakai untuk akses',
      );
    }

    if (payload.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true },
      });
      if (!admin) {
        throw new UnauthorizedException('Sesi admin tidak valid');
      }
      return { ...admin, role: 'ADMIN' };
    }

    if (payload.role === 'VISITOR') {
      const visitor = await this.prisma.visitor.findUnique({
        where: { id: payload.sub },
      });
      if (!visitor) {
        throw new UnauthorizedException('Sesi visitor tidak valid');
      }
      return { ...visitor, role: 'VISITOR' };
    }

    throw new UnauthorizedException('Role token tidak dikenali');
  }
}
