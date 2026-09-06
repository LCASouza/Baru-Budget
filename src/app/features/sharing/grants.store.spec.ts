import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { GrantRepository } from './grant.repository';
import { GrantUserNotFoundError, GrantsStore, SelfGrantError } from './grants.store';

describe('GrantsStore', () => {
  const userId = signal<string | null>('u1');
  let repository: Record<'listGiven' | 'listReceived' | 'create' | 'setPermission' | 'revoke', ReturnType<typeof vi.fn>>;
  let lookupByEmail: ReturnType<typeof vi.fn>;
  let reloadOptions: ReturnType<typeof vi.fn>;
  let store: GrantsStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    repository = {
      listGiven: vi.fn().mockResolvedValue([{ id: 'g1', grantedUserId: 'u2', grantedUserName: 'Maria', permission: 'VIEW', createdAt: '' }]),
      listReceived: vi.fn().mockResolvedValue([{ id: 'g2', ownerId: 'u9', ownerName: 'Pai', permission: 'MANAGE', createdAt: '' }]),
      create: vi.fn().mockResolvedValue(undefined),
      setPermission: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue(undefined),
    };
    lookupByEmail = vi.fn().mockResolvedValue({ id: 'u3', displayName: 'Carlos' });
    reloadOptions = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId } },
        { provide: GrantRepository, useValue: repository },
        { provide: ProfileRepository, useValue: { lookupByEmail } },
        { provide: FinancialContextService, useValue: { reloadOptions } },
      ],
    });
    store = TestBed.inject(GrantsStore);
  });

  it('loads given and received grants for the user', async () => {
    await settle();
    expect(repository.listGiven).toHaveBeenCalledWith('u1');
    expect(repository.listReceived).toHaveBeenCalledWith('u1');
    expect(store.given()[0].grantedUserName).toBe('Maria');
    expect(store.received()[0].ownerName).toBe('Pai');
    expect(store.loaded()).toBe(true);
  });

  it('grants access by e-mail with the user as owner and refreshes the context', async () => {
    await settle();
    await store.grantByEmail('carlos@example.com', 'MANAGE');
    await settle();
    expect(repository.create).toHaveBeenCalledWith('u1', 'u3', 'MANAGE');
    expect(repository.listGiven).toHaveBeenCalledTimes(2);
    expect(reloadOptions).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown e-mails and self grants before touching the repository', async () => {
    await settle();
    lookupByEmail.mockResolvedValueOnce(null);
    await expect(store.grantByEmail('x@example.com', 'VIEW')).rejects.toBeInstanceOf(GrantUserNotFoundError);
    lookupByEmail.mockResolvedValueOnce({ id: 'u1', displayName: 'Eu' });
    await expect(store.grantByEmail('me@example.com', 'VIEW')).rejects.toBeInstanceOf(SelfGrantError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('changes permission and revokes through the repository', async () => {
    await settle();
    await store.setPermission('g1', 'MANAGE');
    await store.revoke('g1');
    await settle();
    expect(repository.setPermission).toHaveBeenCalledWith('g1', 'MANAGE');
    expect(repository.revoke).toHaveBeenCalledWith('g1');
    expect(reloadOptions).toHaveBeenCalledTimes(2);
  });
});
