// A rate is not money. The database stores `interest_rate` as numeric(9, 6), so
// the input has to carry six decimals where an amount carries two. Reusing the
// money parser refused 6,6971% outright and, on edit, showed an existing rate
// rounded to 6,70 and saved it that way.

const RATE_PATTERN = /^\d+(\.\d{1,6})?$/;

const RATE_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
  useGrouping: false,
});

/**
 * Percentage per period, from Brazilian input. Accepts `6,6971`, `6.6971` and
 * `1,5`, and refuses anything the column could not hold without rounding.
 */
export function parseRateInput(raw: string): number | null {
  const cleaned = raw.replace(/\s|%/g, '');
  if (!cleaned) {
    return null;
  }
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  if (!RATE_PATTERN.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** The rate as the field shows it, keeping every decimal the contract carries. */
export function formatRateInput(rate: number): string {
  return RATE_FORMAT.format(rate);
}
