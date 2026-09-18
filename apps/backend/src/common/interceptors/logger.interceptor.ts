import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap, catchError, throwError } from 'rxjs';

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { method, originalUrl, ip } = request;
    const start = Date.now();

    this.logger.log(`--> ${method} ${originalUrl}`);

    return next.handle().pipe(
      tap(() => {
        const response = http.getResponse<Response>();
        const duration = Date.now() - start;
        this.logger.log(
          `<-- ${method} ${originalUrl} ${response.statusCode} +${duration}ms`,
        );
      }),
      catchError((err: unknown) => {
        const duration = Date.now() - start;
        const status = LoggerInterceptor.resolveStatus(err);
        const message = err instanceof Error ? err.message : 'Unknown error';

        this.logger.warn(
          `<-x ${method} ${originalUrl} ${status} +${duration}ms — ${message} (ip: ${ip ?? 'unknown'})`,
        );

        return throwError(() => err);
      }),
    );
  }

  private static resolveStatus(err: unknown): number {
    if (typeof err !== 'object' || err === null) return 500;

    const candidate = err as {
      status?: unknown;
      getStatus?: () => number;
    };

    if (typeof candidate.getStatus === 'function') {
      return candidate.getStatus();
    }
    if (typeof candidate.status === 'number') {
      return candidate.status;
    }
    return 500;
  }
}
