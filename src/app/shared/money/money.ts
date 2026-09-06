// Amounts are handled as numbers with two decimals; sums go through integer
// cents to avoid binary floating point drift.

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumAmounts(amounts: Iterable<number>): number {
  let cents = 0;
  for (const amount of amounts) {
    cents += toCents(amount);
  }
  return fromCents(cents);
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

// Accepts Brazilian input (`1.234,56`, `1234,56`, `12`) and a lone dot followed by
// one or two digits (`12.5`), which numeric keyboards without a comma produce.
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/\s|R\$/g, '');
  if (!cleaned) {
    return null;
  }

  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = cleaned.split('.');
    const dotIsDecimal = parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2;
    normalized = dotIsDecimal ? cleaned : cleaned.replace(/\./g, '');
  }

  if (!AMOUNT_PATTERN.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const INPUT_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

export function formatAmountInput(amount: number): string {
  return INPUT_FORMAT.format(amount);
}
