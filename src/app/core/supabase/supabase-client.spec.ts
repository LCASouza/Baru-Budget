import { TestBed } from '@angular/core/testing';
import { SUPABASE_CLIENT, createSupabaseClient, provideSupabase } from './supabase-client';

describe('createSupabaseClient', () => {
  it('creates a client from the given configuration', () => {
    const client = createSupabaseClient({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'test-key',
    });
    expect(typeof client.from).toBe('function');
  });

  it('rejects a missing configuration', () => {
    expect(() => createSupabaseClient({ url: '', publishableKey: '' })).toThrowError(/Supabase/);
  });
});

describe('provideSupabase', () => {
  it('provides the client through the injection token', () => {
    TestBed.configureTestingModule({
      providers: [provideSupabase({ url: 'http://127.0.0.1:54321', publishableKey: 'test-key' })],
    });
    const client = TestBed.inject(SUPABASE_CLIENT);
    expect(typeof client.from).toBe('function');
  });
});
