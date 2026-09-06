import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { makeAccount, makeCategory, makeTransaction } from '../../../testing/finance-fixtures';
import { AccountsStore } from '../../accounts/accounts.store';
import { CategoriesStore } from '../../categories/categories.store';
import { TransactionFormData } from '../open-transaction-dialog';
import { TransactionsStore } from '../transactions.store';
import { TransactionFormDialog } from './transaction-form-dialog';

describe('TransactionFormDialog', () => {
  let fixture: ComponentFixture<TransactionFormDialog>;
  let component: TransactionFormDialog;
  let store: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
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

  // Form is protected; tests reach it through the component instance.
  const form = () => (component as unknown as { form: TransactionFormDialog['form'] }).form;

  async function setup(data: TransactionFormData = {}): Promise<void> {
    store = {
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
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
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: TransactionsStore, useValue: store },
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
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

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
      notes: null,
    });
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
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

  it('uses the initial kind passed by the caller', async () => {
    await setup({ initialKind: 'INCOME' });
    expect(form().controls.kind.value).toBe('INCOME');
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
