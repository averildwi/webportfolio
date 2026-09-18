import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import type { Prisma, ProjectStatus } from 'generated/prisma/client';
import {
  paginate,
  type PaginatedResult,
} from '../common/helpers/paginate.helper';
import { NO_EXPIRE_TTL } from '../common/cache/cache.constants';

export const PROJECTS_CACHE_KEY = 'projects';
const PROJECTS_LIST_VERSION_KEY = `${PROJECTS_CACHE_KEY}:list-version`;

export const MAX_DOCS = 10;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Public: List (paginated) — hanya PUBLISHED
  async findAllPublic(options: {
    featured?: boolean;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<any>> {
    const { featured, page, limit } = options;

    const listVersion = await this.getListVersion();
    const cacheKey = `${PROJECTS_CACHE_KEY}:list:v${listVersion}:PUBLISHED:${featured ?? 'all'}:${page}:${limit}`;

    const cached = await this.cacheManager.get<PaginatedResult<any>>(cacheKey);
    if (cached) return cached;

    const result = await this.queryList({
      where: {
        status: 'PUBLISHED',
        ...(featured !== undefined && { featured }),
      },
      page,
      limit,
    });

    await this.cacheManager.set(cacheKey, result);
    return result;
  }

  // Admin: List semua status (tidak di-cache, selalu fresh untuk dashboard)
  async findAllAdmin(options: {
    featured?: boolean;
    status?: ProjectStatus;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<any>> {
    const { featured, status, page, limit } = options;

    return this.queryList({
      where: {
        ...(status !== undefined && { status }),
        ...(featured !== undefined && { featured }),
      },
      page,
      limit,
    });
  }

  // Public: Detail by slug — hanya PUBLISHED
  async findBySlug(slug: string, viewerHash?: string): Promise<unknown> {
    const cacheKey = `${PROJECTS_CACHE_KEY}:slug:${slug}`;

    const cached = await this.cacheManager.get<{ id: string }>(cacheKey);
    if (cached) {
      if (viewerHash) {
        const liked = await this.hasLiked(cached.id, viewerHash);
        return { ...cached, liked };
      }
      return cached;
    }

    const project = await this.prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        techStacks: { include: { techStack: true } },
        docs: { orderBy: { order: 'asc' } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project tidak ditemukan');
    }

    const formatted = {
      ...project,
      techStacks: project.techStacks.map((t) => t.techStack),
    };

    await this.cacheManager.set(cacheKey, formatted);

    if (viewerHash) {
      const liked = await this.hasLiked(project.id, viewerHash);
      return { ...formatted, liked };
    }

    return formatted;
  }

  // Admin: Detail by ID
  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        techStacks: { include: { techStack: true } },
        docs: { orderBy: { order: 'asc' } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project tidak ditemukan');
    }

    return {
      ...project,
      techStacks: project.techStacks.map((t) => t.techStack),
    };
  }

  // Admin: Create
  async create(dto: CreateProjectDto) {
    const slug = this.slugify(dto.title);

    const created = await this.prisma.project.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        longDesc: dto.longDesc,
        liveUrl: dto.liveUrl,
        repoUrl: dto.repoUrl,
        status: dto.status ?? 'DRAFT',
        featured: dto.featured ?? false,
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

  // Admin: Update
  async update(id: string, dto: UpdateProjectDto) {
    await this.findById(id);

    const { techStackIds, ...rest } = dto;

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(techStackIds !== undefined && {
          techStacks: {
            deleteMany: {},
            create: techStackIds.map((techId) => ({
              techStack: { connect: { id: techId } },
            })),
          },
        }),
      },
    });

    await this.invalidateCache(updated.slug);
    return updated;
  }

  // Admin: Upload thumbnail
  async updateThumbnail(id: string, url: string) {
    const current = await this.findById(id);

    await this.uploadService.deleteByUrl(current.thumbnailUrl);

    const updated = await this.prisma.project.update({
      where: { id },
      data: { thumbnailUrl: url },
    });

    await this.invalidateCache(updated.slug);
    return updated;
  }

  async assertDocsCapacity(
    id: string,
    incoming: number,
  ): Promise<{ slug: string; existingCount: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { slug: true },
    });

    if (!project) {
      throw new NotFoundException('Project tidak ditemukan');
    }

    const existingCount = await this.prisma.projectDoc.count({
      where: { projectId: id },
    });

    if (existingCount + incoming > MAX_DOCS) {
      throw new BadRequestException(
        `Maksimal ${MAX_DOCS} dokumentasi per project. Saat ini sudah ada ${existingCount}.`,
      );
    }

    return { slug: project.slug, existingCount };
  }

  // Admin: Simpan hasil upload docs (multi-file)
  async addDocs(
    id: string,
    uploadResults: { url: string; publicId: string; resourceType: string }[],
    context: { slug: string; existingCount: number },
  ) {
    const docs = await this.prisma.$transaction(
      uploadResults.map((result, index) =>
        this.prisma.projectDoc.create({
          data: {
            projectId: id,
            url: result.url,
            type: result.resourceType === 'raw' ? 'PDF' : 'IMAGE',
            order: context.existingCount + index,
          },
        }),
      ),
    );

    await this.invalidateCache(context.slug);
    return docs;
  }

  // Admin: Delete single doc
  async removeDoc(projectId: string, docId: string) {
    const project = await this.findById(projectId);

    const doc = await this.prisma.projectDoc.findFirst({
      where: { id: docId, projectId },
    });

    if (!doc) {
      throw new NotFoundException('Dokumentasi tidak ditemukan');
    }

    await this.uploadService.deleteByUrl(doc.url);

    await this.prisma.projectDoc.delete({
      where: { id: docId },
    });

    await this.invalidateCache(project.slug);
  }

  // Admin: Delete project
  async remove(id: string) {
    const project = await this.findById(id);

    await this.uploadService.deleteByUrl(project.thumbnailUrl);
    for (const doc of project.docs) {
      await this.uploadService.deleteByUrl(doc.url);
    }

    await this.prisma.project.delete({
      where: { id },
    });

    await this.invalidateCache(project.slug);
  }

  // Public: Increment view (atomic) — hanya project PUBLISHED
  async incrementView(slug: string) {
    const project = await this.prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project tidak ditemukan');
    }

    await this.prisma.project.update({
      where: { id: project.id },
      data: { viewCount: { increment: 1 } },
    });

    // Invalidate slug cache so next read gets fresh viewCount
    await this.cacheManager.del(`${PROJECTS_CACHE_KEY}:slug:${slug}`);
  }

  // Public: Toggle like (idempotent via ProjectLike hash) — hanya PUBLISHED
  async toggleLike(
    slug: string,
    hash: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const project = await this.prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true, likeCount: true },
    });

    if (!project) {
      throw new NotFoundException('Project tidak ditemukan');
    }

    const existing = await this.prisma.projectLike.findUnique({
      where: {
        projectId_hash: {
          projectId: project.id,
          hash,
        },
      },
    });

    if (existing) {
      // Unlike
      const [, updated] = await this.prisma.$transaction([
        this.prisma.projectLike.delete({
          where: { id: existing.id },
        }),
        this.prisma.project.update({
          where: { id: project.id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        }),
      ]);

      await this.cacheManager.del(`${PROJECTS_CACHE_KEY}:slug:${slug}`);
      await this.bumpListVersion();
      return { liked: false, likeCount: updated.likeCount };
    }

    // Like
    const [, updated] = await this.prisma.$transaction([
      this.prisma.projectLike.create({
        data: { projectId: project.id, hash },
      }),
      this.prisma.project.update({
        where: { id: project.id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      }),
    ]);

    await this.cacheManager.del(`${PROJECTS_CACHE_KEY}:slug:${slug}`);
    await this.bumpListVersion();
    return { liked: true, likeCount: updated.likeCount };
  }

  // Private: shared list query
  private async queryList(params: {
    where: Prisma.ProjectWhereInput;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<any>> {
    const { where, page, limit } = params;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order: 'asc' },
        include: {
          techStacks: { include: { techStack: true } },
        },
      }),
    ]);

    const formatted = data.map((p) => ({
      ...p,
      techStacks: p.techStacks.map((t) => t.techStack),
    }));

    return paginate(formatted, total, page, limit);
  }

  // Private: Check if viewerHash already liked
  private async hasLiked(projectId: string, hash: string): Promise<boolean> {
    const like = await this.prisma.projectLike.findUnique({
      where: {
        projectId_hash: {
          projectId,
          hash,
        },
      },
      select: { id: true },
    });
    return !!like;
  }

  // Private: Slugify
  private slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Private: Cache invalidation
  private async invalidateCache(slug?: string) {
    await this.bumpListVersion();

    if (slug) {
      await this.cacheManager.del(`${PROJECTS_CACHE_KEY}:slug:${slug}`);
    }
  }

  // Bump list version so all paginated list cache keys become stale
  // (works for in-memory and external stores like Redis without wildcard deps)
  private async bumpListVersion(): Promise<void> {
    const currentVersion = await this.getListVersion();
    await this.cacheManager.set(
      PROJECTS_LIST_VERSION_KEY,
      currentVersion + 1,
      NO_EXPIRE_TTL,
    );
  }

  private async getListVersion(): Promise<number> {
    const version = await this.cacheManager.get<number>(
      PROJECTS_LIST_VERSION_KEY,
    );
    return version ?? 1;
  }
}
