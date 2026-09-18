import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from '../common/hashing/hashing.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { LoginDto } from './dto/login.dto';
import {
  JwtPayload,
  OAuthUserPayload,
  TokenPair,
  AdminPayload,
  VisitorPayload,
} from './types/auth.types';
import { randomBytes, randomUUID } from 'node:crypto';
import type { TokenOwner } from 'generated/prisma/client';

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
    private refreshTokenService: RefreshTokenService,
  ) {
    this.dummyHash = this.hashingService.hash(randomBytes(16).toString('hex'));
    this.accessTokenExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    this.refreshTokenExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    this.refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    this.allowedRedirectOrigins = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
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

    const tokens = await this.issueTokenPair({
      subjectId: admin.id,
      owner: 'ADMIN',
      email: admin.email,
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

    return this.issueTokenPair({
      subjectId: visitor.id,
      owner: 'VISITOR',
    });
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
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

    const consumed = await this.refreshTokenService.consume(refreshToken);
    if (!consumed) {
      throw new UnauthorizedException(
        'Refresh token sudah tidak berlaku, silakan login ulang',
      );
    }

    if (payload.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true },
      });
      if (!admin) {
        await this.refreshTokenService.revokeFamily(consumed.familyId);
        throw new UnauthorizedException('Sesi admin tidak valid');
      }

      return this.issueTokenPair({
        subjectId: admin.id,
        owner: 'ADMIN',
        email: admin.email,
        familyId: consumed.familyId,
      });
    }

    if (payload.role === 'VISITOR') {
      const visitor = await this.prisma.visitor.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!visitor) {
        await this.refreshTokenService.revokeFamily(consumed.familyId);
        throw new UnauthorizedException('Sesi visitor tidak valid');
      }

      return this.issueTokenPair({
        subjectId: visitor.id,
        owner: 'VISITOR',
        familyId: consumed.familyId,
      });
    }

    await this.refreshTokenService.revokeFamily(consumed.familyId);
    this.logger.warn(`Role token tidak dikenali: ${String(payload.role)}`);
    throw new UnauthorizedException('Role token tidak dikenali');
  }

  async revokeRefreshToken(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload = this.jwtService.verify<{ type?: string }>(refreshToken, {
        secret: this.refreshSecret,
      });
      if (payload.type !== 'refresh') return;
    } catch {
      return;
    }

    const consumed = await this.refreshTokenService.consume(refreshToken);
    if (consumed) {
      await this.refreshTokenService.revokeFamily(consumed.familyId);
    }
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

  get refreshTokenTtlMs(): number {
    return AuthService.parseDurationMs(this.refreshTokenExpiresIn);
  }

  private async issueTokenPair(params: {
    subjectId: string;
    owner: TokenOwner;
    email?: string;
    familyId?: string;
  }): Promise<TokenPair> {
    const { subjectId, owner, email, familyId } = params;

    // `jti` wajib ada. Tanpa itu, dua token dengan payload sama yang
    // diterbitkan pada detik yang sama menghasilkan JWT yang identik byte per
    // byte, karena klaim `iat`/`exp` hanya berpresisi detik. Akibatnya login
    // atau refresh beruntun menabrak unique constraint pada `tokenHash`
    // (Prisma P2002 -> HTTP 409), dan dua sesi berbeda akan berbagi token
    // yang sama persis.
    const accessToken: string = this.jwtService.sign(
      {
        sub: subjectId,
        role: owner,
        ...(email && { email }),
        type: 'access',
        jti: randomUUID(),
      },
      { expiresIn: this.accessTokenExpiresIn as unknown as number },
    );

    const refreshToken: string = this.jwtService.sign(
      { sub: subjectId, role: owner, type: 'refresh', jti: randomUUID() },
      {
        expiresIn: this.refreshTokenExpiresIn as unknown as number,
        secret: this.refreshSecret,
      },
    );

    await this.refreshTokenService.persist({
      token: refreshToken,
      owner,
      subjectId,
      familyId: familyId ?? this.refreshTokenService.newFamilyId(),
      expiresAt: new Date(Date.now() + this.refreshTokenTtlMs),
    });

    return { accessToken, refreshToken };
  }

  static parseDurationMs(value: string): number {
    const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/.exec(value.trim());
    if (!match) {
      throw new Error(`Format durasi tidak valid: "${value}"`);
    }

    const amount = Number(match[1]);
    const unit = match[2] ?? 's';

    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };

    return amount * multipliers[unit];
  }
}
