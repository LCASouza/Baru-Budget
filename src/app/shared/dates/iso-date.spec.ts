import { parseIsoDate, toIsoDate, todayIso } from './iso-date';

describe('iso-date', () => {
  it('formats local dates without shifting the day', () => {
    expect(toIsoDate(new Date(2026, 8, 5, 0, 0, 0))).toBe('2026-09-05');
    expect(toIsoDate(new Date(2026, 8, 5, 23, 59, 59))).toBe('2026-09-05');
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('parses ISO dates into local midnight', () => {
    const date = parseIsoDate('2026-02-28');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(28);
    expect(date.getHours()).toBe(0);
  });

  it('round-trips through Date', () => {
    for (const value of ['2026-09-05', '2024-02-29', '2025-12-31']) {
      expect(toIsoDate(parseIsoDate(value))).toBe(value);
    }
  });

  it('returns today as ISO', () => {
    expect(todayIso(new Date(2026, 8, 6, 22, 30))).toBe('2026-09-06');
  });
});
