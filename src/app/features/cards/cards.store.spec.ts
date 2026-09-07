import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { CreditCard } from './card.model';
import { CardRepository } from './card.repository';
import { CardsStore } from './cards.store';

registerLocaleData(localePt);

function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 'card-1',
    owner_user_id: 'u1',
    name: 'Cartão',
    institution: null,
    limit_amount: 1000,
    closing_day: 20,
    due_day: 5,
    color: null,
    active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    created_by: 'u1',
    updated_by: 'u1',
    ...overrides,
  };
}

describe('CardsStore', () => {
  const ownerId = signal<string | null>('u1');
  let repository: Record<'listByOwner' | 'listInvoices' | 'create', ReturnType<typeof vi.fn>>;
  let store: CardsStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    ownerId.set('u1');
    repository = {
      listByOwner: vi
        .fn()
        .mockResolvedValue([makeCard(), makeCard({ id: 'card-2', name: 'Antigo', active: false })]),
      listInvoices: vi.fn().mockResolvedValue([
        { cardId: 'card-1', dueDate: '2026-10-05', total: 300, paid: 0, purchaseCount: 2 },
        { cardId: 'card-1', dueDate: '2026-09-05', total: 200, paid: 200, purchaseCount: 1 },
      ]),
      create: vi.fn().mockResolvedValue(makeCard()),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FinancialContextService, useValue: { dataOwnerId: ownerId } },
        { provide: CardRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(CardsStore);
  });

  it('loads the cards of the context owner and their invoices', async () => {
    await settle();
    expect(repository.listByOwner).toHaveBeenCalledWith('u1');
    expect(repository.listInvoices).toHaveBeenCalledWith(['card-1', 'card-2']);
    expect(store.cards()).toHaveLength(2);
    expect(store.activeCards().map((card) => card.id)).toEqual(['card-1']);
    expect(store.nameById().get('card-2')).toBe('Antigo');
  });

  it('summarizes usage and the next invoice per card', async () => {
    await settle();
    const summary = store.summaryOf('card-1');
    expect(summary?.used).toBe(300);
    expect(summary?.available).toBe(700);
    expect(summary?.next?.dueDate).toBe('2026-10-05');
    expect(store.invoicesOf('card-1')).toHaveLength(2);
    expect(store.summaryOf('missing')).toBeNull();
  });

  it('reports unpaid invoices due in a range', async () => {
    await settle();
    expect(store.dueBetween('2026-10-01', '2026-10-31').map((invoice) => invoice.dueDate)).toEqual([
      '2026-10-05',
    ]);
    expect(store.totalDueBetween('2026-10-01', '2026-10-31')).toBe(300);
    expect(store.totalDueBetween('2026-09-01', '2026-09-30')).toBe(0);
  });

  it('reloads after a mutation and clears after logout', async () => {
    await settle();
    await store.create({ name: 'Novo', institution: null, limitAmount: null, closingDay: 1, dueDay: 10 });
    await settle();
    expect(repository.create).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Novo' }));
    expect(repository.listByOwner).toHaveBeenCalledTimes(2);

    ownerId.set(null);
    await settle();
    expect(store.cards()).toEqual([]);
  });
});
