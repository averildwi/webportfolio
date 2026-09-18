import { AuthService } from './auth.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HashingService } from '../common/hashing/hashing.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TokenPair } from './types/auth.types';

/** Akses ke helper privat yang diuji langsung. */
type IssueTokenPair = (params: {
  subjectId: string;
  owner: 'ADMIN' | 'VISITOR';
  email?: string;
  familyId?: string;
}) => Promise<TokenPair>;

/**
 * Regresi: refresh token harus unik antar penerbitan.
 *
 * Klaim `iat`/`exp` hanya berpresisi detik, jadi dua token dengan payload sama
 * yang diterbitkan dalam detik yang sama akan identik byte per byte. Karena
 * `RefreshToken.tokenHash` bersifat unique, login atau refresh beruntun
 * menabrak constraint (Prisma P2002 -> HTTP 409) — dan lebih buruk, dua sesi
 * berbeda akan berbagi token yang sama persis.
 */
describe('AuthService — keunikan token', () => {
  const secret = 'a'.repeat(32);

  const config = new ConfigService({
    JWT_SECRET: secret,
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    FRONTEND_URL: 'http://localhost:3001',
  });

  function createService(): { issue: IssueTokenPair; persisted: string[] } {
    const persisted: string[] = [];

    const prisma = {
      admin: { findUnique: () => Promise.resolve(null) },
      visitor: { findUnique: () => Promise.resolve(null) },
    } as unknown as PrismaService;

    const refreshTokens = {
      persist: ({ token }: { token: string }) => {
        // Tiru unique constraint pada tokenHash.
        const hash = RefreshTokenService.hash(token);
        if (persisted.includes(hash)) {
          throw new Error('UNIQUE violation on tokenHash');
        }
        persisted.push(hash);
        return Promise.resolve();
      },
      newFamilyId: () => 'family-tetap',
    } as unknown as RefreshTokenService;

    const service = new AuthService(
      prisma,
      new HashingService(),
      new JwtService({ secret }),
      config,
      refreshTokens,
    );

    const issue: IssueTokenPair = (
      service as unknown as { issueTokenPair: IssueTokenPair }
    ).issueTokenPair.bind(service) as IssueTokenPair;

    return { issue, persisted };
  }

  it('menerbitkan refresh token berbeda untuk subject yang sama dalam detik yang sama', async () => {
    const { issue, persisted } = createService();

    const first = await issue({ subjectId: 'admin-1', owner: 'ADMIN' });
    const second = await issue({ subjectId: 'admin-1', owner: 'ADMIN' });
    const third = await issue({ subjectId: 'admin-1', owner: 'ADMIN' });

    expect(first.refreshToken).not.toBe(second.refreshToken);
    expect(second.refreshToken).not.toBe(third.refreshToken);
    expect(first.accessToken).not.toBe(second.accessToken);

    // Tidak ada tabrakan unique constraint.
    expect(persisted).toHaveLength(3);
    expect(new Set(persisted).size).toBe(3);
  });

  it('menyertakan jti yang berbeda pada access dan refresh token', async () => {
    const { issue } = createService();
    const jwt = new JwtService({ secret });

    const pair = await issue({ subjectId: 'admin-1', owner: 'ADMIN' });

    const access = jwt.decode<{ jti?: string }>(pair.accessToken);
    const refresh = jwt.decode<{ jti?: string }>(pair.refreshToken);

    expect(access.jti).toBeTruthy();
    expect(refresh.jti).toBeTruthy();
    expect(access.jti).not.toBe(refresh.jti);
  });
});
