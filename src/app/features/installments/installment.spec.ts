import {
  accountInstallmentDates,
  cardInstallmentDueDates,
  installmentLabel,
  shiftMonthDay,
  splitInstallmentAmounts,
} from './installment';

// Same cases as supabase/tests/split_installments.test.sql; the database is the
// authority and this mirror only powers the form preview.
describe('installment', () => {
  describe('splitInstallmentAmounts', () => {
    it('splits evenly when it can', () => {
      expect(splitInstallmentAmounts(900, 3)).toEqual([300, 300, 300]);
      expect(splitInstallmentAmounts(4200, 12)).toEqual(Array(12).fill(350));
    });

    it('puts the remaining cents on the first instalment', () => {
      expect(splitInstallmentAmounts(100, 3)).toEqual([33.34, 33.33, 33.33]);
      expect(splitInstallmentAmounts(0.05, 2)).toEqual([0.03, 0.02]);
      expect(splitInstallmentAmounts(1234.56, 7)).toEqual([
        176.4, 176.36, 176.36, 176.36, 176.36, 176.36, 176.36,
      ]);
    });

    it('always adds up to the total', () => {
      for (const [total, count] of [
        [100, 3],
        [1234.56, 7],
        [19.99, 6],
        [0.05, 2],
      ] as const) {
        const amounts = splitInstallmentAmounts(total, count);
        expect(amounts).toHaveLength(count);
        expect(Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100)).toBe(
          Math.round(total * 100),
        );
      }
    });

    it('returns nothing for an invalid split', () => {
      expect(splitInstallmentAmounts(100, 1)).toEqual([]);
      expect(splitInstallmentAmounts(0, 3)).toEqual([]);
      expect(splitInstallmentAmounts(-10, 3)).toEqual([]);
      expect(splitInstallmentAmounts(0.02, 3)).toEqual([]);
    });
  });

  describe('shiftMonthDay', () => {
    it('keeps the day and clamps it to the target month', () => {
      expect(shiftMonthDay('2026-09-10', 0)).toBe('2026-09-10');
      expect(shiftMonthDay('2026-09-10', 2)).toBe('2026-11-10');
      expect(shiftMonthDay('2026-12-10', 2)).toBe('2027-02-10');
      expect(shiftMonthDay('2027-01-31', 1)).toBe('2027-02-28');
      expect(shiftMonthDay('2028-01-31', 1)).toBe('2028-02-29');
      expect(shiftMonthDay('2026-03-31', 1)).toBe('2026-04-30');
    });
  });

  describe('cardInstallmentDueDates', () => {
    it('places the instalments on consecutive invoices', () => {
      expect(cardInstallmentDueDates('2026-09-10', 20, 5, 3)).toEqual([
        '2026-10-05',
        '2026-11-05',
        '2026-12-05',
      ]);
    });

    it('starts on the next invoice after the closing day', () => {
      expect(cardInstallmentDueDates('2026-09-21', 20, 5, 2)).toEqual(['2026-11-05', '2026-12-05']);
    });

    it('crosses the year and clamps the due day', () => {
      expect(cardInstallmentDueDates('2026-12-10', 20, 31, 3)).toEqual([
        '2026-12-31',
        '2027-01-31',
        '2027-02-28',
      ]);
    });
  });

  it('lists account instalments month by month', () => {
    expect(accountInstallmentDates('2026-01-31', 4)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('labels an instalment position', () => {
    expect(installmentLabel(4, 12)).toBe('4/12');
  });
});
