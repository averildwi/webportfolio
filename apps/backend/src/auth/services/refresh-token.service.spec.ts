import { RefreshTokenService } from './refresh-token.service';
import type { PrismaService } from '../../prisma/prisma.service';

type RefreshTokenRow = {
  id: string;
  familyId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  subjectId: string;
};

function createPrismaMock(rows: RefreshTokenRow[]) {
  return {
    refreshToken: {
      findUnique: ({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(rows.find((r) => r.id === where.tokenHash) ?? null),

      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<RefreshTokenRow>;
      }) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return Promise.resolve(row);
      },

      updateMany: ({
        where,
        data,
      }: {
        where: { id?: string; familyId?: string; revokedAt?: null };
        data: Partial<RefreshTokenRow>;
      }) => {
        const matched = rows.filter((r) => {
          if (where.id !== undefined && r.id !== where.id) return false;
          if (where.familyId !== undefined && r.familyId !== where.familyId) {
            return false;
          }
          if (where.revokedAt === null && r.revokedAt !== null) return false;
          return true;
        });
        matched.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: matched.length });
      },

      create: () => Promise.resolve({}),
      deleteMany: () => Promise.resolve({ count: 0 }),
    },
  };
}

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

describe('RefreshTokenService', () => {
  const rawToken = 'token-abc';
  const tokenHash = RefreshTokenService.hash(rawToken);

  it('hash bersifat deterministik dan tidak mengandung plaintext', () => {
    expect(RefreshTokenService.hash(rawToken)).toBe(tokenHash);
    expect(tokenHash).not.toContain(rawToken);
    expect(tokenHash).toHaveLength(64);
  });

  it('consume mengembalikan familyId untuk token aktif', async () => {
    const rows: RefreshTokenRow[] = [
      {
        id: tokenHash,
        familyId: 'fam-1',
        revokedAt: null,
        expiresAt: future(),
        subjectId: 'user-1',
      },
    ];
    const prisma = createPrismaMock(rows);
    const service = new RefreshTokenService(prisma as unknown as PrismaService);

    await expect(service.consume(rawToken)).resolves.toEqual({
      familyId: 'fam-1',
    });
    expect(rows[0].revokedAt).not.toBeNull();
  });

  it('consume menolak token yang tidak dikenal', async () => {
    const prisma = createPrismaMock([]);
    const service = new RefreshTokenService(prisma as unknown as PrismaService);

    await expect(service.consume(rawToken)).resolves.toBeNull();
  });

  it('consume menolak token kedaluwarsa dan menandainya revoked', async () => {
    const rows: RefreshTokenRow[] = [
      {
        id: tokenHash,
        familyId: 'fam-1',
        revokedAt: null,
        expiresAt: past(),
        subjectId: 'user-1',
      },
    ];
    const prisma = createPrismaMock(rows);
    const service = new RefreshTokenService(prisma as unknown as PrismaService);

    await expect(service.consume(rawToken)).resolves.toBeNull();
    expect(rows[0].revokedAt).not.toBeNull();
  });

  it('reuse token yang sudah dirotasi mencabut SELURUH family', async () => {
    const rows: RefreshTokenRow[] = [
      {
        id: tokenHash,
        familyId: 'fam-1',
        revokedAt: past(),
        expiresAt: future(),
        subjectId: 'user-1',
      },
      {
        id: 'hash-turunan',
        familyId: 'fam-1',
        revokedAt: null,
        expiresAt: future(),
        subjectId: 'user-1',
      },
      {
        id: 'hash-family-lain',
        familyId: 'fam-2',
        revokedAt: null,
        expiresAt: future(),
        subjectId: 'user-1',
      },
    ];
    const prisma = createPrismaMock(rows);
    const service = new RefreshTokenService(prisma as unknown as PrismaService);

    await expect(service.consume(rawToken)).resolves.toBeNull();

    expect(rows[1].revokedAt).not.toBeNull();
    expect(rows[2].revokedAt).toBeNull();
  });

  it('newFamilyId menghasilkan nilai unik', () => {
    const prisma = createPrismaMock([]);
    const service = new RefreshTokenService(prisma as unknown as PrismaService);

    expect(service.newFamilyId()).not.toBe(service.newFamilyId());
  });
});
