import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import { buildTransactionViews, displayStatus, isSupportedKind } from './transaction.model';

describe('transaction.model', () => {
  describe('displayStatus', () => {
    it('marks pending transactions past their due date as overdue', () => {
      expect(displayStatus({ status: 'PENDING', date: '2026-09-01', due_date: '2026-09-05' }, '2026-09-06')).toBe('OVERDUE');
      expect(displayStatus({ status: 'PENDING', date: '2026-09-01', due_date: '2026-09-06' }, '2026-09-06')).toBe('PENDING');
      expect(displayStatus({ status: 'PENDING', date: '2026-09-01', due_date: '2026-09-10' }, '2026-09-06')).toBe('PENDING');
    });

    it('uses the transaction date when there is no due date', () => {
      expect(displayStatus({ status: 'PENDING', date: '2026-09-05', due_date: null }, '2026-09-06')).toBe('OVERDUE');
      expect(displayStatus({ status: 'PENDING', date: '2026-09-06', due_date: null }, '2026-09-06')).toBe('PENDING');
    });

    it('never derives overdue for paid or cancelled transactions', () => {
      expect(displayStatus({ status: 'PAID', date: '2026-01-01', due_date: '2026-01-01' }, '2026-09-06')).toBe('PAID');
      expect(displayStatus({ status: 'CANCELLED', date: '2026-01-01', due_date: null }, '2026-09-06')).toBe('CANCELLED');
    });
  });

  it('recognizes supported kinds', () => {
    expect(isSupportedKind('INCOME')).toBe(true);
    expect(isSupportedKind('TRANSFER')).toBe(true);
    expect(isSupportedKind('SETTLEMENT')).toBe(false);
    expect(isSupportedKind(undefined)).toBe(false);
  });

  it('resolves category and account names for display', () => {
    const categories = new Map([['cat-food', makeCategory()]]);
    const accounts = new Map([
      ['acc-bank', makeAccount()],
      ['acc-cash', makeAccount({ id: 'acc-cash', name: 'Dinheiro', type: 'CASH' })],
    ]);
    const views = buildTransactionViews(
      [
        makeTransaction(),
        makeTransaction({ id: 'tx-2', kind: 'TRANSFER', category_id: null, destination_account_id: 'acc-cash' }),
        makeTransaction({ id: 'tx-3', category_id: 'missing', account_id: 'missing' }),
      ],
      categories,
      accounts,
      '2026-09-06',
    );

    expect(views[0]).toMatchObject({ categoryName: 'Alimentação', accountName: 'Conta corrente', destinationAccountName: null, displayStatus: 'PAID' });
    expect(views[1]).toMatchObject({ categoryName: null, accountName: 'Conta corrente', destinationAccountName: 'Dinheiro' });
    expect(views[2]).toMatchObject({ categoryName: 'Categoria removida', accountName: 'Conta removida' });
  });
});
