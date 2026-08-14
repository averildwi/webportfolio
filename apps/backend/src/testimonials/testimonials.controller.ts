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
import { MessageResponse } from '../common/interceptors/transform.interceptor';
import { TestimonialsService } from './testimonials.service';
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './dto/testimonial.dto';

@ApiTags('Testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(
    private readonly testimonialsService: TestimonialsService,
    private readonly uploadService: UploadService,
  ) {}

  @ApiOperation({ summary: 'List testimonials (cached)' })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @Get()
  async findAll(@Query('featured') featured?: string) {
    return this.testimonialsService.findAll({
      featured: featured !== undefined ? featured === 'true' : undefined,
    });
  }

  @ApiOperation({ summary: 'Detail satu testimonial' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.testimonialsService.findOne(id);
  }

  @ApiOperation({ summary: 'Buat testimonial baru' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateTestimonialDto) {
    return this.testimonialsService.create(dto);
  }

  @ApiOperation({ summary: 'Upload avatar testimonial' })
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
  @Post(':id/avatar')
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile(new FilePipe({ maxSizeMb: 2 })) file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadFile(
      file,
      'testimonials/avatars',
      'image',
    );
    return this.testimonialsService.updateAvatar(id, result.url);
  }

  @ApiOperation({ summary: 'Update testimonial' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
    return this.testimonialsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Hapus testimonial + cleanup Cloudinary' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.testimonialsService.remove(id);
    return new MessageResponse(null, 'Testimonial berhasil dihapus');
  }
}
