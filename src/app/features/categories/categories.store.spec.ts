import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { makeCategory } from '../../testing/finance-fixtures';
import { CategoriesStore } from './categories.store';
import { CategoryRepository } from './category.repository';

describe('CategoriesStore', () => {
  const userId = signal<string | null>('u1');
  let repository: { listAll: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> };
  let store: CategoriesStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    userId.set('u1');
    repository = {
      listAll: vi.fn().mockResolvedValue([
        makeCategory({ id: 'salary', kind: 'INCOME', name: 'Salário' }),
        makeCategory({ id: 'food', kind: 'EXPENSE', name: 'Alimentação' }),
        makeCategory({ id: 'old', kind: 'EXPENSE', name: 'Antiga', active: false }),
      ]),
      rename: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId } },
        { provide: CategoryRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(CategoriesStore);
  });

  it('loads and indexes categories by kind', async () => {
    await settle();
    expect(store.categories()).toHaveLength(3);
    expect(store.ofKind('EXPENSE').map((c) => c.id)).toEqual(['food', 'old']);
    expect(store.activeOfKind('EXPENSE').map((c) => c.id)).toEqual(['food']);
    expect(store.byId().get('salary')?.kind).toBe('INCOME');
  });

  it('reloads after renaming', async () => {
    await settle();
    await store.rename('food', 'Mercado');
    await settle();
    expect(repository.rename).toHaveBeenCalledWith('food', 'Mercado');
    expect(repository.listAll).toHaveBeenCalledTimes(2);
  });
});
