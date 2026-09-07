import { fromCents, sumAmounts, toCents } from '../../shared/money/money';

/** Splits an amount evenly, with the remaining cents on the first person. */
export function splitEqually(total: number, people: number): number[] {
  if (people < 1 || !Number.isFinite(total) || total <= 0) {
    return [];
  }
  const cents = toCents(total);
  if (cents < people) {
    return [];
  }
  const base = Math.floor(cents / people);
  const remainder = cents - base * people;
  return Array.from({ length: people }, (_, index) =>
    fromCents(index === 0 ? base + remainder : base),
  );
}

export function allocatedTotal(amounts: readonly number[]): number {
  return sumAmounts(amounts);
}

/** How much is still to allocate; negative means the split went over the amount. */
export function remainingToAllocate(total: number, amounts: readonly number[]): number {
  return sumAmounts([total, -allocatedTotal(amounts)]);
}

/** A split is valid when it is empty or adds up exactly to the amount. */
export function isSplitValid(total: number, amounts: readonly number[]): boolean {
  return amounts.length === 0 || toCents(allocatedTotal(amounts)) === toCents(total);
}
