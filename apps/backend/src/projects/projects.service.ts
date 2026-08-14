import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import type { ProjectStatus } from 'generated/prisma/client';

export const PROJECTS_CACHE_KEY = 'projects';
const PROJECTS_LIST_VERSION_KEY = `${PROJECTS_CACHE_KEY}:list-version`;

const MAX_DOCS = 10;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ── Public: List (paginated) ────────────────────────────────
  async findAll(options?: {
    featured?: boolean;
    status?: ProjectStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; meta: Record<string, any> }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const listVersion = await this.getListVersion();
    const cacheKey = `${PROJECTS_CACHE_KEY}:list:v${listVersion}:${options?.status ?? 'PUBLISHED'}:${options?.featured ?? 'all'}:${page}:${limit}`;

    const cached = await this.cacheManager.get<{
      data: any[];
      meta: Record<string, any>;
    }>(cacheKey);
    if (cached) return cached;

    const where = {
      status: options?.status ?? 'PUBLISHED',
      ...(options?.featured !== undefined && { featured: options.featured }),
    };

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

    const result = {
      data: formatted,
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

  // ── Public: Detail by slug ──────────────────────────────────
  async findBySlug(slug: string, viewerHash?: string): Promise<any> {
    const cacheKey = `${PROJECTS_CACHE_KEY}:slug:${slug}`;

    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) {
      if (viewerHash) {
        const liked = await this.hasLiked(cached.id, viewerHash);
        return { ...cached, liked };
      }
      return cached;
    }

    const project = await this.prisma.project.findUnique({
      where: { slug },
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

  // ── Admin: Detail by ID ─────────────────────────────────────
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

  // ── Admin: Create ───────────────────────────────────────────
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

  // ── Admin: Update ───────────────────────────────────────────
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

  // ── Admin: Upload thumbnail ─────────────────────────────────
  async updateThumbnail(id: string, url: string) {
    const current = await this.findById(id);

    if (current.thumbnailUrl) {
      const publicId = this.extractPublicId(current.thumbnailUrl);
      if (publicId) {
        await this.uploadService.deleteFile(publicId, 'image').catch(() => {});
      }
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: { thumbnailUrl: url },
    });

    await this.invalidateCache(updated.slug);
    return updated;
  }

  // ── Admin: Upload docs (multi-file) ─────────────────────────
  async addDocs(
    id: string,
    files: Express.Multer.File[],
    uploadResults: { url: string; publicId: string; resourceType: string }[],
  ) {
    const current = await this.findById(id);

    const existingCount = await this.prisma.projectDoc.count({
      where: { projectId: id },
    });

    if (existingCount + files.length > MAX_DOCS) {
      // Cleanup already uploaded files
      for (const result of uploadResults) {
        await this.uploadService
          .deleteFile(result.publicId, result.resourceType)
          .catch(() => {});
      }
      throw new Error(
        `Maksimal ${MAX_DOCS} dokumentasi per project. Saat ini sudah ada ${existingCount}.`,
      );
    }

    const docs = await Promise.all(
      uploadResults.map((result, index) =>
        this.prisma.projectDoc.create({
          data: {
            projectId: id,
            url: result.url,
            type: result.resourceType === 'raw' ? 'PDF' : 'IMAGE',
            order: existingCount + index,
          },
        }),
      ),
    );

    await this.invalidateCache(current.slug);
    return docs;
  }

  // ── Admin: Delete single doc ────────────────────────────────
  async removeDoc(projectId: string, docId: string) {
    const project = await this.findById(projectId);

    const doc = await this.prisma.projectDoc.findFirst({
      where: { id: docId, projectId },
    });

    if (!doc) {
      throw new NotFoundException('Dokumentasi tidak ditemukan');
    }

    const publicId = this.extractPublicId(doc.url);
    if (publicId) {
      const resourceType = doc.type === 'PDF' ? 'raw' : 'image';
      await this.uploadService
        .deleteFile(publicId, resourceType)
        .catch(() => {});
    }

    await this.prisma.projectDoc.delete({
      where: { id: docId },
    });

    await this.invalidateCache(project.slug);
  }

  // ── Admin: Delete project ───────────────────────────────────
  async remove(id: string) {
    const project = await this.findById(id);

    // Cleanup thumbnail
    if (project.thumbnailUrl) {
      const publicId = this.extractPublicId(project.thumbnailUrl);
      if (publicId) {
        await this.uploadService.deleteFile(publicId, 'image').catch(() => {});
      }
    }

    // Cleanup all docs
    for (const doc of project.docs) {
      const publicId = this.extractPublicId(doc.url);
      if (publicId) {
        const resourceType = doc.type === 'PDF' ? 'raw' : 'image';
        await this.uploadService
          .deleteFile(publicId, resourceType)
          .catch(() => {});
      }
    }

    await this.prisma.project.delete({
      where: { id },
    });

    await this.invalidateCache(project.slug);
  }

  // ── Public: Increment view (atomic) ─────────────────────────
  async incrementView(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
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

  // ── Public: Toggle like (idempotent via ProjectLike hash) ───
  async toggleLike(
    slug: string,
    hash: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const project = await this.prisma.project.findUnique({
      where: { slug },
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

  // ── Private: Check if viewerHash already liked ──────────────
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

  // ── Private: Slugify ────────────────────────────────────────
  private slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ── Private: Extract Cloudinary public_id from URL ──────────
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

  // ── Private: Cache invalidation ─────────────────────────────
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
    await this.cacheManager.set(PROJECTS_LIST_VERSION_KEY, currentVersion + 1);
  }

  private async getListVersion(): Promise<number> {
    const version = await this.cacheManager.get<number>(
      PROJECTS_LIST_VERSION_KEY,
    );
    return version ?? 1;
  }
}
