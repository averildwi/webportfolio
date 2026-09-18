import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';

export const SITE_CONFIG_CACHE_KEY = 'site-config';

@Injectable()
export class SiteConfigService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async get() {
    const cached = await this.cacheManager.get(SITE_CONFIG_CACHE_KEY);
    if (cached) return cached;

    const config = await this.prisma.siteConfig.findFirst();
    if (!config) {
      throw new NotFoundException('Site config belum diinisialisasi');
    }

    await this.cacheManager.set(SITE_CONFIG_CACHE_KEY, config);
    return config;
  }

  async update(dto: UpdateSiteConfigDto) {
    const current = await this.requireConfig();

    const { socialLinks, ...rest } = dto;

    const updated = await this.prisma.siteConfig.update({
      where: { id: current.id },
      data: {
        ...rest,
        ...(socialLinks !== undefined && {
          socialLinks: { ...socialLinks },
        }),
      },
    });

    await this.invalidateCache();
    return updated;
  }

  async updateAvatar(url: string) {
    const current = await this.requireConfig();

    // Hapus file lama supaya tidak menumpuk sebagai orphan di Cloudinary.
    await this.uploadService.deleteByUrl(current.avatarUrl);

    const updated = await this.prisma.siteConfig.update({
      where: { id: current.id },
      data: { avatarUrl: url },
    });

    await this.invalidateCache();
    return updated;
  }

  async updateResume(url: string) {
    const current = await this.requireConfig();

    await this.uploadService.deleteByUrl(current.resumeUrl);

    const updated = await this.prisma.siteConfig.update({
      where: { id: current.id },
      data: { resumeUrl: url },
    });

    await this.invalidateCache();
    return updated;
  }

  private async requireConfig() {
    const current = await this.prisma.siteConfig.findFirst();
    if (!current) {
      throw new NotFoundException('Site config belum diinisialisasi');
    }
    return current;
  }

  private async invalidateCache() {
    await this.cacheManager.del(SITE_CONFIG_CACHE_KEY);
  }
}
