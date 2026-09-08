import { Database } from '../../core/supabase/database.types';
import { fromCents, sumAmounts, toCents } from '../money/money';

export type InterestPeriod = Database['public']['Enums']['interest_period'];

/**
 * Amortization systems used by the debts of the application. Loans offer
 * SIMPLE and PRICE; financings offer PRICE and SAC. Each formula is fixed and
 * never changes silently.
 */
export type AmortizationSystem = 'SIMPLE' | 'PRICE' | 'SAC';

/**
 * How a yearly rate becomes a monthly one. Proportional divides by twelve and
 * suits simple interest; effective takes the twelfth root and suits any system
 * that capitalizes over the outstanding balance.
 */
export type RateConvention = 'PROPORTIONAL' | 'EFFECTIVE';

export const INTEREST_PERIODS: readonly InterestPeriod[] = ['MONTHLY', 'YEARLY'];

export const INTEREST_PERIOD_LABELS: Readonly<Record<InterestPeriod, string>> = {
  MONTHLY: 'ao mês',
  YEARLY: 'ao ano',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Monthly rate as a fraction, from a percentage per period. */
export function toMonthlyRate(
  rate: number,
  period: InterestPeriod,
  convention: RateConvention,
): number {
  if (period === 'MONTHLY') {
    return rate / 100;
  }
  return convention === 'PROPORTIONAL'
    ? rate / 100 / 12
    : Math.pow(1 + rate / 100, 1 / 12) - 1;
}

/** Instalment of a Price schedule before rounding. */
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
 * Mirrors `public.loan_installment_amounts` and
 * `public.financing_installment_amounts`, which are the authority.
 */
export function buildSchedule(
  principal: number,
  rate: number,
  count: number,
  system: AmortizationSystem,
): ScheduleRow[] {
  if (count < 1 || principal <= 0) {
    return [];
  }

  if (system === 'SIMPLE') {
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

  if (system === 'SAC') {
    const amortizations = splitCents(toCents(principal), count);
    let balance = principal;
    return amortizations.map((amortization, index) => {
      const interest = round2(balance * rate);
      balance = round2(balance - amortization);
      return {
        number: index + 1,
        amount: round2(amortization + interest),
        interest,
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
  system: AmortizationSystem,
): number[] {
  return buildSchedule(principal, rate, count, system).map((row) => row.amount);
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

/**
 * A point the schedule restarts from: the contract at instalment one, and every
 * observed statement after it.
 */
export interface ScheduleAnchor {
  readonly number: number;
  readonly balance: number;
  readonly count: number;
}

/**
 * Schedule of an indexed debt, as a function by parts. Each anchor restarts the
 * projection from the balance the lender reported and runs for the number of
 * instalments the lender still expects, until the next anchor takes over.
 *
 * Without anchors this is `buildSchedule`, unchanged. Mirrors
 * `public.loan_schedule_amounts` and `public.financing_schedule_amounts`, which
 * are the authority; the length comes from the last anchor, because a statement
 * reporting a different remaining count changes how many instalments there are.
 */
export function buildScheduleByParts(
  principal: number,
  rate: number,
  count: number,
  system: AmortizationSystem,
  statements: readonly ScheduleAnchor[],
): ScheduleRow[] {
  const anchors = [
    { number: 1, balance: principal, count },
    ...statements.filter((anchor) => anchor.number > 1 && anchor.count > 0),
  ].sort((a, b) => a.number - b.number);

  const rows: ScheduleRow[] = [];
  anchors.forEach((anchor, index) => {
    const nextAt = anchors[index + 1]?.number ?? anchor.number + anchor.count;
    const taken = Math.min(nextAt - anchor.number, anchor.count);
    if (taken <= 0) {
      return;
    }
    const segment = buildSchedule(anchor.balance, rate, anchor.count, system);
    for (let position = 0; position < taken; position += 1) {
      const row = segment[position];
      if (row) {
        rows.push({ ...row, number: anchor.number + position });
      }
    }
  });
  return rows;
}

/** A generated instalment whose amount no longer matches the schedule. */
export interface InstalmentDrift {
  readonly number: number;
  readonly amount: number;
  readonly expected: number;
}

/**
 * Pending instalments that stopped matching the schedule they came from.
 * Generating only inserts what is missing, so editing a debt leaves the rows
 * already created carrying the old numbers and the screen mixes a fresh
 * outstanding balance with a stale total to pay.
 *
 * Only the amount is compared, which is what misreports money. Moving the first
 * due date shifts competences without touching amounts and goes unreported here;
 * realigning corrects both, because it rebuilds the row from the schedule.
 */
export function instalmentDrift(
  pending: readonly { readonly number: number; readonly amount: number }[],
  schedule: readonly ScheduleRow[],
): readonly InstalmentDrift[] {
  const drift: InstalmentDrift[] = [];
  for (const instalment of pending) {
    const expected = schedule[instalment.number - 1]?.amount;
    if (expected !== undefined && toCents(expected) !== toCents(instalment.amount)) {
      drift.push({ number: instalment.number, amount: instalment.amount, expected });
    }
  }
  return drift;
}
