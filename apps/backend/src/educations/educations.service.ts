import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';

export const EDUCATIONS_CACHE_KEY = 'educations';

@Injectable()
export class EducationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll() {
    const cached = await this.cacheManager.get(EDUCATIONS_CACHE_KEY);
    if (cached) return cached;

    const educations = await this.prisma.education.findMany({
      orderBy: { order: 'asc' },
    });

    await this.cacheManager.set(EDUCATIONS_CACHE_KEY, educations);
    return educations;
  }

  async findOne(id: string) {
    const cacheKey = `${EDUCATIONS_CACHE_KEY}:${id}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const education = await this.prisma.education.findUnique({
      where: { id },
    });

    if (!education) {
      throw new NotFoundException('Education tidak ditemukan');
    }

    await this.cacheManager.set(cacheKey, education);
    return education;
  }

  async create(dto: CreateEducationDto) {
    const created = await this.prisma.education.create({
      data: {
        institution: dto.institution,
        degree: dto.degree,
        fieldOfStudy: dto.fieldOfStudy,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        order: dto.order ?? 0,
      },
    });

    await this.invalidateCache();
    return created;
  }

  async update(id: string, dto: UpdateEducationDto) {
    await this.findOne(id); // Ensure exists

    const dataToUpdate: any = {
      ...dto,
    };

    if (dto.startDate) dataToUpdate.startDate = new Date(dto.startDate);
    if (dto.endDate) dataToUpdate.endDate = new Date(dto.endDate);
    if (dto.endDate === null) dataToUpdate.endDate = null;

    const updated = await this.prisma.education.update({
      where: { id },
      data: dataToUpdate,
    });

    await this.invalidateCache(id);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.education.delete({
      where: { id },
    });

    await this.invalidateCache(id);
  }

  private async invalidateCache(id?: string) {
    await this.cacheManager.del(EDUCATIONS_CACHE_KEY);
    if (id) {
      await this.cacheManager.del(`${EDUCATIONS_CACHE_KEY}:${id}`);
    }
  }
}
