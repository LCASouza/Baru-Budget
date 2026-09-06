import { formatAmountInput, parseAmountInput, sumAmounts } from './money';

describe('money', () => {
  describe('parseAmountInput', () => {
    it('parses Brazilian formatted input', () => {
      expect(parseAmountInput('1.234,56')).toBe(1234.56);
      expect(parseAmountInput('1234,56')).toBe(1234.56);
      expect(parseAmountInput('12,5')).toBe(12.5);
      expect(parseAmountInput('12')).toBe(12);
      expect(parseAmountInput('R$ 99,90')).toBe(99.9);
    });

    it('treats a lone dot with up to two decimals as the decimal separator', () => {
      expect(parseAmountInput('12.5')).toBe(12.5);
      expect(parseAmountInput('12.50')).toBe(12.5);
      expect(parseAmountInput('1.234')).toBe(1234);
      expect(parseAmountInput('1.234.567')).toBe(1234567);
    });

    it('rejects empty, negative and malformed input', () => {
      expect(parseAmountInput('')).toBeNull();
      expect(parseAmountInput('   ')).toBeNull();
      expect(parseAmountInput('-10')).toBeNull();
      expect(parseAmountInput('abc')).toBeNull();
      expect(parseAmountInput('1,234,56')).toBeNull();
      expect(parseAmountInput('12,345')).toBeNull();
    });

    it('accepts zero', () => {
      expect(parseAmountInput('0')).toBe(0);
      expect(parseAmountInput('0,00')).toBe(0);
    });
  });

  it('formats amounts for input fields', () => {
    expect(formatAmountInput(1234.56)).toBe('1.234,56');
    expect(formatAmountInput(0)).toBe('0,00');
    expect(formatAmountInput(12.5)).toBe('12,50');
  });

  it('sums through integer cents', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([1000, -0.01, 0.01])).toBe(1000);
    expect(sumAmounts([])).toBe(0);
  });
});
