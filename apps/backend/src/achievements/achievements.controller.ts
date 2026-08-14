import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FilePipe } from '../common/upload/pipes/file.pipe';
import { UploadService } from '../common/upload/upload.service';
import {
  MessageResponse,
  Paginated,
} from '../common/interceptors/transform.interceptor';
import { AchievementsService } from './achievements.service';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';

@ApiTags('Achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(
    private readonly achievementsService: AchievementsService,
    private readonly uploadService: UploadService,
  ) {}

  @ApiOperation({ summary: 'List achievement (paginated, cached)' })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  async findAll(
    @Query('featured') featured?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.achievementsService.findAll({
      featured: featured !== undefined ? featured === 'true' : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return new Paginated(result.data, result.meta);
  }

  @ApiOperation({ summary: 'Detail satu achievement' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.achievementsService.findOne(id);
  }

  @ApiOperation({ summary: 'Buat achievement baru' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateAchievementDto) {
    return this.achievementsService.create(dto);
  }

  @ApiOperation({ summary: 'Upload sertifikat achievement' })
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
  @Post(':id/certificate')
  async uploadCertificate(
    @Param('id') id: string,
    @UploadedFile(
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
    file: Express.Multer.File,
  ) {
    const isPdf = file.mimetype === 'application/pdf';
    const result = await this.uploadService.uploadFile(
      file,
      'achievements/certificates',
      isPdf ? 'document' : 'image',
    );
    return this.achievementsService.updateCertificate(id, result.url);
  }

  @ApiOperation({ summary: 'Update achievement' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAchievementDto) {
    return this.achievementsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Hapus achievement + cleanup Cloudinary' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.achievementsService.remove(id);
    return new MessageResponse(null, 'Achievement berhasil dihapus');
  }
}
