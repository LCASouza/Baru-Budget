import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { makeAccount } from '../../testing/finance-fixtures';
import { AccountRepository } from './account.repository';
import { AccountsStore } from './accounts.store';

describe('AccountsStore', () => {
  const ownerId = signal<string | null>(null);
  let repository: {
    listByOwner: ReturnType<typeof vi.fn>;
    listBalances: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    setActive: ReturnType<typeof vi.fn>;
  };
  let store: AccountsStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    ownerId.set(null);
    repository = {
      listByOwner: vi.fn().mockResolvedValue([
        makeAccount({ id: 'bank', opening_balance: 100 }),
        makeAccount({ id: 'meal', name: 'VA', type: 'BENEFIT' }),
        makeAccount({ id: 'old', name: 'Antiga', active: false }),
      ]),
      listBalances: vi.fn().mockResolvedValue([
        { accountId: 'bank', openingBalance: 100, currentBalance: 250 },
        { accountId: 'meal', openingBalance: 0, currentBalance: 80 },
      ]),
      create: vi.fn().mockResolvedValue(makeAccount()),
      setActive: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FinancialContextService, useValue: { dataOwnerId: ownerId } },
        { provide: AccountRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(AccountsStore);
  });

  it('stays empty without an authenticated user', async () => {
    await settle();
    expect(store.accounts()).toEqual([]);
    expect(repository.listByOwner).not.toHaveBeenCalled();
    expect(store.totals()).toEqual({ money: 0, benefit: 0 });
  });

  it('loads accounts and balances for the context owner', async () => {
    ownerId.set('u1');
    await settle();
    expect(repository.listByOwner).toHaveBeenCalledWith('u1');
    expect(repository.listBalances).toHaveBeenCalledWith('u1');
    expect(store.accounts()).toHaveLength(3);
    expect(store.activeAccounts().map((a) => a.id)).toEqual(['bank', 'meal']);
    expect(store.byId().get('meal')?.name).toBe('VA');
    expect(store.balanceById().get('bank')).toBe(250);
    expect(store.totals()).toEqual({ money: 250, benefit: 80 });
  });

  it('reloads after a mutation', async () => {
    ownerId.set('u1');
    await settle();
    await store.create({ name: 'Nova', type: 'CASH', institution: null, openingBalance: 10 });
    await settle();
    expect(repository.create).toHaveBeenCalledWith('u1', {
      name: 'Nova',
      type: 'CASH',
      institution: null,
      openingBalance: 10,
    });
    expect(repository.listByOwner).toHaveBeenCalledTimes(2);
    expect(repository.listBalances).toHaveBeenCalledTimes(2);
  });

  it('clears after logout', async () => {
    ownerId.set('u1');
    await settle();
    ownerId.set(null);
    await settle();
    expect(store.accounts()).toEqual([]);
  });

  it('exposes load errors', async () => {
    repository.listByOwner.mockRejectedValueOnce(new Error('offline'));
    ownerId.set('u1');
    await settle();
    expect(store.error()).toBeTruthy();
    expect(store.accounts()).toEqual([]);
  });
});
