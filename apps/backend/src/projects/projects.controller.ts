import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle, seconds } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FilePipe } from '../common/upload/pipes/file.pipe';
import { UploadService } from '../common/upload/upload.service';
import { hashViewer } from '../common/helpers/viewer-hash.helper';
import {
  MessageResponse,
  Paginated,
  RawResponse,
} from '../common/interceptors/transform.interceptor';
import {
  CreateProjectDto,
  ListProjectsAdminDto,
  ListProjectsPublicDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { MAX_DOCS, ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly uploadService: UploadService,
  ) {}

  // ── Public: List (paginated, cached, PUBLISHED only) ────────
  @ApiOperation({
    summary: 'List project publik (paginated, cached, status PUBLISHED)',
  })
  @Get()
  async findAll(@Query() query: ListProjectsPublicDto) {
    const result = await this.projectsService.findAllPublic({
      featured: query.featured,
      page: query.page,
      limit: query.limit,
    });

    return new Paginated(result.data, result.meta);
  }

  // ── Admin: List semua status ────────────────────────────────
  @ApiOperation({ summary: 'List project semua status (admin)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin')
  async findAllAdmin(@Query() query: ListProjectsAdminDto) {
    const result = await this.projectsService.findAllAdmin({
      featured: query.featured,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });

    return new Paginated(result.data, result.meta);
  }

  // ── Public: Detail by slug ──────────────────────────────────
  @ApiOperation({ summary: 'Detail project by slug (PUBLISHED only)' })
  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<unknown> {
    return this.projectsService.findBySlug(slug, hashViewer(req));
  }

  // ── Public: Increment view ──────────────────────────────────
  @ApiOperation({ summary: 'Increment view counter' })
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('slug/:slug/view')
  async incrementView(@Param('slug') slug: string) {
    await this.projectsService.incrementView(slug);
    return new MessageResponse(null, 'View count updated');
  }

  // ── Public: Toggle like ──────────────────────────────────────
  @ApiOperation({ summary: 'Toggle like/unlike' })
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('slug/:slug/like/toggle')
  async toggleLike(@Param('slug') slug: string, @Req() req: Request) {
    const result = await this.projectsService.toggleLike(slug, hashViewer(req));
    return new RawResponse(result);
  }

  // ── Admin: Detail by ID ──────────────────────────────────────
  @ApiOperation({ summary: 'Detail project by ID (admin)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.projectsService.findById(id);
  }

  // ── Admin: Create ───────────────────────────────────────────
  @ApiOperation({ summary: 'Buat project baru' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  // ── Admin: Upload thumbnail ─────────────────────────────────
  @ApiOperation({ summary: 'Upload thumbnail project' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/thumbnail')
  async uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile(new FilePipe({ maxSizeMb: 2 })) file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadFile(
      file,
      'projects/thumbnails',
      'image',
    );
    return this.projectsService.updateThumbnail(id, result.url);
  }

  // ── Admin: Upload docs (multi-file) ─────────────────────────
  @ApiOperation({
    summary: `Upload dokumentasi project (max ${MAX_DOCS} files)`,
  })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FilesInterceptor('files', MAX_DOCS))
  @Post(':id/docs')
  async uploadDocs(
    @Param('id') id: string,
    @UploadedFiles(
      new FilePipe({
        maxSizeMb: 5,
        allowedMimes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ],
      }),
    )
    files: Express.Multer.File[],
  ) {
    // Validasi kapasitas SEBELUM upload, supaya tidak ada file yang
    // terbuang ke Cloudinary lalu harus dihapus lagi.
    const context = await this.projectsService.assertDocsCapacity(
      id,
      files.length,
    );

    const uploadResults = await Promise.all(
      files.map((file) => {
        const isPdf = file.mimetype === 'application/pdf';
        return this.uploadService.uploadFile(
          file,
          'projects/docs',
          isPdf ? 'document' : 'image',
        );
      }),
    );

    return this.projectsService.addDocs(id, uploadResults, context);
  }

  // ── Admin: Delete single doc ────────────────────────────────
  @ApiOperation({ summary: 'Hapus satu dokumentasi project' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id/docs/:docId')
  async removeDoc(@Param('id') id: string, @Param('docId') docId: string) {
    await this.projectsService.removeDoc(id, docId);
    return new MessageResponse(null, 'Dokumentasi berhasil dihapus');
  }

  // ── Admin: Update ───────────────────────────────────────────
  @ApiOperation({ summary: 'Update project' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  // ── Admin: Delete ───────────────────────────────────────────
  @ApiOperation({ summary: 'Hapus project + cleanup Cloudinary' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.projectsService.remove(id);
    return new MessageResponse(null, 'Project berhasil dihapus');
  }
}
