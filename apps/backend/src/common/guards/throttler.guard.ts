import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const url: string = req.url ?? '';
    const ip =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const userAgent = (req.headers?.['user-agent'] as string) || '';

    // Project view & like toggle → hash (IP + User-Agent)
    if (url.includes('/view') || url.includes('/like/toggle')) {
      return `hash-${createHash('sha256')
        .update(`${ip}:${userAgent}`)
        .digest('hex')}`;
    }

    // Guestbook POST → basis Visitor (sub dari JWT), fallback IP
    if (
      url.includes('/guestbook') &&
      (req.method ?? '').toUpperCase() === 'POST'
    ) {
      const visitorId = this.extractVisitorId(req);
      if (visitorId) return `visitor-${visitorId}`;
    }

    // Default: IP
    return `ip-${ip}`;
  }

  private extractVisitorId(req: Record<string, any>): string | null {
    try {
      const authHeader = req.headers?.['authorization'] as string;
      if (!authHeader?.startsWith('Bearer ')) return null;

      const token = authHeader.slice(7);
      const payload = token.split('.')[1];
      if (!payload) return null;

      const decoded = Buffer.from(payload, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as { sub?: string };
      return parsed.sub ?? null;
    } catch {
      return null;
    }
  }
}
