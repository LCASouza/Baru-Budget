import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { HouseholdRepository } from './household.repository';
import { HouseholdsStore, UserNotFoundError } from './households.store';

describe('HouseholdsStore', () => {
  const userId = signal<string | null>('u1');
  let repository: Record<'listMine' | 'create' | 'addMember' | 'leave', ReturnType<typeof vi.fn>>;
  let lookupByEmail: ReturnType<typeof vi.fn>;
  let reloadOptions: ReturnType<typeof vi.fn>;
  let store: HouseholdsStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    repository = {
      listMine: vi.fn().mockResolvedValue([
        { id: 'h1', name: 'Família', members: [{ userId: 'u1', displayName: 'Eu', role: 'ADMIN', status: 'ACTIVE', joinedAt: '' }] },
      ]),
      create: vi.fn().mockResolvedValue({ id: 'h2' }),
      addMember: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
    };
    lookupByEmail = vi.fn().mockResolvedValue({ id: 'u2', displayName: 'Maria' });
    reloadOptions = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId } },
        { provide: HouseholdRepository, useValue: repository },
        { provide: ProfileRepository, useValue: { lookupByEmail } },
        { provide: FinancialContextService, useValue: { reloadOptions } },
      ],
    });
    store = TestBed.inject(HouseholdsStore);
  });

  it('loads the households of the user', async () => {
    await settle();
    expect(store.households()).toHaveLength(1);
    expect(store.households()[0].name).toBe('Família');
  });

  it('adds a member by e-mail and refreshes the context options', async () => {
    await settle();
    await store.addMemberByEmail('h1', ' maria@example.com ', 'MEMBER');
    await settle();
    expect(lookupByEmail).toHaveBeenCalledWith(' maria@example.com ');
    expect(repository.addMember).toHaveBeenCalledWith('h1', 'u2', 'MEMBER');
    expect(repository.listMine).toHaveBeenCalledTimes(2);
    expect(reloadOptions).toHaveBeenCalledTimes(1);
  });

  it('fails with a dedicated error when the e-mail is unknown', async () => {
    await settle();
    lookupByEmail.mockResolvedValueOnce(null);
    await expect(store.addMemberByEmail('h1', 'x@example.com', 'MEMBER')).rejects.toBeInstanceOf(UserNotFoundError);
    expect(repository.addMember).not.toHaveBeenCalled();
  });

  it('creates and leaves households through the repository', async () => {
    await settle();
    await store.create('Casa');
    await store.leave('h1');
    await settle();
    expect(repository.create).toHaveBeenCalledWith('Casa');
    expect(repository.leave).toHaveBeenCalledWith('h1');
    expect(reloadOptions).toHaveBeenCalledTimes(2);
  });
});
