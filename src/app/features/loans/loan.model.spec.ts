import { makeTransaction } from '../../testing/finance-fixtures';
import { DebtStatement, Loan, buildLoanView, totalRemaining } from './loan.model';

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
  insurance_amount: 0,
  fee_amount: 0,
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

  function statement(overrides: Partial<DebtStatement> = {}): DebtStatement {
    return {
      id: 's1',
      loan_id: 'loan-1',
      financing_id: null,
      competence: '2026-12-01',
      outstanding_balance: 8000,
      installment_amount: 900,
      insurance_amount: 0,
      fee_amount: 0,
      remaining_count: 9,
      notes: null,
      created_at: '2026-12-01T00:00:00Z',
      updated_at: '2026-12-01T00:00:00Z',
      created_by: 'u1',
      updated_by: 'u1',
      ...overrides,
    };
  }

  it('says the balance is projected while nothing was observed', () => {
    const view = buildLoanView(LOAN, [instalment(1, 'PAID')], names.accounts, names.categories);
    expect(view.balanceSource).toBe('PROJECTED');
    expect(view.lastStatement).toBeNull();
  });

  it('reanchors the schedule on the observed balance and says so', () => {
    // First due 2026-10-10, so the competence of December is instalment 3.
    const view = buildLoanView(
      LOAN,
      [instalment(1, 'PAID'), instalment(2, 'PAID'), instalment(3)],
      names.accounts,
      names.categories,
      [statement()],
    );
    expect(view.balanceSource).toBe('OBSERVED');
    expect(view.lastStatement?.competence).toBe('2026-12-01');
    expect(view.schedule[0].amount).toBe(916.8);
    expect(view.schedule[2].amount).not.toBe(916.8);
    expect(view.schedule).toHaveLength(11);
  });

  it('takes the charges of the observed month from the statement', () => {
    const view = buildLoanView(
      LOAN,
      [instalment(1, 'PAID'), instalment(2, 'PAID'), instalment(3)],
      names.accounts,
      names.categories,
      [statement({ insurance_amount: 12.5, fee_amount: 3.5 })],
    );
    expect(view.nextCharges).toBe(16);
  });

  it('falls back to the charges the contract carries', () => {
    const view = buildLoanView(
      { ...LOAN, insurance_amount: 8, fee_amount: 2 },
      [instalment(1, 'PAID'), instalment(2)],
      names.accounts,
      names.categories,
      [statement()],
    );
    expect(view.nextCharges).toBe(10);
  });
});
