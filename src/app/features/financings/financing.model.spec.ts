import { makeTransaction } from '../../testing/finance-fixtures';
import { Financing, buildFinancingView, totalRemaining } from './financing.model';

const FINANCING: Financing = {
  id: 'fin-1',
  owner_user_id: 'u1',
  description: 'Financiamento do carro',
  institution: 'Banco',
  account_id: 'acc-bank',
  category_id: 'cat-financing',
  down_payment_category_id: null,
  household_id: null,
  asset_value: 60000,
  down_payment: 15000,
  financed_amount: 45000,
  interest_rate: 1,
  interest_period: 'MONTHLY',
  system: 'SAC',
  installment_count: 48,
  acquisition_date: '2026-09-05',
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
    amount: Math.round((1387.5 - (number - 1) * 9.375) * 100) / 100,
    financing_id: 'fin-1',
    financing_installment_number: number,
    status,
    date: '2026-10-10',
  });
}

const downPayment = makeTransaction({
  id: 'entry',
  kind: 'EXPENSE',
  amount: 15000,
  financing_id: 'fin-1',
  date: '2026-09-05',
});

describe('financing.model', () => {
  const accounts = new Map([['acc-bank', 'Conta corrente']]);
  const categories = new Map([['cat-financing', 'Financiamentos']]);

  it('reports the schedule and the contract totals before anything is generated', () => {
    const view = buildFinancingView(FINANCING, [], accounts, categories);
    expect(view.schedule).toHaveLength(48);
    expect(view.generated).toBe(false);
    expect(view.paidCount).toBe(0);
    expect(view.outstandingPrincipal).toBe(45000);
    expect(view.remainingTotal).toBe(0);
    expect(view.downPaymentTransaction).toBeNull();
    expect(view.accountName).toBe('Conta corrente');
    expect(view.categoryName).toBe('Financiamentos');
  });

  it('counts the down payment and the instalments as everything that leaves the pocket', () => {
    const view = buildFinancingView(FINANCING, [], accounts, categories);
    expect(view.totalToPay).toBeCloseTo(15000 + 56025.12, 2);
    expect(view.totalToPay - view.totalInterest).toBeCloseTo(60000, 2);
  });

  it('follows what is paid and what is still ahead', () => {
    const view = buildFinancingView(
      FINANCING,
      [downPayment, instalment(1, 'PAID'), instalment(2, 'PAID'), instalment(3), instalment(4)],
      accounts,
      categories,
    );
    expect(view.generated).toBe(true);
    expect(view.downPaymentTransaction?.id).toBe('entry');
    expect(view.paidCount).toBe(2);
    expect(view.remainingCount).toBe(2);
    expect(view.next?.id).toBe('i3');
    expect(view.progressPercent).toBeCloseTo(4.1667, 3);
  });

  it('takes the outstanding principal from the schedule at the last paid instalment', () => {
    const view = buildFinancingView(
      FINANCING,
      [instalment(1, 'PAID'), instalment(2, 'PAID'), instalment(3)],
      accounts,
      categories,
    );
    expect(view.outstandingPrincipal).toBe(view.schedule[1].balanceAfter);
    expect(view.outstandingPrincipal).toBe(45000 - 2 * 937.5);
  });

  it('ignores cancelled instalments and never treats the down payment as one', () => {
    const view = buildFinancingView(
      FINANCING,
      [downPayment, instalment(1, 'PAID'), instalment(2, 'CANCELLED'), instalment(3)],
      accounts,
      categories,
    );
    expect(view.instalments).toHaveLength(3);
    expect(view.paidCount).toBe(1);
    expect(view.remainingCount).toBe(1);
  });

  it('totals what is left across financings', () => {
    const view = buildFinancingView(FINANCING, [instalment(1), instalment(2)], accounts, categories);
    expect(totalRemaining([view, view])).toBeCloseTo(2 * (1387.5 + 1378.13), 2);
    expect(totalRemaining([])).toBe(0);
  });
});
