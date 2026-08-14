import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  MessageResponse,
  Paginated,
} from '../common/interceptors/transform.interceptor';
import { GuestbookService } from './guestbook.service';
import {
  CreateGuestbookDto,
  UpdateGuestbookStatusDto,
} from './dto/guestbook.dto';
import type { VisitorPayload } from '../auth/types/auth.types';

@ApiTags('Guestbook')
@Controller('guestbook')
export class GuestbookController {
  constructor(private readonly guestbookService: GuestbookService) {}

  @ApiOperation({ summary: 'List pesan APPROVED (public)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  async findAllApproved(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.guestbookService.findAllApproved({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return new Paginated(result.data, result.meta);
  }

  @ApiOperation({ summary: 'Kirim pesan guestbook (visitor OAuth)' })
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 3, ttl: seconds(300) } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VISITOR')
  @Post()
  async create(
    @CurrentUser() user: VisitorPayload,
    @Body() dto: CreateGuestbookDto,
  ) {
    return this.guestbookService.create(user.id, dto);
  }

  @ApiOperation({ summary: 'List semua pesan (admin)' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin')
  async findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.guestbookService.findAllAdmin({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return new Paginated(result.data, result.meta);
  }

  @ApiOperation({ summary: 'Update status moderasi (admin)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGuestbookStatusDto,
  ) {
    return this.guestbookService.updateStatus(id, dto);
  }

  @ApiOperation({ summary: 'Hapus pesan (admin)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.guestbookService.remove(id);
    return new MessageResponse(null, 'Pesan guestbook berhasil dihapus');
  }
}
