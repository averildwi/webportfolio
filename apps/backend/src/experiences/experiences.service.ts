import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExperienceDto, UpdateExperienceDto } from './dto/experience.dto';
import type { Experience } from 'generated/prisma/client';

export const EXPERIENCES_CACHE_KEY = 'experiences';

@Injectable()
export class ExperiencesService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll() {
    const cached = await this.cacheManager.get(EXPERIENCES_CACHE_KEY);
    if (cached) return cached;

    const experiences = await this.prisma.experience.findMany({
      orderBy: { order: 'asc' },
      include: {
        techStacks: {
          include: {
            techStack: true,
          },
        },
      },
    });

    const formatted = experiences.map((exp) => ({
      ...exp,
      techStacks: exp.techStacks.map((t) => t.techStack),
    }));

    await this.cacheManager.set(EXPERIENCES_CACHE_KEY, formatted);
    return formatted;
  }

  async findOne(id: string) {
    const cacheKey = `${EXPERIENCES_CACHE_KEY}:${id}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const experience = await this.prisma.experience.findUnique({
      where: { id },
      include: {
        techStacks: {
          include: {
            techStack: true,
          },
        },
      },
    });

    if (!experience) {
      throw new NotFoundException('Experience tidak ditemukan');
    }

    const formatted = {
      ...experience,
      techStacks: experience.techStacks.map((t) => t.techStack),
    };

    await this.cacheManager.set(cacheKey, formatted);
    return formatted;
  }

  async create(dto: CreateExperienceDto) {
    const created = await this.prisma.experience.create({
      data: {
        company: dto.company,
        role: dto.role,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        order: dto.order ?? 0,
        techStacks: {
          create: dto.techStackIds?.map((id) => ({
            techStack: { connect: { id } },
          })),
        },
      },
    });

    await this.invalidateCache();
    return created;
  }

  async update(id: string, dto: UpdateExperienceDto) {
    await this.findOne(id); // Ensure exists

    const dataToUpdate: any = {
      ...dto,
    };

    delete dataToUpdate.techStackIds;

    // Convert string dates to Date objects if provided
    if (dto.startDate) dataToUpdate.startDate = new Date(dto.startDate);
    if (dto.endDate) dataToUpdate.endDate = new Date(dto.endDate);
    if (dto.endDate === null) dataToUpdate.endDate = null;

    const updated = await this.prisma.experience.update({
      where: { id },
      data: {
        ...dataToUpdate,
        // Jika dikirim techStackIds baru, hapus semua relasi lama lalu buat ulang (replace)
        ...(dto.techStackIds !== undefined && {
          techStacks: {
            deleteMany: {},
            create: dto.techStackIds.map((techId) => ({
              techStack: { connect: { id: techId } },
            })),
          },
        }),
      },
    });

    await this.invalidateCache(id);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.experience.delete({
      where: { id },
    });

    await this.invalidateCache(id);
  }

  private async invalidateCache(id?: string) {
    await this.cacheManager.del(EXPERIENCES_CACHE_KEY);
    if (id) {
      await this.cacheManager.del(`${EXPERIENCES_CACHE_KEY}:${id}`);
    }
  }
}
