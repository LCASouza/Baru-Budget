import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { User } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { CurrentProfileService } from './current-profile.service';
import { Profile } from './profile.model';
import { ProfileRepository } from './profile.repository';

const PROFILE: Profile = {
  id: 'u1',
  display_name: 'Lucas Souza',
  avatar_url: null,
  created_at: '2026-09-05T00:00:00Z',
  updated_at: '2026-09-05T00:00:00Z',
};

describe('CurrentProfileService', () => {
  const user = signal<User | null>(null);
  let findById: ReturnType<typeof vi.fn>;
  let service: CurrentProfileService;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    user.set(null);
    findById = vi.fn().mockResolvedValue(PROFILE);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: ProfileRepository, useValue: { findById } },
      ],
    });
    service = TestBed.inject(CurrentProfileService);
  });

  it('has no profile without an authenticated user', async () => {
    await settle();
    expect(service.profile()).toBeNull();
    expect(findById).not.toHaveBeenCalled();
    expect(service.initials()).toBe('?');
  });

  it('loads the profile of the authenticated user', async () => {
    user.set({ id: 'u1', email: 'lucas@example.com' } as User);
    await settle();
    expect(findById).toHaveBeenCalledWith('u1');
    expect(service.displayName()).toBe('Lucas Souza');
    expect(service.email()).toBe('lucas@example.com');
    expect(service.initials()).toBe('LS');
  });

  it('clears the profile after logout', async () => {
    user.set({ id: 'u1', email: 'lucas@example.com' } as User);
    await settle();
    user.set(null);
    await settle();
    expect(service.profile()).toBeNull();
  });
});
