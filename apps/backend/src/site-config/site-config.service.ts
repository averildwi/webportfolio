import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';

export const SITE_CONFIG_CACHE_KEY = 'site-config';

@Injectable()
export class SiteConfigService {
  constructor(
    private prisma: PrismaService,
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
    const current = await this.prisma.siteConfig.findFirst();
    if (!current) {
      throw new NotFoundException('Site config belum diinisialisasi');
    }

    const updated = await this.prisma.siteConfig.update({
      where: { id: current.id },
      data: {
        ...dto,
        socialLinks: dto.socialLinks as object | undefined,
      },
    });

    await this.invalidateCache();
    return updated;
  }

  async updateAvatar(url: string) {
    const current = await this.prisma.siteConfig.findFirst();
    if (!current) {
      throw new NotFoundException('Site config belum diinisialisasi');
    }

    const updated = await this.prisma.siteConfig.update({
      where: { id: current.id },
      data: { avatarUrl: url },
    });

    await this.invalidateCache();
    return updated;
  }

  async updateResume(url: string) {
    const current = await this.prisma.siteConfig.findFirst();
    if (!current) {
      throw new NotFoundException('Site config belum diinisialisasi');
    }

    const updated = await this.prisma.siteConfig.update({
      where: { id: current.id },
      data: { resumeUrl: url },
    });

    await this.invalidateCache();
    return updated;
  }

  private async invalidateCache() {
    await this.cacheManager.del(SITE_CONFIG_CACHE_KEY);
  }
}
