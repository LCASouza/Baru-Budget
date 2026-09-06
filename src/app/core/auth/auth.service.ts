import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthError, Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';

export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly sessionState = signal<Session | null>(null);

  readonly session = this.sessionState.asReadonly();
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  // Resolves once the persisted session has been restored, so route guards can
  // wait for it instead of redirecting during application startup.
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.client.auth.getSession().then(({ data }) => {
      this.sessionState.set(data.session);
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      this.sessionState.set(session);
    });
  }

  async signIn(credentials: SignInCredentials): Promise<AuthError | null> {
    const { error } = await this.client.auth.signInWithPassword(credentials);
    return error;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}
