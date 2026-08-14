import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './dto/testimonial.dto';

export const TESTIMONIALS_CACHE_KEY = 'testimonials';
const TESTIMONIALS_LIST_VERSION_KEY = `${TESTIMONIALS_CACHE_KEY}:list-version`;

@Injectable()
export class TestimonialsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(options?: { featured?: boolean }) {
    const listVersion = await this.getListVersion();
    const cacheKey = `${TESTIMONIALS_CACHE_KEY}:list:v${listVersion}:${options?.featured ?? 'all'}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const where = {
      ...(options?.featured !== undefined && { featured: options.featured }),
    };

    const testimonials = await this.prisma.testimonial.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    await this.cacheManager.set(cacheKey, testimonials);
    return testimonials;
  }

  async findOne(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial tidak ditemukan');
    }

    return testimonial;
  }

  async create(dto: CreateTestimonialDto) {
    const created = await this.prisma.testimonial.create({
      data: {
        name: dto.name,
        role: dto.role,
        company: dto.company,
        message: dto.message,
        featured: dto.featured ?? false,
        order: dto.order ?? 0,
      },
    });

    await this.invalidateCache();
    return created;
  }

  async update(id: string, dto: UpdateTestimonialDto) {
    await this.findOne(id);

    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: dto,
    });

    await this.invalidateCache();
    return updated;
  }

  async updateAvatar(id: string, url: string) {
    const current = await this.findOne(id);

    if (current.avatarUrl) {
      const publicId = this.extractPublicId(current.avatarUrl);
      if (publicId) {
        await this.uploadService.deleteFile(publicId).catch(() => {});
      }
    }

    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: { avatarUrl: url },
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    const current = await this.findOne(id);

    if (current.avatarUrl) {
      const publicId = this.extractPublicId(current.avatarUrl);
      if (publicId) {
        await this.uploadService.deleteFile(publicId).catch(() => {});
      }
    }

    await this.prisma.testimonial.delete({
      where: { id },
    });

    await this.invalidateCache();
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

  private async invalidateCache() {
    const currentVersion = await this.getListVersion();
    await this.cacheManager.set(
      TESTIMONIALS_LIST_VERSION_KEY,
      currentVersion + 1,
    );
  }

  private async getListVersion(): Promise<number> {
    const version = await this.cacheManager.get<number>(
      TESTIMONIALS_LIST_VERSION_KEY,
    );
    return version ?? 1;
  }
}
