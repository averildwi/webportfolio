import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { CreateContactDto, UpdateContactStatusDto } from './dto/contact.dto';
import { ContactStatus } from 'generated/prisma/client';

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

  async findAll(options?: {
    status?: ContactStatus;
    page?: number;
    limit?: number;
  }) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(options?.status !== undefined && { status: options.status }),
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

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const contact = await this.prisma.contactForm.findUnique({
      where: { id },
    });

    if (!contact) {
      throw new NotFoundException('Pesan tidak ditemukan');
    }

    // Auto-mark UNREAD -> READ
    if (contact.status === 'UNREAD' && !contact.readAt) {
      return this.prisma.contactForm.update({
        where: { id },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      });
    }

    return contact;
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
