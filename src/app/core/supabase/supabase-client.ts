import { InjectionToken, Provider } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export type AppSupabaseClient = SupabaseClient<Database>;

export const SUPABASE_CLIENT = new InjectionToken<AppSupabaseClient>('SUPABASE_CLIENT');

export function createSupabaseClient(config: SupabaseConfig): AppSupabaseClient {
  if (!config.url || !config.publishableKey) {
    throw new Error('Supabase URL and publishable key must be configured in the environment.');
  }
  return createClient<Database>(config.url, config.publishableKey);
}

export function provideSupabase(config: SupabaseConfig): Provider {
  return {
    provide: SUPABASE_CLIENT,
    useFactory: () => createSupabaseClient(config),
  };
}
