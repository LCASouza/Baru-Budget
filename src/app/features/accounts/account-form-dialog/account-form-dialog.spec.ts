import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { DataError } from '../../../core/supabase/data-error';
import { makeAccount } from '../../../testing/finance-fixtures';
import { AccountsStore } from '../accounts.store';
import { AccountFormData, AccountFormDialog } from './account-form-dialog';

describe('AccountFormDialog', () => {
  let fixture: ComponentFixture<AccountFormDialog>;
  let component: AccountFormDialog;
  let store: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const form = () => (component as unknown as { form: AccountFormDialog['form'] }).form;

  async function setup(data: AccountFormData = {}): Promise<void> {
    store = { create: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) };
    dialogRef = { close: vi.fn() };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AccountFormDialog],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: AccountsStore, useValue: store },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('creates an account with a parsed opening balance', async () => {
    await setup();
    expect(form().getRawValue().openingBalance).toBe('0,00');
    form().patchValue({ name: ' Conta corrente ', type: 'BANK', institution: 'Banco', openingBalance: '1.500,50' });
    await component['save']();
    expect(store.create).toHaveBeenCalledWith({ name: 'Conta corrente', type: 'BANK', institution: 'Banco', openingBalance: 1500.5 });
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('rejects an invalid balance and an empty name', async () => {
    await setup();
    form().patchValue({ name: '', openingBalance: 'abc' });
    await component['save']();
    expect(store.create).not.toHaveBeenCalled();
    expect(form().controls.openingBalance.hasError('amount')).toBe(true);
  });

  it('edits an existing account', async () => {
    await setup({ account: makeAccount({ id: 'acc-1', name: 'Poupança', type: 'BANK', opening_balance: 20 }) });
    expect(form().getRawValue().openingBalance).toBe('20,00');
    form().patchValue({ institution: '' });
    await component['save']();
    expect(store.update).toHaveBeenCalledWith('acc-1', expect.objectContaining({ name: 'Poupança', institution: null, openingBalance: 20 }));
  });

  it('shows the duplicate name message', async () => {
    await setup();
    store.create.mockRejectedValueOnce(new DataError('dup', '23505'));
    form().patchValue({ name: 'Conta corrente' });
    await component['save']();
    expect(snackBar.open).toHaveBeenCalledWith('Já existe uma conta com este nome.', 'OK', expect.anything());
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
