import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService, NotificationService],
  exports: [ContactService],
})
export class ContactModule {}
