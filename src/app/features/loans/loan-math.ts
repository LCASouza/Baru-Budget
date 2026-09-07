import { Database } from '../../core/supabase/database.types';
import { fromCents, sumAmounts, toCents } from '../../shared/money/money';

export type LoanInterestModel = Database['public']['Enums']['loan_interest_model'];
export type InterestPeriod = Database['public']['Enums']['interest_period'];

export const LOAN_INTEREST_MODELS: readonly LoanInterestModel[] = ['PRICE', 'SIMPLE'];

export const LOAN_INTEREST_MODEL_LABELS: Readonly<Record<LoanInterestModel, string>> = {
  PRICE: 'Tabela Price',
  SIMPLE: 'Juros simples',
};

export const LOAN_INTEREST_MODEL_DESCRIPTIONS: Readonly<Record<LoanInterestModel, string>> = {
  PRICE: 'Parcela fixa. Os juros caem e a amortização cresce a cada mês.',
  SIMPLE: 'Juros sobre o principal em todas as parcelas. Amortização constante.',
};

export const INTEREST_PERIODS: readonly InterestPeriod[] = ['MONTHLY', 'YEARLY'];

export const INTEREST_PERIOD_LABELS: Readonly<Record<InterestPeriod, string>> = {
  MONTHLY: 'ao mês',
  YEARLY: 'ao ano',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Monthly rate of a loan. A yearly rate converts proportionally for simple
 * interest and effectively for Price: two different conventions, both declared.
 * Mirrors `public.loan_monthly_rate`, which is the authority.
 */
export function monthlyRate(
  rate: number,
  period: InterestPeriod,
  model: LoanInterestModel,
): number {
  if (period === 'MONTHLY') {
    return rate / 100;
  }
  return model === 'SIMPLE' ? rate / 100 / 12 : Math.pow(1 + rate / 100, 1 / 12) - 1;
}

/** Instalment of a Price loan before rounding. */
export function priceInstalment(principal: number, rate: number, count: number): number {
  if (rate === 0) {
    return principal / count;
  }
  return (principal * rate) / (1 - Math.pow(1 + rate, -count));
}

function splitCents(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const amounts = Array.from({ length: count }, () => fromCents(base));
  amounts[count - 1] = fromCents(totalCents - base * (count - 1));
  return amounts;
}

export interface ScheduleRow {
  readonly number: number;
  readonly amount: number;
  readonly interest: number;
  readonly amortization: number;
  readonly balanceAfter: number;
}

/**
 * Amortization schedule. The rounding difference lands on the last instalment,
 * so the early ones match what the lender charges and the balance ends at zero.
 * Mirrors `public.loan_installment_amounts`.
 */
export function buildSchedule(
  principal: number,
  rate: number,
  count: number,
  model: LoanInterestModel,
): ScheduleRow[] {
  if (count < 1 || principal <= 0) {
    return [];
  }

  if (model === 'SIMPLE') {
    const amounts = splitCents(Math.round(principal * (1 + rate * count) * 100), count);
    const amortizations = splitCents(toCents(principal), count);
    let balance = principal;
    return amounts.map((amount, index) => {
      const amortization = amortizations[index];
      balance = round2(balance - amortization);
      return {
        number: index + 1,
        amount,
        interest: round2(amount - amortization),
        amortization,
        balanceAfter: balance,
      };
    });
  }

  if (rate === 0) {
    const amounts = splitCents(toCents(principal), count);
    let balance = principal;
    return amounts.map((amount, index) => {
      balance = round2(balance - amount);
      return { number: index + 1, amount, interest: 0, amortization: amount, balanceAfter: balance };
    });
  }

  const payment = round2(priceInstalment(principal, rate, count));
  const rows: ScheduleRow[] = [];
  let balance = principal;
  for (let position = 1; position <= count; position++) {
    const interest = round2(balance * rate);
    const isLast = position === count;
    const amortization = isLast ? balance : round2(payment - interest);
    const amount = isLast ? round2(balance + interest) : payment;
    balance = round2(balance - amortization);
    rows.push({ number: position, amount, interest, amortization, balanceAfter: balance });
  }
  return rows;
}

export function installmentAmounts(
  principal: number,
  rate: number,
  count: number,
  model: LoanInterestModel,
): number[] {
  return buildSchedule(principal, rate, count, model).map((row) => row.amount);
}

export interface ScheduleTotals {
  readonly total: number;
  readonly interest: number;
}

export function scheduleTotals(rows: readonly ScheduleRow[]): ScheduleTotals {
  return {
    total: sumAmounts(rows.map((row) => row.amount)),
    interest: sumAmounts(rows.map((row) => row.interest)),
  };
}
