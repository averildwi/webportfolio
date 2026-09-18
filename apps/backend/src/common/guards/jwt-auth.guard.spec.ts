import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function createContext(): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  } as unknown as ExecutionContext;
}

function guardWith(metadata: Record<string, unknown>): JwtAuthGuard {
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  return new JwtAuthGuard(reflector);
}

/** Prototype AuthGuard, tempat `super.canActivate` sesungguhnya berada. */
function superProtoOf(guard: JwtAuthGuard): {
  canActivate: (ctx: ExecutionContext) => boolean;
} {
  return Object.getPrototypeOf(Object.getPrototypeOf(guard)) as {
    canActivate: (ctx: ExecutionContext) => boolean;
  };
}

describe('JwtAuthGuard', () => {
  it('meloloskan route @Public tanpa menyentuh Passport', () => {
    const guard = guardWith({ [IS_PUBLIC_KEY]: true });
    const superSpy = jest.spyOn(superProtoOf(guard), 'canActivate');

    expect(guard.canActivate(createContext())).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();

    superSpy.mockRestore();
  });

  it('mendelegasikan ke Passport bila route tidak ditandai @Public', () => {
    // Inti dari default-deny: tanpa penanda apa pun, autentikasi tetap
    // dijalankan. Handler baru yang lupa dikonfigurasi gagal dengan 401,
    // bukan terbuka tanpa proteksi.
    const guard = guardWith({});
    const superSpy = jest
      .spyOn(superProtoOf(guard), 'canActivate')
      .mockReturnValue(false);

    expect(guard.canActivate(createContext())).toBe(false);
    expect(superSpy).toHaveBeenCalledTimes(1);

    superSpy.mockRestore();
  });

  it('memperlakukan isPublic bernilai false sebagai terproteksi', () => {
    const guard = guardWith({ [IS_PUBLIC_KEY]: false });
    const superSpy = jest
      .spyOn(superProtoOf(guard), 'canActivate')
      .mockReturnValue(false);

    expect(guard.canActivate(createContext())).toBe(false);
    expect(superSpy).toHaveBeenCalled();

    superSpy.mockRestore();
  });
});
