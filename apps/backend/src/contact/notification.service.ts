import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContactForm } from 'generated/prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private configService: ConfigService) {}

  async notifyNewContact(contact: ContactForm) {
    await Promise.allSettled([
      this.sendDiscord(contact),
      this.sendTelegram(contact),
      this.sendAutoReplyEmail(contact),
    ]);
  }

  private async sendDiscord(contact: ContactForm) {
    const webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `📬 **New Contact Message**\n**From:** ${contact.name} (${contact.email})\n**Subject:** ${contact.subject}\n\n${contact.message}`,
        }),
      });
    } catch (err) {
      this.logger.warn(`Discord webhook gagal: ${(err as Error).message}`);
    }
  }

  private async sendTelegram(contact: ContactForm) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');
    if (!botToken || !chatId) return;

    // Plain text tanpa parse_mode agar karakter khusus user tidak memicu error 400
    const text = `📬 New Contact Message\nFrom: ${contact.name} (${contact.email})\nSubject: ${contact.subject}\n\n${contact.message}`;

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
    } catch (err) {
      this.logger.warn(`Telegram webhook gagal: ${(err as Error).message}`);
    }
  }

  private async sendAutoReplyEmail(contact: ContactForm) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'noreply@averildwi.com';
    if (!apiKey) return;

    const safeName = this.escapeHtml(contact.name);
    const safeSubject = this.escapeHtml(contact.subject);

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [contact.email],
          subject: `Re: ${contact.subject}`,
          html: `<p>Hi ${safeName},</p><p>Terima kasih sudah menghubungi saya! Pesan Anda telah diterima dan akan saya balas secepatnya.</p><p>— Averil</p>`,
        }),
      });
    } catch (err) {
      this.logger.warn(`Auto-reply email gagal: ${(err as Error).message}`);
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
