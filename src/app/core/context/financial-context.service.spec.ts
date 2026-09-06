import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { ContextRepository } from './context.repository';
import { FinancialContextService } from './financial-context.service';

describe('FinancialContextService', () => {
  const userId = signal<string | null>('u1');
  let repository: { listMyHouseholds: ReturnType<typeof vi.fn>; listReceivedGrants: ReturnType<typeof vi.fn> };
  let service: FinancialContextService;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    localStorage.clear();
    userId.set('u1');
    repository = {
      listMyHouseholds: vi.fn().mockResolvedValue([
        { id: 'h1', name: 'Família', role: 'ADMIN', members: [{ userId: 'u1', displayName: 'Eu' }, { userId: 'u2', displayName: 'Maria' }] },
      ]),
      listReceivedGrants: vi.fn().mockResolvedValue([
        { ownerId: 'u9', ownerName: 'Pai', permission: 'VIEW' },
        { ownerId: 'u8', ownerName: 'Esposa', permission: 'MANAGE' },
      ]),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId } },
        { provide: ContextRepository, useValue: repository },
      ],
    });
    service = TestBed.inject(FinancialContextService);
  });

  it('starts in the personal context with the user as data owner', async () => {
    await settle();
    expect(service.context().kind).toBe('personal');
    expect(service.options()).toHaveLength(4);
    expect(service.dataOwnerId()).toBe('u1');
    expect(service.householdId()).toBeNull();
    expect(service.canManage()).toBe(true);
    expect(service.canManageOwner('u1')).toBe(true);
    expect(service.canManageOwner('u9')).toBe(false);
  });

  it('switches to a shared context and derives owner and permission', async () => {
    await settle();
    service.select({ kind: 'shared', ownerId: 'u9', ownerName: 'Pai', permission: 'VIEW' });
    expect(service.dataOwnerId()).toBe('u9');
    expect(service.canManage()).toBe(false);
    expect(service.canManageOwner('u9')).toBe(false);

    service.select({ kind: 'shared', ownerId: 'u8', ownerName: 'Esposa', permission: 'MANAGE' });
    expect(service.canManage()).toBe(true);
    expect(service.canManageOwner('u8')).toBe(true);
    expect(service.canManageOwner('u9')).toBe(false);
  });

  it('switches to a household context keeping the user as data owner', async () => {
    await settle();
    service.select({ kind: 'household', householdId: 'h1', name: 'Família', role: 'ADMIN' });
    expect(service.dataOwnerId()).toBe('u1');
    expect(service.householdId()).toBe('h1');
    expect(service.currentHousehold()?.name).toBe('Família');
    expect(service.memberNameById().get('u2')).toBe('Maria');
    expect(service.canManage()).toBe(true);
    expect(service.canManageOwner('u2')).toBe(false);
  });

  it('persists the selection per user and restores it', async () => {
    await settle();
    service.select({ kind: 'household', householdId: 'h1', name: 'Família', role: 'ADMIN' });
    await settle();
    expect(localStorage.getItem('baru-budget.context.u1')).toBe('household:h1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId } },
        { provide: ContextRepository, useValue: repository },
      ],
    });
    const restored = TestBed.inject(FinancialContextService);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(restored.context()).toMatchObject({ kind: 'household', householdId: 'h1' });
  });

  it('falls back to the personal context when the persisted option disappears', async () => {
    localStorage.setItem('baru-budget.context.u1', 'shared:u7');
    await settle();
    expect(service.context().kind).toBe('personal');
  });

  it('is personal without an authenticated user', async () => {
    userId.set(null);
    await settle();
    expect(service.context().kind).toBe('personal');
    expect(service.dataOwnerId()).toBeNull();
    expect(service.options()).toHaveLength(1);
  });
});
