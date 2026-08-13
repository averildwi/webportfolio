import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MessageResponse } from '../common/interceptors/transform.interceptor';
import {
  CreateExperienceDto,
  UpdateExperienceDto,
} from './dto/experience.dto';
import { ExperiencesService } from './experiences.service';

@ApiTags('Experiences')
@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

  @ApiOperation({ summary: 'Ambil semua riwayat experience' })
  @Get()
  async findAll() {
    return this.experiencesService.findAll();
  }

  @ApiOperation({ summary: 'Ambil detail satu experience' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.experiencesService.findOne(id);
  }

  @ApiOperation({ summary: 'Buat experience baru' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateExperienceDto) {
    return this.experiencesService.create(dto);
  }

  @ApiOperation({ summary: 'Update experience' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExperienceDto) {
    return this.experiencesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Hapus experience' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.experiencesService.remove(id);
    return new MessageResponse(null, 'Experience berhasil dihapus');
  }
}
