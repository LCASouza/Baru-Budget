import {
  buildSchedule,
  installmentAmounts,
  instalmentDrift,
  priceInstalment,
  scheduleTotals,
  toMonthlyRate,
} from './amortization';

const round2 = (value: number) => Math.round(value * 100) / 100;

describe('toMonthlyRate', () => {
  it('uses a monthly rate as given', () => {
    expect(toMonthlyRate(1.5, 'MONTHLY', 'EFFECTIVE')).toBeCloseTo(0.015, 10);
    expect(toMonthlyRate(1.5, 'MONTHLY', 'PROPORTIONAL')).toBeCloseTo(0.015, 10);
  });

  it('converts a yearly rate proportionally or effectively', () => {
    expect(toMonthlyRate(12, 'YEARLY', 'PROPORTIONAL')).toBeCloseTo(0.01, 10);
    expect(toMonthlyRate(12, 'YEARLY', 'EFFECTIVE')).toBeCloseTo(0.009488792934583046, 12);
  });

  it('rebuilds the yearly rate from twelve effective monthly rates', () => {
    const monthly = toMonthlyRate(12, 'YEARLY', 'EFFECTIVE');
    expect(Math.pow(1 + monthly, 12)).toBeCloseTo(1.12, 10);
  });
});

describe('buildSchedule with SAC', () => {
  const schedule = buildSchedule(45000, 0.01, 48, 'SAC');

  it('amortizes a constant share of the principal', () => {
    expect(schedule[0].amortization).toBe(937.5);
    expect(schedule[47].amortization).toBe(937.5);
  });

  it('matches the instalments the database produces', () => {
    expect(schedule[0].amount).toBe(1387.5);
    expect(schedule[23].amount).toBe(1171.88);
    expect(schedule[47].amount).toBe(946.88);
  });

  it('falls month after month', () => {
    for (let index = 1; index < schedule.length; index++) {
      expect(schedule[index].amount).toBeLessThan(schedule[index - 1].amount);
    }
  });

  it('ends at zero', () => {
    expect(schedule[47].balanceAfter).toBe(0);
  });

  it('adds up to the financed amount plus the closed form interest', () => {
    const totals = scheduleTotals(schedule);
    const closedForm = 45000 + (0.01 * 45000 * (48 + 1)) / 2;
    expect(Math.abs(totals.total - closedForm)).toBeLessThan(0.5);
    expect(round2(totals.total - totals.interest)).toBe(45000);
  });

  it('splits the principal when there is no interest', () => {
    expect(installmentAmounts(1200, 0, 12, 'SAC')).toEqual(Array(12).fill(100));
  });

  it('lands the rounding on the last instalment', () => {
    const amounts = installmentAmounts(100, 0, 3, 'SAC');
    expect(amounts).toEqual([33.33, 33.33, 33.34]);
    expect(round2(amounts.reduce((total, amount) => total + amount, 0))).toBe(100);
  });

  it('keeps an awkward schedule consistent', () => {
    const rows = buildSchedule(7777.77, 0.0237, 17, 'SAC');
    expect(rows).toHaveLength(17);
    expect(rows[16].balanceAfter).toBe(0);
    expect(round2(rows.reduce((total, row) => total + row.amortization, 0))).toBe(7777.77);
  });
});

describe('buildSchedule with Price', () => {
  it('keeps every instalment but the last equal', () => {
    const rows = buildSchedule(10000, 0.015, 12, 'PRICE');
    expect(rows[0].amount).toBe(916.8);
    expect(new Set(rows.slice(0, 11).map((row) => row.amount)).size).toBe(1);
    expect(rows[11].balanceAfter).toBe(0);
  });

  it('degenerates to the principal split without interest', () => {
    expect(priceInstalment(1200, 0, 12)).toBe(100);
    expect(installmentAmounts(1200, 0, 12, 'PRICE')).toEqual(Array(12).fill(100));
  });
});

describe('buildSchedule guards', () => {
  it('returns nothing for impossible inputs', () => {
    expect(buildSchedule(0, 0.01, 12, 'SAC')).toEqual([]);
    expect(buildSchedule(1000, 0.01, 0, 'PRICE')).toEqual([]);
  });
});

describe('instalmentDrift', () => {
  const schedule = buildSchedule(10000, 0.015, 12, 'PRICE');

  it('reports nothing while the instalments match the schedule', () => {
    const pending = schedule.map((row) => ({ number: row.number, amount: row.amount }));
    expect(instalmentDrift(pending, schedule)).toEqual([]);
  });

  it('reports the instalments an edit left behind', () => {
    const edited = buildSchedule(12000, 0.015, 12, 'PRICE');
    const pending = schedule
      .slice(2)
      .map((row) => ({ number: row.number, amount: row.amount }));
    const drift = instalmentDrift(pending, edited);
    expect(drift).toHaveLength(10);
    expect(drift[0]).toEqual({ number: 3, amount: 916.8, expected: edited[2].amount });
  });

  it('compares in cents, so a float remainder is not drift', () => {
    const pending = [{ number: 1, amount: schedule[0].amount + 0.000001 }];
    expect(instalmentDrift(pending, schedule)).toEqual([]);
  });

  it('ignores an instalment the schedule does not reach', () => {
    expect(instalmentDrift([{ number: 99, amount: 10 }], schedule)).toEqual([]);
  });
});
