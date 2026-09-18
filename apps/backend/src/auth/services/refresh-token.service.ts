import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { TokenOwner } from 'generated/prisma/client';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  newFamilyId(): string {
    return randomUUID();
  }

  async persist(params: {
    token: string;
    owner: TokenOwner;
    subjectId: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: RefreshTokenService.hash(params.token),
        owner: params.owner,
        subjectId: params.subjectId,
        familyId: params.familyId,
        expiresAt: params.expiresAt,
      },
    });
  }

  async consume(token: string): Promise<{ familyId: string } | null> {
    const tokenHash = RefreshTokenService.hash(token);

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        familyId: true,
        revokedAt: true,
        expiresAt: true,
        subjectId: true,
      },
    });

    if (!record) return null;

    if (record.revokedAt) {
      this.logger.warn(
        `Reuse refresh token terdeteksi (subject: ${record.subjectId}) — mencabut seluruh family ${record.familyId}`,
      );
      await this.revokeFamily(record.familyId);
      return null;
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (claimed.count === 0) {
      await this.revokeFamily(record.familyId);
      return null;
    }

    return { familyId: record.familyId };
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForSubject(
    owner: TokenOwner,
    subjectId: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { owner, subjectId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
