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
import { TechCategory } from 'generated/prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FilePipe } from '../common/upload/pipes/file.pipe';
import { UploadService } from '../common/upload/upload.service';
import { TechStackService } from './tech-stack.service';
import { CreateTechStackDto, UpdateTechStackDto } from './dto/tech-stack.dto';
import { MessageResponse } from '../common/interceptors/transform.interceptor';

@ApiTags('Tech Stack')
@Controller('tech-stacks')
export class TechStackController {
  constructor(
    private readonly techStackService: TechStackService,
    private readonly uploadService: UploadService,
  ) {}

  @ApiOperation({ summary: 'Ambil semua tech stack' })
  @ApiQuery({ name: 'category', enum: TechCategory, required: false })
  @Get()
  async findAll(@Query('category') category?: TechCategory) {
    return this.techStackService.findAll(category);
  }

  @ApiOperation({ summary: 'Ambil detail satu tech stack' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.techStackService.findOne(id);
  }

  @ApiOperation({ summary: 'Buat tech stack baru' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateTechStackDto) {
    return this.techStackService.create(dto);
  }

  @ApiOperation({ summary: 'Upload icon tech stack' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/icon')
  async uploadIcon(
    @Param('id') id: string,
    @UploadedFile(
      new FilePipe({
        maxSizeMb: 2,
        allowedMimes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/svg+xml',
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await this.techStackService.findOne(id);

    const result = await this.uploadService.uploadFile(
      file,
      'tech-stacks/icons',
      'image',
    );
    return this.techStackService.updateIcon(id, result.url);
  }

  @ApiOperation({ summary: 'Update tech stack' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTechStackDto) {
    return this.techStackService.update(id, dto);
  }

  @ApiOperation({ summary: 'Hapus tech stack' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.techStackService.remove(id);
    return new MessageResponse(null, 'Tech stack berhasil dihapus');
  }
}
