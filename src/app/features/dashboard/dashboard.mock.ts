import { SummaryCardData } from '../../shared/components/summary-card/summary-card';
import {
  CategorySpending,
  MonthlyTotals,
  RecentTransaction,
  SettlementEntry,
  UpcomingPayment,
} from './dashboard.models';

export const SUMMARY_CARDS: readonly SummaryCardData[] = [
  {
    label: 'Receitas',
    amount: 7200,
    icon: 'arrow_downward',
    tone: 'income',
    hint: '3 entradas no período',
  },
  {
    label: 'Despesas',
    amount: 5450,
    icon: 'arrow_upward',
    tone: 'expense',
    hint: '14 saídas no período',
  },
  {
    label: 'Saldo',
    amount: 1750,
    icon: 'account_balance_wallet',
    tone: 'balance',
    hint: 'Receitas menos despesas',
    signed: true,
  },
  {
    label: 'Benefícios',
    amount: 380,
    icon: 'restaurant',
    tone: 'benefit',
    hint: 'Vale alimentação e refeição',
  },
  {
    label: 'A receber',
    amount: 570,
    icon: 'call_received',
    tone: 'receivable',
    hint: '2 pessoas',
  },
  {
    label: 'A pagar',
    amount: 80,
    icon: 'call_made',
    tone: 'payable',
    hint: '1 pessoa',
  },
];

export const MONTHLY_TOTALS: readonly MonthlyTotals[] = [
  { month: 'Abr', income: 6800, expense: 5200 },
  { month: 'Mai', income: 6900, expense: 5600 },
  { month: 'Jun', income: 7400, expense: 6100 },
  { month: 'Jul', income: 6800, expense: 5300 },
  { month: 'Ago', income: 7100, expense: 5900 },
  { month: 'Set', income: 7200, expense: 5450 },
];

export const CATEGORY_SPENDING: readonly CategorySpending[] = [
  { name: 'Moradia', amount: 1850 },
  { name: 'Alimentação', amount: 1240 },
  { name: 'Transporte', amount: 620 },
  { name: 'Saúde', amount: 410 },
  { name: 'Lazer', amount: 380 },
  { name: 'Assinaturas', amount: 210 },
  { name: 'Outros', amount: 740 },
];

export const UPCOMING_PAYMENTS: readonly UpcomingPayment[] = [
  { description: 'Energia', dueDate: '2026-09-10', amount: 180, icon: 'bolt' },
  { description: 'Cartão Nubank', dueDate: '2026-09-15', amount: 920, icon: 'credit_card' },
  { description: 'Internet', dueDate: '2026-09-20', amount: 120, icon: 'wifi' },
];

export const RECENT_TRANSACTIONS: readonly RecentTransaction[] = [
  {
    description: 'Salário',
    date: '2026-09-05',
    amount: 5400,
    kind: 'INCOME',
    category: 'Salário',
    icon: 'payments',
  },
  {
    description: 'Supermercado',
    date: '2026-09-04',
    amount: 320,
    kind: 'EXPENSE',
    category: 'Alimentação',
    icon: 'shopping_cart',
  },
  {
    description: 'Energia',
    date: '2026-09-03',
    amount: 180,
    kind: 'EXPENSE',
    category: 'Moradia',
    icon: 'bolt',
  },
  {
    description: 'Trabalho extra',
    date: '2026-09-02',
    amount: 600,
    kind: 'INCOME',
    category: 'Trabalho extra',
    icon: 'work',
  },
];

export const RECEIVABLES: readonly SettlementEntry[] = [
  { from: 'Pai', to: 'Você', amount: 420 },
  { from: 'Esposa', to: 'Você', amount: 150 },
];

export const PAYABLES: readonly SettlementEntry[] = [{ from: 'Você', to: 'Mãe', amount: 80 }];
