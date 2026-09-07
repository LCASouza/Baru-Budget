import { competenceDate, monthKey, occursInMonth } from './recurrence';

describe('recurrence', () => {
  it('keys a month by its first day', () => {
    expect(monthKey({ year: 2026, month: 9 })).toBe('2026-09-01');
    expect(monthKey({ year: 2027, month: 12 })).toBe('2027-12-01');
  });

  it('clamps the template day to the last day of the month', () => {
    expect(competenceDate({ year: 2026, month: 9 }, 10)).toBe('2026-09-10');
    expect(competenceDate({ year: 2027, month: 2 }, 31)).toBe('2027-02-28');
    expect(competenceDate({ year: 2028, month: 2 }, 31)).toBe('2028-02-29');
    expect(competenceDate({ year: 2026, month: 4 }, 31)).toBe('2026-04-30');
  });

  describe('occursInMonth', () => {
    it('is always true for a monthly template', () => {
      expect(occursInMonth('MONTHLY', null, { year: 2026, month: 9 })).toBe(true);
      expect(occursInMonth('MONTHLY', null, { year: 2027, month: 2 })).toBe(true);
    });

    it('is true for a yearly template only in its anchor month', () => {
      expect(occursInMonth('YEARLY', 2, { year: 2027, month: 2 })).toBe(true);
      expect(occursInMonth('YEARLY', 2, { year: 2027, month: 3 })).toBe(false);
      expect(occursInMonth('YEARLY', null, { year: 2027, month: 3 })).toBe(false);
    });
  });
});
