import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TechCategory, TechStack } from 'generated/prisma/client';
import { UploadService } from '../common/upload/upload.service';
import { CreateTechStackDto, UpdateTechStackDto } from './dto/tech-stack.dto';

export const TECH_STACKS_CACHE_KEY = 'tech-stacks';

@Injectable()
export class TechStackService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(category?: TechCategory) {
    const cacheKey = category
      ? `${TECH_STACKS_CACHE_KEY}:${category}`
      : TECH_STACKS_CACHE_KEY;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const techStacks = await this.prisma.techStack.findMany({
      where: category ? { category } : undefined,
      orderBy: { order: 'asc' },
    });

    await this.cacheManager.set(cacheKey, techStacks);
    return techStacks;
  }

  async findOne(id: string): Promise<TechStack> {
    const cacheKey = `${TECH_STACKS_CACHE_KEY}:${id}`;

    const cached = await this.cacheManager.get<TechStack>(cacheKey);
    if (cached) return cached;

    const techStack = await this.prisma.techStack.findUnique({
      where: { id },
    });

    if (!techStack) {
      throw new NotFoundException('Tech stack tidak ditemukan');
    }

    await this.cacheManager.set(cacheKey, techStack);
    return techStack;
  }

  async create(dto: CreateTechStackDto) {
    const created = await this.prisma.techStack.create({
      data: {
        name: dto.name,
        category: dto.category,
        order: dto.order ?? 0,
      },
    });

    await this.invalidateCache();
    return created;
  }

  async update(id: string, dto: UpdateTechStackDto) {
    await this.findOne(id);

    const updated = await this.prisma.techStack.update({
      where: { id },
      data: dto,
    });

    await this.invalidateCache(id);
    return updated;
  }

  async updateIcon(id: string, iconUrl: string) {
    const current = await this.findOne(id);

    if (current.iconUrl) {
      const publicId = this.extractPublicId(current.iconUrl);
      if (publicId) {
        await this.uploadService.deleteFile(publicId, 'image').catch(() => {});
      }
    }

    const updated = await this.prisma.techStack.update({
      where: { id },
      data: { iconUrl },
    });

    await this.invalidateCache(id);
    return updated;
  }

  async remove(id: string) {
    const current = await this.findOne(id);

    if (current.iconUrl) {
      const publicId = this.extractPublicId(current.iconUrl);
      if (publicId) {
        await this.uploadService.deleteFile(publicId, 'image').catch(() => {});
      }
    }

    await this.prisma.techStack.delete({
      where: { id },
    });

    await this.invalidateCache(id);
  }

  private extractPublicId(url: string): string | null {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex((part) => part === 'upload');

      if (uploadIndex === -1) return null;

      const pathParts = urlParts.slice(uploadIndex + 2);
      const fullPath = pathParts.join('/');

      const dotIndex = fullPath.lastIndexOf('.');
      if (dotIndex === -1) return fullPath;

      return fullPath.substring(0, dotIndex);
    } catch {
      return null;
    }
  }

  private async invalidateCache(id?: string) {
    await this.cacheManager.del(TECH_STACKS_CACHE_KEY);

    Object.values(TechCategory).forEach((category) => {
      this.cacheManager
        .del(`${TECH_STACKS_CACHE_KEY}:${category}`)
        .catch(() => {});
    });

    if (id) {
      await this.cacheManager.del(`${TECH_STACKS_CACHE_KEY}:${id}`);
    }
  }
}
