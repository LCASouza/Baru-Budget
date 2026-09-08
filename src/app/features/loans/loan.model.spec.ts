import { makeTransaction } from '../../testing/finance-fixtures';
import { Loan, buildLoanView, totalRemaining } from './loan.model';

const LOAN: Loan = {
  id: 'loan-1',
  owner_user_id: 'u1',
  description: 'Empréstimo pessoal',
  lender: 'Banco',
  account_id: 'acc-bank',
  category_id: 'cat-loan',
  disbursement_category_id: 'cat-other-income',
  household_id: null,
  principal: 10000,
  interest_rate: 1.5,
  interest_period: 'MONTHLY',
  interest_model: 'PRICE',
  installment_count: 12,
  start_date: '2026-09-05',
  first_due_date: '2026-10-10',
  notes: null,
  created_at: '2026-09-05T00:00:00Z',
  updated_at: '2026-09-05T00:00:00Z',
  created_by: 'u1',
  updated_by: 'u1',
};

function instalment(number: number, status: 'PAID' | 'PENDING' | 'CANCELLED' = 'PENDING') {
  return makeTransaction({
    id: `i${number}`,
    kind: 'EXPENSE',
    amount: 916.8,
    loan_id: 'loan-1',
    loan_installment_number: number,
    status,
    date: `2026-${String(9 + number).padStart(2, '0')}-10`,
  });
}

describe('loan.model', () => {
  const names = { accounts: new Map([['acc-bank', 'Conta corrente']]), categories: new Map([['cat-loan', 'Empréstimos']]) };

  it('reports the schedule and the contract totals before anything is generated', () => {
    const view = buildLoanView(LOAN, [], names.accounts, names.categories);
    expect(view.schedule).toHaveLength(12);
    expect(view.generated).toBe(false);
    expect(view.paidCount).toBe(0);
    expect(view.outstandingPrincipal).toBe(10000);
    expect(view.remainingTotal).toBe(0);
    expect(view.totalToPay).toBeCloseTo(11001.6, 1);
    expect(view.accountName).toBe('Conta corrente');
    expect(view.categoryName).toBe('Empréstimos');
  });

  it('follows what is paid and what is still ahead', () => {
    const transactions = [
      makeTransaction({ id: 'd1', kind: 'INCOME', amount: 10000, loan_id: 'loan-1' }),
      instalment(1, 'PAID'),
      instalment(2, 'PAID'),
      instalment(3),
      instalment(4),
    ];
    const view = buildLoanView(LOAN, transactions, names.accounts, names.categories);
    expect(view.generated).toBe(true);
    expect(view.paidCount).toBe(2);
    expect(view.remainingCount).toBe(2);
    expect(view.remainingTotal).toBeCloseTo(1833.6, 2);
    expect(view.next?.id).toBe('i3');
    expect(view.progressPercent).toBeCloseTo(16.6667, 3);
  });

  it('takes the outstanding principal from the schedule at the last paid instalment', () => {
    const view = buildLoanView(
      LOAN,
      [instalment(1, 'PAID'), instalment(2, 'PAID'), instalment(3)],
      names.accounts,
      names.categories,
    );
    expect(view.outstandingPrincipal).toBe(view.schedule[1].balanceAfter);
    expect(view.outstandingPrincipal).toBeLessThan(10000);
  });

  it('ignores cancelled instalments and the disbursement', () => {
    const view = buildLoanView(
      LOAN,
      [instalment(1, 'PAID'), instalment(2, 'CANCELLED'), instalment(3)],
      names.accounts,
      names.categories,
    );
    expect(view.paidCount).toBe(1);
    expect(view.remainingCount).toBe(1);
    expect(view.remainingTotal).toBe(916.8);
  });

  it('totals what is left across loans', () => {
    const view = buildLoanView(LOAN, [instalment(1), instalment(2)], names.accounts, names.categories);
    expect(totalRemaining([view, view])).toBeCloseTo(3667.2, 2);
    expect(totalRemaining([])).toBe(0);
  });

  it('reports no drift while the instalments match the schedule', () => {
    const view = buildLoanView(LOAN, [instalment(1), instalment(2)], names.accounts, names.categories);
    expect(view.drifted).toEqual([]);
  });

  it('reports the pending instalments an edit to the loan left behind', () => {
    // Editing the principal changes the schedule; the rows already generated keep
    // the amounts they were created with until they are realigned.
    const edited: Loan = { ...LOAN, principal: 12000 };
    const view = buildLoanView(
      edited,
      [instalment(1, 'PAID'), instalment(2), instalment(3, 'CANCELLED')],
      names.accounts,
      names.categories,
    );
    expect(view.drifted.map((drift) => drift.number)).toEqual([2]);
    expect(view.drifted[0].amount).toBe(916.8);
    expect(view.drifted[0].expected).toBe(view.schedule[1].amount);
  });
});
