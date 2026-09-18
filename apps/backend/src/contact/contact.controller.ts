import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ContactStatus } from 'generated/prisma/client';
import { Throttle, seconds } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  MessageResponse,
  Paginated,
} from '../common/interceptors/transform.interceptor';
import { ContactService } from './contact.service';
import { CreateContactDto, UpdateContactStatusDto } from './dto/contact.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @ApiOperation({ summary: 'Submit pesan kontak (public)' })
  @Throttle({ default: { limit: 3, ttl: seconds(300) } })
  @Public()
  @Post()
  async create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }

  @ApiOperation({ summary: 'List pesan masuk (admin)' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'status', required: false, enum: ContactStatus })
  @Roles('ADMIN')
  @Get()
  async findAll(
    @Query() query: PaginationDto,
    @Query('status') status?: ContactStatus,
  ) {
    const result = await this.contactService.findAll({
      status,
      page: query.page,
      limit: query.limit,
    });

    return new Paginated(result.data, result.meta);
  }

  @ApiOperation({ summary: 'Detail pesan (read-only)' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @ApiOperation({ summary: 'Tandai pesan sebagai READ' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.contactService.markAsRead(id);
  }

  @ApiOperation({ summary: 'Update status pesan' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactStatusDto,
  ) {
    return this.contactService.updateStatus(id, dto);
  }

  @ApiOperation({ summary: 'Hapus pesan' })
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.contactService.remove(id);
    return new MessageResponse(null, 'Pesan berhasil dihapus');
  }
}
