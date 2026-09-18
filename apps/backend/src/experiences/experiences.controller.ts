import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MessageResponse } from '../common/interceptors/transform.interceptor';
import { CreateExperienceDto, UpdateExperienceDto } from './dto/experience.dto';
import { ExperiencesService } from './experiences.service';

@ApiTags('Experiences')
@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

  @ApiOperation({ summary: 'Ambil semua riwayat experience' })
  @Public()
  @Get()
  async findAll() {
    return this.experiencesService.findAll();
  }

  @ApiOperation({ summary: 'Ambil detail satu experience' })
  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.experiencesService.findOne(id);
  }

  @ApiOperation({ summary: 'Buat experience baru' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateExperienceDto) {
    return this.experiencesService.create(dto);
  }

  @ApiOperation({ summary: 'Update experience' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExperienceDto) {
    return this.experiencesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Hapus experience' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.experiencesService.remove(id);
    return new MessageResponse(null, 'Experience berhasil dihapus');
  }
}
