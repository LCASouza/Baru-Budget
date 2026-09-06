import { TestBed } from '@angular/core/testing';
import { AuthError, Session } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { AuthService } from './auth.service';

type AuthChangeCallback = (event: string, session: Session | null) => void;

function fakeSession(id: string, email: string): Session {
  return { user: { id, email } } as unknown as Session;
}

function createFakeClient(initialSession: Session | null) {
  let callback: AuthChangeCallback | undefined;
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: initialSession }, error: null }),
    onAuthStateChange: vi.fn((cb: AuthChangeCallback) => {
      callback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    client: { auth },
    auth,
    emit: (session: Session | null) => callback?.('SIGNED_IN', session),
  };
}

describe('AuthService', () => {
  function setup(initialSession: Session | null) {
    const fake = createFakeClient(initialSession);
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: fake.client }],
    });
    return { service: TestBed.inject(AuthService), fake };
  }

  it('restores the persisted session before reporting ready', async () => {
    const { service } = setup(fakeSession('u1', 'alice@example.com'));
    await service.ready;
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe('alice@example.com');
  });

  it('starts unauthenticated when there is no persisted session', async () => {
    const { service } = setup(null);
    await service.ready;
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('follows auth state changes emitted by the client', async () => {
    const { service, fake } = setup(null);
    await service.ready;
    fake.emit(fakeSession('u2', 'bob@example.com'));
    expect(service.user()?.id).toBe('u2');
    fake.emit(null);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('returns the sign-in error instead of throwing', async () => {
    const { service, fake } = setup(null);
    const error = new AuthError('Invalid login credentials', 400, 'invalid_credentials');
    fake.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error });
    await expect(service.signIn({ email: 'a@b.c', password: 'x' })).resolves.toBe(error);
    expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'x' });
  });

  it('signs out through the client', async () => {
    const { service, fake } = setup(fakeSession('u1', 'alice@example.com'));
    await service.signOut();
    expect(fake.auth.signOut).toHaveBeenCalled();
  });
});
