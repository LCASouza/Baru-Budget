import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { makeAccount, makeCategory } from '../../../testing/finance-fixtures';
import { AccountsStore } from '../../accounts/accounts.store';
import { CategoriesStore } from '../../categories/categories.store';
import { FinancingsStore } from '../financings.store';
import { FinancingFormData, FinancingFormDialog } from './financing-form-dialog';

describe('FinancingFormDialog', () => {
  let fixture: ComponentFixture<FinancingFormDialog>;
  let component: FinancingFormDialog;
  let store: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const form = () => (component as unknown as { form: FinancingFormDialog['form'] }).form;
  const preview = () =>
    (component as unknown as { preview: FinancingFormDialog['preview'] }).preview();

  async function setup(data: FinancingFormData = {}): Promise<void> {
    store = {
      create: vi.fn().mockResolvedValue('fin-2'),
      update: vi.fn().mockResolvedValue(undefined),
    };
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [FinancingFormDialog],
      providers: [
        provideNativeDateAdapter(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: FinancingsStore, useValue: store },
        { provide: AccountsStore, useValue: { accounts: signal([makeAccount()]) } },
        {
          provide: CategoriesStore,
          useValue: { ofKind: () => [makeCategory({ id: 'cat-food' })] },
        },
        {
          provide: FinancialContextService,
          useValue: { households: signal([]), context: signal({ kind: 'personal' }) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FinancingFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('previews the SAC instalments falling over time', async () => {
    await setup();
    form().patchValue({
      assetValue: '60.000,00',
      downPayment: '15.000,00',
      interestRate: '1,00',
      system: 'SAC',
      installmentCount: 48,
    });
    const shown = preview();
    expect(shown?.financed).toBe(45000);
    expect(shown?.first).toBe(1387.5);
    expect(shown?.last).toBe(946.88);
    expect(shown?.varies).toBe(true);
    expect(shown?.total).toBeCloseTo(71025.12, 2);
  });

  it('previews a fixed Price instalment', async () => {
    await setup();
    form().patchValue({
      assetValue: '11.200,00',
      downPayment: '1.200,00',
      interestRate: '1,50',
      system: 'PRICE',
      installmentCount: 12,
    });
    const shown = preview();
    expect(shown?.financed).toBe(10000);
    expect(shown?.first).toBe(916.8);
    // Price keeps the instalment fixed; only the cents rounding reaches the last one.
    expect(Math.abs((shown?.last ?? 0) - 916.8)).toBeLessThan(0.05);
  });

  it('refuses a down payment that covers the whole asset', async () => {
    await setup();
    form().patchValue({
      description: 'Carro',
      accountId: 'acc-bank',
      categoryId: 'cat-food',
      assetValue: '1.000,00',
      downPayment: '1.000,00',
      firstDueDate: new Date('2026-10-10T12:00:00'),
    });
    expect(form().hasError('downPaymentTooHigh')).toBe(true);
    expect(preview()).toBeNull();
    await component['save']();
    expect(store.create).not.toHaveBeenCalled();
  });

  it('sends the parsed values to the store', async () => {
    await setup();
    form().patchValue({
      description: '  Carro  ',
      institution: '',
      accountId: 'acc-bank',
      categoryId: 'cat-food',
      assetValue: '60.000,00',
      downPayment: '15.000,00',
      interestRate: '1,00',
      system: 'SAC',
      installmentCount: 48,
      acquisitionDate: new Date('2026-09-05T12:00:00'),
      firstDueDate: new Date('2026-10-10T12:00:00'),
    });
    await component['save']();
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Carro',
        institution: null,
        assetValue: 60000,
        downPayment: 15000,
        interestRate: 1,
        system: 'SAC',
        installmentCount: 48,
        acquisitionDate: '2026-09-05',
        firstDueDate: '2026-10-10',
        downPaymentCategoryId: null,
      }),
    );
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });
});
