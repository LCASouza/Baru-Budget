import { formatRateInput, parseRateInput } from './rate';

describe('parseRateInput', () => {
  it('reads the decimals a rate actually carries', () => {
    // numeric(9, 6) in the database; the money parser stopped at two and refused
    // the 6,6971% a real contract charges.
    expect(parseRateInput('6,6971')).toBe(6.6971);
    expect(parseRateInput('1,95')).toBe(1.95);
    expect(parseRateInput('0,000001')).toBe(0.000001);
    expect(parseRateInput('12')).toBe(12);
  });

  it('accepts a dot, which a numeric keyboard without a comma produces', () => {
    expect(parseRateInput('6.6971')).toBe(6.6971);
  });

  it('ignores spaces and a percent sign', () => {
    expect(parseRateInput(' 6,6971 % ')).toBe(6.6971);
  });

  it('refuses what the column could not hold without rounding', () => {
    expect(parseRateInput('6,6971001')).toBeNull();
    expect(parseRateInput('')).toBeNull();
    expect(parseRateInput('abc')).toBeNull();
    expect(parseRateInput('-1')).toBeNull();
  });
});

describe('formatRateInput', () => {
  it('keeps every decimal instead of rounding to cents', () => {
    expect(formatRateInput(6.6971)).toBe('6,6971');
    expect(formatRateInput(1.5)).toBe('1,50');
    expect(formatRateInput(12)).toBe('12,00');
  });

  it('round-trips a rate through the field', () => {
    expect(parseRateInput(formatRateInput(6.6971))).toBe(6.6971);
  });
});
