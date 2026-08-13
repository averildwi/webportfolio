import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
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
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FilePipe } from '../common/upload/pipes/file.pipe';
import { UploadService } from '../common/upload/upload.service';
import { SiteConfigService } from './site-config.service';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';

@ApiTags('Site Config')
@Controller('site-config')
export class SiteConfigController {
  constructor(
    private siteConfigService: SiteConfigService,
    private uploadService: UploadService,
  ) {}

  @ApiOperation({ summary: 'Ambil konfigurasi profil' })
  @Get()
  async get() {
    return this.siteConfigService.get();
  }

  @ApiOperation({ summary: 'Update konfigurasi profil' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch()
  async update(@Body() dto: UpdateSiteConfigDto) {
    return this.siteConfigService.update(dto);
  }

  @ApiOperation({ summary: 'Upload avatar profil' })
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
  @Post('avatar')
  async uploadAvatar(
    @UploadedFile(new FilePipe({ maxSizeMb: 2 })) file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadFile(
      file,
      'site-config/avatar',
      'image',
    );
    return this.siteConfigService.updateAvatar(result.url);
  }

  @ApiOperation({ summary: 'Upload file resume (PDF)' })
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
  @Post('resume')
  async uploadResume(
    @UploadedFile(
      new FilePipe({ maxSizeMb: 5, allowedMimes: ['application/pdf'] }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadFile(
      file,
      'site-config/resume',
      'document',
    );
    return this.siteConfigService.updateResume(result.url);
  }
}
