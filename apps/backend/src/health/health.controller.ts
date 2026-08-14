import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Status kesehatan sistem (database, memory, disk)' })
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database connection check via Prisma
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // Memory heap check (max 300MB)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      // Disk storage check (health pass if used space < 90%)
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
