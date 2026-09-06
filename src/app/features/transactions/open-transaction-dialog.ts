import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ViewportService } from '../../core/layout/viewport.service';
import { Transaction } from './transaction.model';

export interface TransactionFormData {
  readonly transaction?: Transaction;
  readonly initialKind?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
}

export type TransactionFormResult = 'saved' | 'deleted';

// Loads the form on demand so the dialog code stays out of the initial bundle.
export async function openTransactionDialog(
  dialog: MatDialog,
  viewport: ViewportService,
  data: TransactionFormData = {},
): Promise<TransactionFormResult | undefined> {
  const { TransactionFormDialog } = await import(
    './transaction-form-dialog/transaction-form-dialog'
  );

  const ref = viewport.isMobile()
    ? dialog.open(TransactionFormDialog, {
        data,
        width: '100vw',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        panelClass: 'bb-dialog-fullscreen',
        autoFocus: false,
      })
    : dialog.open(TransactionFormDialog, {
        data,
        width: '600px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'dialog',
      });

  return firstValueFrom(ref.afterClosed());
}
