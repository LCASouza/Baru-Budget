import { Database } from '../../core/supabase/database.types';
import { InterestPeriod, toMonthlyRate } from '../../shared/finance/amortization';

export type LoanInterestModel = Database['public']['Enums']['loan_interest_model'];

export {
  INTEREST_PERIODS,
  INTEREST_PERIOD_LABELS,
  buildSchedule,
  installmentAmounts,
  priceInstalment,
  scheduleTotals,
} from '../../shared/finance/amortization';
export type {
  InterestPeriod,
  ScheduleRow,
  ScheduleTotals,
} from '../../shared/finance/amortization';

export const LOAN_INTEREST_MODELS: readonly LoanInterestModel[] = ['PRICE', 'SIMPLE'];

export const LOAN_INTEREST_MODEL_LABELS: Readonly<Record<LoanInterestModel, string>> = {
  PRICE: 'Tabela Price',
  SIMPLE: 'Juros simples',
};

export const LOAN_INTEREST_MODEL_DESCRIPTIONS: Readonly<Record<LoanInterestModel, string>> = {
  PRICE: 'Parcela fixa. Os juros caem e a amortização cresce a cada mês.',
  SIMPLE: 'Juros sobre o principal em todas as parcelas. Amortização constante.',
};

/**
 * Monthly rate of a loan. A yearly rate converts proportionally for simple
 * interest and effectively for Price: two different conventions, both declared.
 * Mirrors `public.loan_monthly_rate`, which is the authority.
 */
export function monthlyRate(
  rate: number,
  period: InterestPeriod,
  model: LoanInterestModel,
): number {
  return toMonthlyRate(rate, period, model === 'SIMPLE' ? 'PROPORTIONAL' : 'EFFECTIVE');
}
