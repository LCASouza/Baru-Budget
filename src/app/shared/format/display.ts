import { formatCurrency, formatDate, getCurrencySymbol } from '@angular/common';

const LOCALE = 'pt-BR';
const CURRENCY = 'BRL';

/** Money as the interface shows it, for places that build text instead of markup. */
export function displayAmount(amount: number): string {
  return formatCurrency(amount, LOCALE, getCurrencySymbol(CURRENCY, 'narrow', LOCALE), CURRENCY);
}

/** A financial date as `dd/MM/yyyy`, per MASTER_PROMPT section 53. */
export function displayDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const [year, month, day] = iso.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day), 'dd/MM/yyyy', LOCALE);
}
