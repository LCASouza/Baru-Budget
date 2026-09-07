import { buildSchedule, installmentAmounts, monthlyRate, priceInstalment, scheduleTotals } from './loan-math';

// Same cases as supabase/tests/loan_math.test.sql; the database is the authority
// and this mirror powers the form preview and the amortization table.
describe('loan-math', () => {
  describe('monthlyRate', () => {
    it('uses a monthly rate as given', () => {
      expect(monthlyRate(1.5, 'MONTHLY', 'PRICE')).toBe(0.015);
      expect(monthlyRate(1.5, 'MONTHLY', 'SIMPLE')).toBe(0.015);
    });

    it('converts a yearly rate proportionally for simple interest', () => {
      expect(monthlyRate(12, 'YEARLY', 'SIMPLE')).toBeCloseTo(0.01, 10);
    });

    it('converts a yearly rate to the equivalent effective rate for Price', () => {
      const rate = monthlyRate(12, 'YEARLY', 'PRICE');
      expect(rate).toBeCloseTo(0.009488792934583046, 12);
      expect(Math.pow(1 + rate, 12)).toBeCloseTo(1.12, 10);
    });
  });

  it('computes the Price instalment before rounding', () => {
    expect(priceInstalment(10000, 0.015, 12)).toBeCloseTo(916.8, 2);
    expect(priceInstalment(1200, 0, 12)).toBe(100);
  });

  describe('buildSchedule with Price', () => {
    const schedule = buildSchedule(10000, 0.015, 12, 'PRICE');

    it('keeps a fixed instalment except for the last one', () => {
      expect(schedule).toHaveLength(12);
      expect(schedule[0].amount).toBe(916.8);
      expect(schedule.slice(0, 11).every((row) => row.amount === 916.8)).toBe(true);
    });

    it('starts with more interest and ends with more amortization', () => {
      expect(schedule[0].interest).toBe(150);
      expect(schedule[0].amortization).toBeCloseTo(766.8, 2);
      expect(schedule[11].interest).toBeLessThan(schedule[0].interest);
      expect(schedule[11].amortization).toBeGreaterThan(schedule[0].amortization);
    });

    it('ends with a zero balance', () => {
      expect(schedule[11].balanceAfter).toBe(0);
    });

    it('totals about 11001.60 with the interest of the contract', () => {
      const totals = scheduleTotals(schedule);
      expect(totals.total).toBeCloseTo(11001.6, 1);
      expect(totals.interest).toBeCloseTo(1001.6, 1);
    });
  });

  describe('buildSchedule with simple interest', () => {
    const schedule = buildSchedule(10000, 0.01, 10, 'SIMPLE');

    it('splits principal and interest evenly', () => {
      expect(schedule.every((row) => row.amount === 1100)).toBe(true);
      expect(schedule.every((row) => row.interest === 100)).toBe(true);
      expect(schedule.every((row) => row.amortization === 1000)).toBe(true);
    });

    it('amortizes linearly to zero', () => {
      expect(schedule[0].balanceAfter).toBe(9000);
      expect(schedule[9].balanceAfter).toBe(0);
      expect(scheduleTotals(schedule).total).toBe(11000);
    });
  });

  describe('without interest', () => {
    it('splits the principal in both models', () => {
      expect(installmentAmounts(1200, 0, 12, 'PRICE')).toEqual(Array(12).fill(100));
      expect(installmentAmounts(1200, 0, 12, 'SIMPLE')).toEqual(Array(12).fill(100));
    });

    it('puts the rounding difference on the last instalment', () => {
      const amounts = installmentAmounts(100, 0, 3, 'SIMPLE');
      expect(amounts).toEqual([33.33, 33.33, 33.34]);
      expect(Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100)).toBe(10000);
    });
  });

  it('always ends at a zero balance for awkward schedules', () => {
    for (const [principal, rate, count] of [
      [7777.77, 0.0237, 17],
      [999.99, 0.019, 7],
      [15000, 0.0089, 36],
    ] as const) {
      const schedule = buildSchedule(principal, rate, count, 'PRICE');
      expect(schedule[schedule.length - 1].balanceAfter).toBe(0);
      const amortized = schedule.reduce((sum, row) => sum + row.amortization, 0);
      expect(Math.round(amortized * 100)).toBe(Math.round(principal * 100));
    }
  });

  it('returns nothing for an impossible loan', () => {
    expect(buildSchedule(0, 0.01, 12, 'PRICE')).toEqual([]);
    expect(buildSchedule(1000, 0.01, 0, 'PRICE')).toEqual([]);
  });
});
