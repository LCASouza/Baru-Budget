import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { makeCategory } from '../../testing/finance-fixtures';
import { CategoriesStore } from './categories.store';
import { CategoryRepository } from './category.repository';

describe('CategoriesStore', () => {
  const ownerId = signal<string | null>('u1');
  const household = signal<{ members: { userId: string }[] } | null>(null);
  let repository: { listByOwners: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> };
  let store: CategoriesStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    ownerId.set('u1');
    household.set(null);
    repository = {
      listByOwners: vi.fn().mockResolvedValue([
        makeCategory({ id: 'salary', kind: 'INCOME', name: 'Salário' }),
        makeCategory({ id: 'food', kind: 'EXPENSE', name: 'Alimentação' }),
        makeCategory({ id: 'old', kind: 'EXPENSE', name: 'Antiga', active: false }),
        makeCategory({ id: 'theirs', kind: 'EXPENSE', name: 'Moradia', owner_user_id: 'u2' }),
      ]),
      rename: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FinancialContextService,
          useValue: { dataOwnerId: ownerId, currentHousehold: household },
        },
        { provide: CategoryRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(CategoriesStore);
  });

  it('loads the owner categories and indexes every visible one', async () => {
    await settle();
    expect(repository.listByOwners).toHaveBeenCalledWith(['u1']);
    expect(store.categories().map((c) => c.id)).toEqual(['salary', 'food', 'old']);
    expect(store.ofKind('EXPENSE').map((c) => c.id)).toEqual(['food', 'old']);
    expect(store.activeOfKind('EXPENSE').map((c) => c.id)).toEqual(['food']);
    expect(store.visibleOfKind('EXPENSE').map((c) => c.id)).toEqual(['food', 'old', 'theirs']);
    expect(store.byId().get('theirs')?.name).toBe('Moradia');
  });

  it('also requests the categories of household members in a household context', async () => {
    household.set({ members: [{ userId: 'u1' }, { userId: 'u2' }] });
    await settle();
    expect(repository.listByOwners).toHaveBeenLastCalledWith(['u1', 'u2']);
  });

  it('reloads after renaming', async () => {
    await settle();
    await store.rename('food', 'Mercado');
    await settle();
    expect(repository.rename).toHaveBeenCalledWith('food', 'Mercado');
    expect(repository.listByOwners).toHaveBeenCalledTimes(2);
  });
});
