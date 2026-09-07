import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ApplicationRef, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { FinancialContext, PERSONAL_CONTEXT } from '../../../core/context/financial-context.model';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { ProfileRepository } from '../../../core/profile/profile.repository';
import { makeAccount, makeCategory, makeTransaction } from '../../../testing/finance-fixtures';
import { AccountsStore } from '../../accounts/accounts.store';
import { CategoriesStore } from '../../categories/categories.store';
import { CardsStore } from '../../cards/cards.store';
import { InstallmentsStore } from '../../installments/installments.store';
import { CreditCard } from '../../cards/card.model';
import { TransactionFormData } from '../open-transaction-dialog';
import { TransactionsStore } from '../transactions.store';
import { TransactionFormDialog } from './transaction-form-dialog';

registerLocaleData(localePt);

describe('TransactionFormDialog', () => {
  let fixture: ComponentFixture<TransactionFormDialog>;
  let component: TransactionFormDialog;
  let store: Record<'create' | 'update' | 'remove' | 'createInstallments' | 'removeInstallmentGroup', ReturnType<typeof vi.fn>>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  const accounts = signal([
    makeAccount(),
    makeAccount({ id: 'acc-cash', name: 'Dinheiro', type: 'CASH' }),
    makeAccount({ id: 'acc-old', name: 'Antiga', active: false }),
  ]);
  const categories = signal([
    makeCategory(),
    makeCategory({ id: 'cat-salary', kind: 'INCOME', name: 'Salário' }),
    makeCategory({ id: 'cat-old', name: 'Antiga', active: false }),
  ]);

  const context = signal<FinancialContext>(PERSONAL_CONTEXT);
  const cards = signal<CreditCard[]>([]);
  const cardsService = {
    cards,
    activeCards: computed(() => cards().filter((card) => card.active)),
    byId: computed(() => new Map(cards().map((card) => [card.id, card]))),
    nameById: computed(() => new Map(cards().map((card) => [card.id, card.name]))),
    invoicesOf: (cardId: string) =>
      cards().some((card) => card.id === cardId)
        ? [{ dueDate: '2026-10-05', label: 'Fatura de Outubro 2026' }]
        : [],
    reload: vi.fn(),
  };

  function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
    return {
      id: 'card-1',
      owner_user_id: 'u1',
      name: 'Cartão',
      institution: null,
      limit_amount: 5000,
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
  const households = signal<{ id: string; name: string; members: { userId: string; displayName: string }[] }[]>([]);
  let findManyByIds: ReturnType<typeof vi.fn>;

  // Form is protected; tests reach it through the component instance.
  const form = () => (component as unknown as { form: TransactionFormDialog['form'] }).form;

  const contextService = {
    context,
    households,
    householdId: computed(() => {
      const c = context();
      return c.kind === 'household' ? c.householdId : null;
    }),
    canManage: computed(() => {
      const c = context();
      return c.kind !== 'shared' || c.permission === 'MANAGE';
    }),
    canManageOwner: (ownerId: string) => {
      const c = context();
      return ownerId === 'u1' || (c.kind === 'shared' && c.ownerId === ownerId && c.permission === 'MANAGE');
    },
    memberNameById: computed(
      () => new Map(households().flatMap((h) => h.members.map((m) => [m.userId, m.displayName] as const))),
    ),
  };

  async function setup(
    data: TransactionFormData = {},
    profiles: { id: string; display_name: string }[] = [],
  ): Promise<void> {
    findManyByIds = vi.fn().mockResolvedValue(profiles);
    store = {
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      createInstallments: vi.fn().mockResolvedValue(undefined),
      removeInstallmentGroup: vi.fn().mockResolvedValue(undefined),
    };
    dialogRef = { close: vi.fn() };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TransactionFormDialog],
      providers: [
        provideRouter([]),
        provideNativeDateAdapter(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: TransactionsStore, useValue: store },
        { provide: FinancialContextService, useValue: contextService },
        { provide: CardsStore, useValue: cardsService },
        {
          provide: InstallmentsStore,
          useValue: {
            totalRemaining: signal(0),
            remainingCount: signal(0),
            create: vi.fn(),
            removeGroup: vi.fn(),
            reload: vi.fn(),
          },
        },
        { provide: ProfileRepository, useValue: { findManyByIds } },
        {
          provide: AccountsStore,
          useValue: {
            accounts,
            activeAccounts: computed(() => accounts().filter((a) => a.active)),
            isLoading: signal(false),
            loaded: signal(true),
          },
        },
        {
          provide: CategoriesStore,
          useValue: {
            ofKind: (kind: string) => categories().filter((c) => c.kind === kind),
            byId: computed(() => new Map(categories().map((c) => [c.id, c]))),
          },
        },
      ],
    }).compileComponents();
    // MatDialogModule provides MatDialog inside the component injector, so the
    // confirmation double has to be added there.
    TestBed.overrideComponent(TransactionFormDialog, {
      add: {
        providers: [
          { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
        ],
      },
    });
    fixture = TestBed.createComponent(TransactionFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    context.set(PERSONAL_CONTEXT);
    households.set([]);
    cards.set([]);
  });

  it('starts as an expense with today and PAID by default', async () => {
    await setup();
    const value = form().getRawValue();
    expect(value.kind).toBe('EXPENSE');
    expect(value.status).toBe('PAID');
    expect(value.date).toBeInstanceOf(Date);
    expect(component['categories']().map((c) => c.id)).toEqual(['cat-food']);
    expect(component['accounts']().map((a) => a.id)).toEqual(['acc-bank', 'acc-cash']);
  });

  it('resets the category and switches lists when the kind changes', async () => {
    await setup();
    form().controls.categoryId.setValue('cat-food');
    form().controls.kind.setValue('INCOME');
    expect(form().controls.categoryId.value).toBe('');
    expect(component['categories']().map((c) => c.id)).toEqual(['cat-salary']);
  });

  it('requires a different destination account for transfers and drops the category', async () => {
    await setup();
    form().controls.kind.setValue('TRANSFER');
    form().patchValue({ description: 'Saque', amount: '200', accountId: 'acc-bank', destinationAccountId: 'acc-bank' });
    expect(component['isTransfer']()).toBe(true);
    expect(form().controls.categoryId.valid).toBe(true);
    expect(form().controls.destinationAccountId.hasError('sameAccount')).toBe(true);

    form().controls.destinationAccountId.setValue('acc-cash');
    await component['save']();
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'TRANSFER', categoryId: null, accountId: 'acc-bank', destinationAccountId: 'acc-cash', amount: 200 }),
    );
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('does not save an invalid form', async () => {
    await setup();
    await component['save']();
    expect(store.create).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(form().controls.description.touched).toBe(true);
  });

  it('saves an expense with parsed amount, local date and optional due date', async () => {
    await setup();
    form().patchValue({
      description: '  Supermercado ',
      amount: '1.234,56',
      date: new Date(2026, 8, 5, 23, 30),
      categoryId: 'cat-food',
      accountId: 'acc-bank',
      status: 'PENDING',
      dueDate: new Date(2026, 8, 10),
      notes: '  ',
    });
    await component['save']();
    expect(store.create).toHaveBeenCalledWith({
      kind: 'EXPENSE',
      description: 'Supermercado',
      amount: 1234.56,
      date: '2026-09-05',
      dueDate: '2026-09-10',
      status: 'PENDING',
      categoryId: 'cat-food',
      accountId: 'acc-bank',
      destinationAccountId: null,
      creditCardId: null,
      invoiceDueDate: null,
      householdId: null,
      notes: null,
    });
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('offers the household field only to household members and preselects the current household', async () => {
    await setup();
    expect(component['showHouseholdField']()).toBe(false);

    households.set([{ id: 'h1', name: 'Família', members: [{ userId: 'u1', displayName: 'Eu' }] }]);
    context.set({ kind: 'household', householdId: 'h1', name: 'Família', role: 'ADMIN' });
    TestBed.resetTestingModule();
    await setup();
    expect(component['showHouseholdField']()).toBe(true);
    expect(form().controls.householdId.value).toBe('h1');
    form().patchValue({ description: 'Feira', amount: '80', categoryId: 'cat-food', accountId: 'acc-bank' });
    await component['save']();
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ householdId: 'h1' }));
  });

  it('hides the household field in a shared context and keeps the stored value', async () => {
    households.set([{ id: 'h1', name: 'Família', members: [] }]);
    context.set({ kind: 'shared', ownerId: 'u9', ownerName: 'Pai', permission: 'MANAGE' });
    await setup({ transaction: makeTransaction({ owner_user_id: 'u9', household_id: 'h7' }) });
    expect(component['showHouseholdField']()).toBe(false);
    expect(component['readonly']).toBe(false);
    form().controls.description.setValue('Editado');
    await component['save']();
    expect(store.update).toHaveBeenCalledWith('tx-1', expect.objectContaining({ householdId: 'h7' }));
  });

  it('opens read-only under a VIEW grant and for transactions of other members', async () => {
    context.set({ kind: 'shared', ownerId: 'u9', ownerName: 'Pai', permission: 'VIEW' });
    await setup({ transaction: makeTransaction({ owner_user_id: 'u9' }) });
    expect(component['readonly']).toBe(true);
    expect(form().disabled).toBe(true);
    await component['save']();
    expect(store.update).not.toHaveBeenCalled();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tx-form__owner')).not.toBeNull();

    TestBed.resetTestingModule();
    households.set([{ id: 'h1', name: 'Família', members: [{ userId: 'u2', displayName: 'Maria' }] }]);
    context.set({ kind: 'household', householdId: 'h1', name: 'Família', role: 'MEMBER' });
    await setup({ transaction: makeTransaction({ owner_user_id: 'u2', account_id: 'acc-hidden' }) });
    expect(component['readonly']).toBe(true);
    expect(component['ownerName']()).toBe('Maria');
    expect(component['accounts']().find((a) => a.id === 'acc-hidden')?.name).toBe('Conta de Maria');
  });

  it('shows who registered and changed the transaction when different from the owner', async () => {
    await setup({ transaction: makeTransaction({ created_by: 'u5', updated_by: 'u6' }) }, [
      { id: 'u5', display_name: 'Bob' },
      { id: 'u6', display_name: 'Carol' },
    ]);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(findManyByIds).toHaveBeenLastCalledWith(['u5', 'u6']);
    expect(component['auditEntries']().map((e) => `${e.label} ${e.name}`)).toEqual([
      'Registrado por Bob',
      'Alterado por Carol',
    ]);
  });

  it('ignores the due date when the status is not pending', async () => {
    await setup();
    form().patchValue({ description: 'Luz', amount: '10', categoryId: 'cat-food', accountId: 'acc-bank', status: 'PAID', dueDate: new Date(2026, 8, 10) });
    await component['save']();
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ dueDate: null }));
  });

  it('shows an error and stays open when saving fails', async () => {
    await setup();
    store.create.mockRejectedValueOnce(new Error('offline'));
    form().patchValue({ description: 'Luz', amount: '10', categoryId: 'cat-food', accountId: 'acc-bank' });
    await component['save']();
    expect(snackBar.open).toHaveBeenCalledWith('Não foi possível salvar a movimentação.', 'OK', expect.anything());
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('prefills and updates an existing transaction, keeping inactive references selectable', async () => {
    await setup({
      transaction: makeTransaction({ id: 'tx-9', amount: 99.9, category_id: 'cat-old', account_id: 'acc-old', status: 'PENDING', due_date: '2026-09-15' }),
    });
    const value = form().getRawValue();
    expect(value.amount).toBe('99,90');
    expect(value.categoryId).toBe('cat-old');
    expect(value.dueDate?.getDate()).toBe(15);
    expect(component['categories']().map((c) => c.id)).toEqual(['cat-food', 'cat-old']);
    expect(component['accounts']().map((a) => a.id)).toEqual(['acc-bank', 'acc-cash', 'acc-old']);

    form().controls.description.setValue('Editado');
    await component['save']();
    expect(store.update).toHaveBeenCalledWith('tx-9', expect.objectContaining({ description: 'Editado', amount: 99.9 }));
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('offers the card option only when there are active cards', async () => {
    await setup();
    expect(component['showMethodToggle']()).toBe(false);

    cards.set([makeCard()]);
    TestBed.resetTestingModule();
    await setup();
    expect(component['showMethodToggle']()).toBe(true);
    form().controls.kind.setValue('INCOME');
    expect(component['showMethodToggle']()).toBe(false);
  });

  it('records a card purchase without an account and with the previewed invoice', async () => {
    cards.set([makeCard()]);
    await setup();
    form().controls.paymentMethod.setValue('CARD');
    form().patchValue({
      description: 'Livraria',
      amount: '129,90',
      date: new Date(2026, 8, 10),
      categoryId: 'cat-food',
      creditCardId: 'card-1',
    });
    expect(component['isCardPurchase']()).toBe(true);
    expect(component['invoicePreview']()).toEqual({
      dueDate: '2026-10-05',
      label: 'Fatura de Outubro 2026',
    });
    expect(component['statusOptions']().map((option) => option.value)).toEqual(['PAID', 'CANCELLED']);

    await component['save']();
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'EXPENSE',
        accountId: null,
        creditCardId: 'card-1',
        invoiceDueDate: '2026-10-05',
        categoryId: 'cat-food',
        amount: 129.9,
      }),
    );
  });

  it('moves the purchase to the next invoice after the closing day', async () => {
    cards.set([makeCard()]);
    await setup();
    form().controls.paymentMethod.setValue('CARD');
    form().patchValue({ creditCardId: 'card-1', date: new Date(2026, 8, 21) });
    expect(component['invoicePreview']()?.dueDate).toBe('2026-11-05');
  });

  it('opens prefilled as an invoice payment and saves it as a transfer', async () => {
    cards.set([makeCard()]);
    await setup({
      invoicePayment: {
        cardId: 'card-1',
        cardName: 'Cartão',
        invoiceDueDate: '2026-10-05',
        amount: 200,
      },
    });
    const value = form().getRawValue();
    expect(value.kind).toBe('TRANSFER');
    expect(value.paymentMethod).toBe('CARD');
    expect(value.amount).toBe('200,00');
    expect(value.invoiceDueDate).toBe('2026-10-05');
    expect(component['isInvoicePayment']()).toBe(true);

    form().controls.accountId.setValue('acc-bank');
    await component['save']();
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'TRANSFER',
        accountId: 'acc-bank',
        creditCardId: 'card-1',
        invoiceDueDate: '2026-10-05',
        destinationAccountId: null,
        categoryId: null,
      }),
    );
  });

  it('requires an account and an invoice for an invoice payment', async () => {
    cards.set([makeCard()]);
    await setup();
    form().controls.kind.setValue('TRANSFER');
    form().controls.paymentMethod.setValue('CARD');
    form().patchValue({ description: 'Pagamento', amount: '100', creditCardId: 'card-1' });
    await component['save']();
    expect(store.create).not.toHaveBeenCalled();
    expect(form().controls.accountId.hasError('required')).toBe(true);
    expect(form().controls.invoiceDueDate.hasError('required')).toBe(true);
  });

  it('clears the card when switching back to an account', async () => {
    cards.set([makeCard()]);
    await setup();
    form().controls.paymentMethod.setValue('CARD');
    form().controls.creditCardId.setValue('card-1');
    form().controls.paymentMethod.setValue('ACCOUNT');
    expect(form().controls.creditCardId.value).toBe('');
    expect(component['isCardPurchase']()).toBe(false);
    expect(form().controls.accountId.hasError('required')).toBe(true);
  });

  it('offers instalments only when creating an expense', async () => {
    await setup();
    expect(component['canSplit']()).toBe(true);
    form().controls.kind.setValue('INCOME');
    expect(component['canSplit']()).toBe(false);
    form().controls.kind.setValue('TRANSFER');
    expect(component['canSplit']()).toBe(false);

    TestBed.resetTestingModule();
    await setup({ transaction: makeTransaction() });
    expect(component['canSplit']()).toBe(false);
  });

  it('previews the instalments of a card purchase', async () => {
    cards.set([makeCard()]);
    await setup();
    form().controls.paymentMethod.setValue('CARD');
    form().patchValue({ amount: '900', date: new Date(2026, 8, 10), creditCardId: 'card-1' });
    form().controls.installmentCount.setValue(3);
    expect(component['isSplit']()).toBe(true);
    expect(component['installmentPreview']()).toEqual({
      count: 3,
      firstAmount: 300,
      otherAmount: 300,
      differs: false,
      firstCompetence: '2026-10-05',
      firstLabel: 'Fatura de Outubro 2026',
    });
  });

  it('marks the bigger first instalment in the preview of an account purchase', async () => {
    await setup();
    form().patchValue({ amount: '100', date: new Date(2026, 8, 10) });
    form().controls.installmentCount.setValue(3);
    const preview = component['installmentPreview']()!;
    expect(preview.firstAmount).toBe(33.34);
    expect(preview.otherAmount).toBe(33.33);
    expect(preview.differs).toBe(true);
    expect(preview.firstCompetence).toBe('2026-09-10');
    expect(preview.firstLabel).toBeNull();
  });

  it('creates an installment purchase instead of a single transaction', async () => {
    cards.set([makeCard()]);
    await setup();
    form().controls.paymentMethod.setValue('CARD');
    form().patchValue({
      description: 'Notebook',
      amount: '4.200,00',
      date: new Date(2026, 8, 10),
      categoryId: 'cat-food',
      creditCardId: 'card-1',
    });
    form().controls.installmentCount.setValue(12);
    await component['save']();
    expect(store.createInstallments).toHaveBeenCalledWith({
      description: 'Notebook',
      totalAmount: 4200,
      installmentCount: 12,
      date: '2026-09-10',
      categoryId: 'cat-food',
      creditCardId: 'card-1',
      accountId: null,
      householdId: null,
      notes: null,
    });
    expect(store.create).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('saves a single transaction when the instalment count is one', async () => {
    await setup();
    form().patchValue({ description: 'Luz', amount: '10', categoryId: 'cat-food', accountId: 'acc-bank' });
    form().controls.installmentCount.setValue(1);
    await component['save']();
    expect(store.create).toHaveBeenCalled();
    expect(store.createInstallments).not.toHaveBeenCalled();
  });

  it('deletes the whole installment purchase from an instalment', async () => {
    await setup({
      transaction: makeTransaction({
        id: 'tx-i',
        installment_group_id: 'g1',
        installment_number: 2,
        installment_count: 12,
      }),
    });
    expect(component['installmentGroupId']).toBe('g1');
    await component['removeInstallmentGroup']();
    expect(store.removeInstallmentGroup).toHaveBeenCalledWith('g1');
    expect(dialogRef.close).toHaveBeenCalledWith('deleted');
  });

  it('uses the initial kind passed by the caller', async () => {
    await setup({ initialKind: 'INCOME' });
    expect(form().controls.kind.value).toBe('INCOME');
  });

  it('allows a card purchase even without accounts', async () => {
    accounts.set([makeAccount({ active: false })]);
    cards.set([makeCard()]);
    await setup();
    form().controls.paymentMethod.setValue('CARD');
    form().patchValue({ description: 'Livraria', amount: '10', categoryId: 'cat-food', creditCardId: 'card-1' });
    expect(component['needsAccount']()).toBe(false);
    await component['save']();
    expect(store.create).toHaveBeenCalled();
    accounts.set([makeAccount(), makeAccount({ id: 'acc-cash', name: 'Dinheiro', type: 'CASH' }), makeAccount({ id: 'acc-old', name: 'Antiga', active: false })]);
  });

  it('blocks saving when there are no active accounts', async () => {
    accounts.set([makeAccount({ active: false })]);
    await setup();
    form().patchValue({ description: 'Luz', amount: '10', categoryId: 'cat-food', accountId: 'acc-bank' });
    await component['save']();
    expect(store.create).not.toHaveBeenCalled();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tx-form__notice')).not.toBeNull();
    accounts.set([makeAccount(), makeAccount({ id: 'acc-cash', name: 'Dinheiro', type: 'CASH' }), makeAccount({ id: 'acc-old', name: 'Antiga', active: false })]);
  });
});
