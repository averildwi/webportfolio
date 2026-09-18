import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGuestbookDto,
  UpdateGuestbookStatusDto,
} from './dto/guestbook.dto';
import {
  paginate,
  type PaginatedResult,
} from '../common/helpers/paginate.helper';
import { NO_EXPIRE_TTL } from '../common/cache/cache.constants';

export const GUESTBOOK_CACHE_KEY = 'guestbook';
const GUESTBOOK_LIST_VERSION_KEY = `${GUESTBOOK_CACHE_KEY}:list-version`;

/** Field visitor yang boleh tampil ke publik — jangan pernah expose email. */
const PUBLIC_VISITOR_SELECT = {
  name: true,
  avatarUrl: true,
  provider: true,
} as const;

@Injectable()
export class GuestbookService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Public: approved only (paginated)
  async findAllApproved(options: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<any>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const listVersion = await this.getListVersion();
    const cacheKey = `${GUESTBOOK_CACHE_KEY}:approved:v${listVersion}:${page}:${limit}`;

    const cached = await this.cacheManager.get<PaginatedResult<any>>(cacheKey);
    if (cached) return cached;

    const where = { status: 'APPROVED' as const };

    const [total, data] = await Promise.all([
      this.prisma.guestbook.count({ where }),
      this.prisma.guestbook.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          visitor: { select: PUBLIC_VISITOR_SELECT },
        },
      }),
    ]);

    const result = paginate(data, total, page, limit);

    await this.cacheManager.set(cacheKey, result);
    return result;
  }

  // Admin: all statuses (paginated)
  async findAllAdmin(options: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<any>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.guestbook.count(),
      this.prisma.guestbook.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          visitor: { select: PUBLIC_VISITOR_SELECT },
        },
      }),
    ]);

    return paginate(data, total, page, limit);
  }

  async create(visitorId: string, dto: CreateGuestbookDto) {
    const created = await this.prisma.guestbook.create({
      data: {
        visitorId,
        message: dto.message,
      },
    });

    await this.invalidateCache();
    return created;
  }

  async updateStatus(id: string, dto: UpdateGuestbookStatusDto) {
    await this.findOne(id);

    const updated = await this.prisma.guestbook.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.guestbook.delete({
      where: { id },
    });

    await this.invalidateCache();
  }

  private async findOne(id: string) {
    const entry = await this.prisma.guestbook.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException('Pesan guestbook tidak ditemukan');
    }

    return entry;
  }

  private async invalidateCache() {
    const currentVersion = await this.getListVersion();
    await this.cacheManager.set(
      GUESTBOOK_LIST_VERSION_KEY,
      currentVersion + 1,
      NO_EXPIRE_TTL,
    );
  }

  private async getListVersion(): Promise<number> {
    const version = await this.cacheManager.get<number>(
      GUESTBOOK_LIST_VERSION_KEY,
    );
    return version ?? 1;
  }
}
