import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminPayload, VisitorPayload } from '../../auth/types/auth.types';

export type AuthenticatedUser = AdminPayload | VisitorPayload;

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/**
 * Ambil user hasil validasi JwtStrategy dari request.
 * Dengan argumen, ambil satu field saja: `@CurrentUser('id')`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
