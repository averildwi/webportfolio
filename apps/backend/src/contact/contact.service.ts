import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { CreateContactDto, UpdateContactStatusDto } from './dto/contact.dto';
import { ContactStatus } from 'generated/prisma/client';
import {
  paginate,
  type PaginatedResult,
} from '../common/helpers/paginate.helper';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreateContactDto) {
    const contact = await this.prisma.contactForm.create({
      data: {
        name: dto.name,
        email: dto.email,
        company: dto.company,
        subject: dto.subject,
        message: dto.message,
      },
    });

    // Fire-and-forget notifications (don't block the response)
    void this.notificationService.notifyNewContact(contact);

    return contact;
  }

  async findAll(options: {
    status?: ContactStatus;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<any>> {
    const { status, page, limit } = options;
    const skip = (page - 1) * limit;

    const where = {
      ...(status !== undefined && { status }),
    };

    const [total, data] = await Promise.all([
      this.prisma.contactForm.count({ where }),
      this.prisma.contactForm.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return paginate(data, total, page, limit);
  }

  /** Read-only: GET tidak boleh mengubah state. */
  async findOne(id: string) {
    const contact = await this.prisma.contactForm.findUnique({
      where: { id },
    });

    if (!contact) {
      throw new NotFoundException('Pesan tidak ditemukan');
    }

    return contact;
  }

  async markAsRead(id: string) {
    const contact = await this.findOne(id);

    if (contact.status !== 'UNREAD') {
      return contact;
    }

    return this.prisma.contactForm.update({
      where: { id },
      data: {
        status: 'READ',
        readAt: contact.readAt ?? new Date(),
      },
    });
  }

  async updateStatus(id: string, dto: UpdateContactStatusDto) {
    await this.findOne(id);

    return this.prisma.contactForm.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'READ' && { readAt: new Date() }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.contactForm.delete({
      where: { id },
    });
  }
}
