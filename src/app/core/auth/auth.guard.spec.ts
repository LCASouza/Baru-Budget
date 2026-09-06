import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from './auth.service';

function setup(authenticated: boolean) {
  const fakeAuth = { ready: Promise.resolve(), isAuthenticated: signal(authenticated) };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth }],
  });
  const router = TestBed.inject(Router);
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/cards' } as RouterStateSnapshot;
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard(route, state)) as Promise<boolean | UrlTree>;
  return { router, run };
}

describe('authGuard', () => {
  it('allows authenticated users', async () => {
    const { run } = setup(true);
    await expect(run(authGuard)).resolves.toBe(true);
  });

  it('redirects anonymous users to the login page with the return url', async () => {
    const { router, run } = setup(false);
    const result = await run(authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fcards');
  });
});

describe('guestGuard', () => {
  it('allows anonymous users', async () => {
    const { run } = setup(false);
    await expect(run(guestGuard)).resolves.toBe(true);
  });

  it('redirects authenticated users to the dashboard', async () => {
    const { router, run } = setup(true);
    const result = await run(guestGuard);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });
});
