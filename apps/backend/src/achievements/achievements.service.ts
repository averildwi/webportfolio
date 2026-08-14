import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';

export const ACHIEVEMENTS_CACHE_KEY = 'achievements';
const ACHIEVEMENTS_LIST_VERSION_KEY = `${ACHIEVEMENTS_CACHE_KEY}:list-version`;

@Injectable()
export class AchievementsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(options?: {
    featured?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const listVersion = await this.getListVersion();
    const cacheKey = `${ACHIEVEMENTS_CACHE_KEY}:list:v${listVersion}:${options?.featured ?? 'all'}:${page}:${limit}`;

    const cached = await this.cacheManager.get<{
      data: any[];
      meta: Record<string, any>;
    }>(cacheKey);
    if (cached) return cached;

    const where = {
      ...(options?.featured !== undefined && { featured: options.featured }),
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

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

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

    if (current.certificateUrl) {
      const info = this.extractFileInfo(current.certificateUrl);
      if (info) {
        await this.uploadService
          .deleteFile(info.publicId, info.resourceType)
          .catch(() => {});
      }
    }

    const updated = await this.prisma.achievement.update({
      where: { id },
      data: { certificateUrl: url },
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    const current = await this.findOne(id);

    if (current.certificateUrl) {
      const info = this.extractFileInfo(current.certificateUrl);
      if (info) {
        await this.uploadService
          .deleteFile(info.publicId, info.resourceType)
          .catch(() => {});
      }
    }

    await this.prisma.achievement.delete({
      where: { id },
    });

    await this.invalidateCache();
  }

  // Extract Cloudinary public_id + resource_type from URL.
  // For raw (PDF) uploads the public_id includes the file extension,
  // so we must keep it; for images we strip the format suffix.
  private extractFileInfo(url: string): {
    publicId: string;
    resourceType: string;
  } | null {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex((part) => part === 'upload');
      if (uploadIndex === -1) return null;

      const resourceType =
        urlParts[uploadIndex - 1] === 'raw' ? 'raw' : 'image';

      const pathParts = urlParts.slice(uploadIndex + 2);
      let fullPath = pathParts.join('/');

      if (resourceType === 'image') {
        const dotIndex = fullPath.lastIndexOf('.');
        if (dotIndex !== -1) {
          fullPath = fullPath.substring(0, dotIndex);
        }
      }

      return { publicId: fullPath, resourceType };
    } catch {
      return null;
    }
  }

  private async invalidateCache() {
    const currentVersion = await this.getListVersion();
    await this.cacheManager.set(
      ACHIEVEMENTS_LIST_VERSION_KEY,
      currentVersion + 1,
    );
  }

  private async getListVersion(): Promise<number> {
    const version = await this.cacheManager.get<number>(
      ACHIEVEMENTS_LIST_VERSION_KEY,
    );
    return version ?? 1;
  }
}
