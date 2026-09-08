import { Database } from '../../core/supabase/database.types';
import { InterestPeriod, toMonthlyRate } from '../../shared/finance/amortization';

export type FinancingSystem = Database['public']['Enums']['financing_system'];

export {
  INTEREST_PERIODS,
  INTEREST_PERIOD_LABELS,
  buildSchedule,
  installmentAmounts,
  instalmentDrift,
  scheduleTotals,
} from '../../shared/finance/amortization';
export type {
  InstalmentDrift,
  InterestPeriod,
  ScheduleRow,
  ScheduleTotals,
} from '../../shared/finance/amortization';

export const FINANCING_SYSTEMS: readonly FinancingSystem[] = ['PRICE', 'SAC'];

export const FINANCING_SYSTEM_LABELS: Readonly<Record<FinancingSystem, string>> = {
  PRICE: 'Tabela Price',
  SAC: 'Tabela SAC',
};

export const FINANCING_SYSTEM_DESCRIPTIONS: Readonly<Record<FinancingSystem, string>> = {
  PRICE: 'Parcela fixa. Os juros caem e a amortização cresce a cada mês.',
  SAC: 'Amortização constante. A parcela começa maior e cai a cada mês.',
};

/**
 * Monthly rate of a financing. Both systems capitalize over the outstanding
 * balance, so a yearly rate always converts to its effective monthly
 * equivalent. Mirrors `public.financing_monthly_rate`, which is the authority.
 */
export function monthlyRate(rate: number, period: InterestPeriod): number {
  return toMonthlyRate(rate, period, 'EFFECTIVE');
}
