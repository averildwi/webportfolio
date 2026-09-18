import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Context tiruan: hanya menyediakan yang dibaca guard — handler, class, dan
 * `request.user`.
 */
function createContext(user?: { role: string }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

/** Guard dengan metadata yang sudah ditentukan, meniru hasil dekorator. */
function guardWith(metadata: Record<string, unknown>): RolesGuard {
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('meloloskan route @Public tanpa melihat role', () => {
    const guard = guardWith({ [IS_PUBLIC_KEY]: true });

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('meloloskan route terautentikasi tanpa @Roles', () => {
    // Tanpa @Roles berarti "cukup login", dan itu sudah ditegakkan JwtAuthGuard.
    const guard = guardWith({});

    expect(guard.canActivate(createContext({ role: 'VISITOR' }))).toBe(true);
  });

  it('meloloskan user dengan role yang sesuai', () => {
    const guard = guardWith({ [ROLES_KEY]: ['ADMIN'] });

    expect(guard.canActivate(createContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('menolak user dengan role yang tidak sesuai', () => {
    const guard = guardWith({ [ROLES_KEY]: ['ADMIN'] });

    expect(() => guard.canActivate(createContext({ role: 'VISITOR' }))).toThrow(
      ForbiddenException,
    );
  });

  it('menolak saat request tidak punya user sama sekali', () => {
    const guard = guardWith({ [ROLES_KEY]: ['ADMIN'] });

    expect(() => guard.canActivate(createContext())).toThrow('Akses ditolak');
  });

  it('mendukung beberapa role yang diizinkan', () => {
    const guard = guardWith({ [ROLES_KEY]: ['ADMIN', 'VISITOR'] });

    expect(guard.canActivate(createContext({ role: 'ADMIN' }))).toBe(true);
    expect(guard.canActivate(createContext({ role: 'VISITOR' }))).toBe(true);
  });

  it('@Public menang atas @Roles bila keduanya ada', () => {
    const guard = guardWith({
      [IS_PUBLIC_KEY]: true,
      [ROLES_KEY]: ['ADMIN'],
    });

    expect(guard.canActivate(createContext())).toBe(true);
  });
});
