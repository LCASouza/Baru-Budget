import { allocatedTotal, isSplitValid, remainingToAllocate, splitEqually } from './allocation';

describe('allocation', () => {
  describe('splitEqually', () => {
    it('splits evenly when it can', () => {
      expect(splitEqually(600, 2)).toEqual([300, 300]);
      expect(splitEqually(90, 3)).toEqual([30, 30, 30]);
    });

    it('puts the remaining cents on the first person', () => {
      expect(splitEqually(100, 3)).toEqual([33.34, 33.33, 33.33]);
      expect(splitEqually(320.45, 2)).toEqual([160.23, 160.22]);
    });

    it('always adds up to the total', () => {
      for (const [total, people] of [
        [100, 3],
        [320.45, 2],
        [0.05, 2],
        [1234.56, 7],
      ] as const) {
        const amounts = splitEqually(total, people);
        expect(Math.round(allocatedTotal(amounts) * 100)).toBe(Math.round(total * 100));
      }
    });

    it('returns nothing for an impossible split', () => {
      expect(splitEqually(100, 0)).toEqual([]);
      expect(splitEqually(0, 2)).toEqual([]);
      expect(splitEqually(0.01, 3)).toEqual([]);
    });
  });

  it('reports how much is still to allocate', () => {
    expect(remainingToAllocate(600, [300, 200])).toBe(100);
    expect(remainingToAllocate(600, [300, 300])).toBe(0);
    expect(remainingToAllocate(600, [400, 300])).toBe(-100);
    expect(remainingToAllocate(600, [])).toBe(600);
  });

  it('accepts an empty split or one that adds up exactly', () => {
    expect(isSplitValid(600, [])).toBe(true);
    expect(isSplitValid(600, [300, 300])).toBe(true);
    expect(isSplitValid(600, [300, 299.99])).toBe(false);
    expect(isSplitValid(600, [300, 300.01])).toBe(false);
    expect(isSplitValid(100, [33.34, 33.33, 33.33])).toBe(true);
  });
});
