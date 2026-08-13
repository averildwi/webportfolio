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
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';
import { EducationsService } from './educations.service';

@ApiTags('Educations')
@Controller('educations')
export class EducationsController {
  constructor(private readonly educationsService: EducationsService) {}

  @ApiOperation({ summary: 'Ambil semua riwayat pendidikan' })
  @Get()
  async findAll() {
    return this.educationsService.findAll();
  }

  @ApiOperation({ summary: 'Ambil detail satu education' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.educationsService.findOne(id);
  }

  @ApiOperation({ summary: 'Buat education baru' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateEducationDto) {
    return this.educationsService.create(dto);
  }

  @ApiOperation({ summary: 'Update education' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEducationDto) {
    return this.educationsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Hapus education' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.educationsService.remove(id);
    return new MessageResponse(null, 'Education berhasil dihapus');
  }
}
