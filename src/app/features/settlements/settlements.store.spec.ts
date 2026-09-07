import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { AccountsStore } from '../accounts/accounts.store';
import { GrantsStore } from '../sharing/grants.store';
import { makeTransaction } from '../../testing/finance-fixtures';
import { SettlementsRepository } from './settlements.repository';
import { SettlementsStore } from './settlements.store';

describe('SettlementsStore', () => {
  const ownerId = signal<string | null>('me');
  const memberNameById = signal<ReadonlyMap<string, string>>(new Map([['pai', 'Pai']]));
  let repository: Record<
    'listBalances' | 'listPairAllocations' | 'listPairSettlements' | 'createSettlement',
    ReturnType<typeof vi.fn>
  >;
  let reloadBalances: ReturnType<typeof vi.fn>;
  let store: SettlementsStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    ownerId.set('me');
    repository = {
      listBalances: vi.fn().mockResolvedValue([
        { userId: 'pai', balance: 420 },
        { userId: 'mae', balance: -80 },
        { userId: 'zero', balance: 0 },
      ]),
      listPairAllocations: vi.fn().mockResolvedValue([]),
      listPairSettlements: vi.fn().mockResolvedValue([
        makeTransaction({ id: 's1', kind: 'SETTLEMENT', owner_user_id: 'me', counterparty_user_id: 'pai', settlement_direction: 'RECEIVE', amount: 100 }),
      ]),
      createSettlement: vi.fn().mockResolvedValue(undefined),
    };
    reloadBalances = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: FinancialContextService, useValue: { dataOwnerId: ownerId, canManage: signal(true), memberNameById } },
        { provide: SettlementsRepository, useValue: repository },
        {
          provide: ProfileRepository,
          useValue: {
            findManyByIds: vi.fn().mockResolvedValue([
              { id: 'pai', display_name: 'Pai' },
              { id: 'mae', display_name: 'Mãe' },
              { id: 'zero', display_name: 'Zerado' },
            ]),
          },
        },
        { provide: GrantsStore, useValue: { given: signal([]), received: signal([]) } },
        { provide: AccountsStore, useValue: { reloadBalances } },
      ],
    });
    store = TestBed.inject(SettlementsStore);
  });

  it('loads the balances with the names of each person', async () => {
    await settle();
    expect(store.balances().map((entry) => entry.name)).toEqual(['Pai', 'Zerado', 'Mãe']);
    expect(store.open().map((entry) => entry.userId)).toEqual(['pai', 'mae']);
  });

  it('totals receivables, payables and the net balance', async () => {
    await settle();
    expect(store.totals()).toEqual({ receivable: 420, payable: 80, net: 340 });
  });

  it('offers the people of the household, the grants and the open balances', async () => {
    await settle();
    expect(store.people().map((person) => person.id)).toEqual(['mae', 'pai', 'zero']);
  });

  it('loads the items of the selected person only', async () => {
    await settle();
    expect(repository.listPairAllocations).not.toHaveBeenCalled();
    store.toggle('pai');
    await settle();
    expect(repository.listPairAllocations).toHaveBeenCalledWith('me', 'pai');
    expect(store.items()).toHaveLength(1);
    store.toggle('pai');
    expect(store.selected()).toBeNull();
  });

  it('records a settlement for the context owner and refreshes the balances', async () => {
    await settle();
    await store.recordSettlement({
      counterpartyUserId: 'pai',
      direction: 'RECEIVE',
      description: 'Pix',
      amount: 420,
      date: '2026-09-15',
      accountId: 'acc-bank',
    });
    await settle();
    expect(repository.createSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 'me', counterpartyUserId: 'pai', amount: 420 }),
    );
    expect(repository.listBalances).toHaveBeenCalledTimes(2);
    expect(reloadBalances).toHaveBeenCalled();
  });

  it('clears after logout', async () => {
    await settle();
    ownerId.set(null);
    await settle();
    expect(store.balances()).toEqual([]);
  });
});
