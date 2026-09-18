import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';
import {
  paginate,
  type PaginatedResult,
} from '../common/helpers/paginate.helper';
import { NO_EXPIRE_TTL } from '../common/cache/cache.constants';

export const ACHIEVEMENTS_CACHE_KEY = 'achievements';
const ACHIEVEMENTS_LIST_VERSION_KEY = `${ACHIEVEMENTS_CACHE_KEY}:list-version`;

@Injectable()
export class AchievementsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(options: {
    featured?: boolean;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<any>> {
    const { featured, page, limit } = options;
    const skip = (page - 1) * limit;

    const listVersion = await this.getListVersion();
    const cacheKey = `${ACHIEVEMENTS_CACHE_KEY}:list:v${listVersion}:${featured ?? 'all'}:${page}:${limit}`;

    const cached = await this.cacheManager.get<PaginatedResult<any>>(cacheKey);
    if (cached) return cached;

    const where = {
      ...(featured !== undefined && { featured }),
    };

    const [total, data] = await Promise.all([
      this.prisma.achievement.count({ where }),
      this.prisma.achievement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order: 'asc' },
      }),
    ]);

    const result = paginate(data, total, page, limit);

    await this.cacheManager.set(cacheKey, result);
    return result;
  }

  async findOne(id: string) {
    const achievement = await this.prisma.achievement.findUnique({
      where: { id },
    });

    if (!achievement) {
      throw new NotFoundException('Achievement tidak ditemukan');
    }

    return achievement;
  }

  async create(dto: CreateAchievementDto) {
    const created = await this.prisma.achievement.create({
      data: {
        title: dto.title,
        description: dto.description,
        issuer: dto.issuer,
        date: new Date(dto.date),
        featured: dto.featured ?? false,
        order: dto.order ?? 0,
      },
    });

    await this.invalidateCache();
    return created;
  }

  async update(id: string, dto: UpdateAchievementDto) {
    await this.findOne(id);

    const updated = await this.prisma.achievement.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
    });

    await this.invalidateCache();
    return updated;
  }

  async updateCertificate(id: string, url: string) {
    const current = await this.findOne(id);

    await this.uploadService.deleteByUrl(current.certificateUrl);

    const updated = await this.prisma.achievement.update({
      where: { id },
      data: { certificateUrl: url },
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    const current = await this.findOne(id);

    await this.uploadService.deleteByUrl(current.certificateUrl);

    await this.prisma.achievement.delete({
      where: { id },
    });

    await this.invalidateCache();
  }

  private async invalidateCache() {
    const currentVersion = await this.getListVersion();
    await this.cacheManager.set(
      ACHIEVEMENTS_LIST_VERSION_KEY,
      currentVersion + 1,
      NO_EXPIRE_TTL,
    );
  }

  private async getListVersion(): Promise<number> {
    const version = await this.cacheManager.get<number>(
      ACHIEVEMENTS_LIST_VERSION_KEY,
    );
    return version ?? 1;
  }
}
