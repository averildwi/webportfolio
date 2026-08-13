import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from '../common/hashing/hashing.service';
import { LoginDto } from './dto/login.dto';
import {
  JwtPayload,
  OAuthUserPayload,
  TokenPair,
  AdminPayload,
  VisitorPayload,
} from './types/auth.types';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly dummyHash: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly allowedRedirectOrigins: string[];

  constructor(
    private prisma: PrismaService,
    private hashingService: HashingService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.dummyHash = this.hashingService.hash(randomBytes(16).toString('hex'));
    this.accessTokenExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    this.refreshTokenExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    this.refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.allowedRedirectOrigins = frontendUrl
      .split(',')
      .map((url) => url.trim());
  }

  async loginAdmin(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      this.hashingService.verify(dto.password, this.dummyHash);
      throw new UnauthorizedException('Email atau password salah');
    }

    const isPasswordValid = this.hashingService.verify(
      dto.password,
      admin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const tokens = this.generateTokenPair({
      sub: admin.id,
      email: admin.email,
      role: 'ADMIN',
    });

    return {
      ...tokens,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    };
  }

  async validateOAuthVisitor(payload: OAuthUserPayload): Promise<TokenPair> {
    const { provider, providerId, name, email, avatarUrl } = payload;

    const visitor = await this.prisma.visitor.upsert({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
      update: {
        name,
        email: email || undefined,
        avatarUrl: avatarUrl || undefined,
      },
      create: {
        provider,
        providerId,
        name,
        email,
        avatarUrl,
      },
    });

    return this.generateTokenPair({ sub: visitor.id, role: 'VISITOR' });
  }

  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload & { type: string };

    try {
      payload = this.jwtService.verify<JwtPayload & { type: string }>(
        refreshToken,
        { secret: this.refreshSecret },
      );
    } catch (err) {
      this.logger.warn(`Refresh token verify gagal: ${(err as Error).message}`);
      throw new UnauthorizedException('Refresh token tidak valid atau expired');
    }

    if (payload.type !== 'refresh') {
      this.logger.warn(
        `Refresh token dengan type tidak valid: ${payload.type}`,
      );
      throw new UnauthorizedException('Token tidak valid');
    }

    if (payload.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true },
      });
      if (!admin) throw new UnauthorizedException('Sesi admin tidak valid');

      return this.generateTokenPair({
        sub: admin.id,
        email: admin.email,
        role: 'ADMIN',
      });
    }

    if (payload.role === 'VISITOR') {
      const visitor = await this.prisma.visitor.findUnique({
        where: { id: payload.sub },
      });
      if (!visitor) throw new UnauthorizedException('Sesi visitor tidak valid');

      return this.generateTokenPair({ sub: visitor.id, role: 'VISITOR' });
    }

    this.logger.warn(`Role token tidak dikenali: ${payload.role}`);
    throw new UnauthorizedException('Role token tidak dikenali');
  }

  async getAdminProfile(userId: string): Promise<AdminPayload> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!admin) throw new UnauthorizedException('Admin tidak ditemukan');
    return { ...admin, role: 'ADMIN' };
  }

  async getVisitorProfile(userId: string): Promise<VisitorPayload> {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: userId },
    });
    if (!visitor) throw new UnauthorizedException('Visitor tidak ditemukan');
    return { ...visitor, role: 'VISITOR' };
  }

  getValidatedRedirectUrl(requestedOrigin?: string): string {
    if (
      requestedOrigin &&
      this.allowedRedirectOrigins.includes(requestedOrigin)
    ) {
      return requestedOrigin;
    }
    return this.allowedRedirectOrigins[0];
  }

  private generateTokenPair(payload: {
    sub: string;
    role: string;
    email?: string;
  }): TokenPair {
    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: this.accessTokenExpiresIn as any },
    );

    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, role: payload.role, type: 'refresh' },
      {
        expiresIn: this.refreshTokenExpiresIn as any,
        secret: this.refreshSecret,
      },
    );

    return { accessToken, refreshToken };
  }
}
