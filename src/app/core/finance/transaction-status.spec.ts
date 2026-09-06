import { transactionStatusLabel } from './transaction-status';

describe('transactionStatusLabel', () => {
  it('labels expenses as paid and incomes as received', () => {
    expect(transactionStatusLabel('PAID', 'EXPENSE')).toBe('Pago');
    expect(transactionStatusLabel('PAID', 'INCOME')).toBe('Recebido');
    expect(transactionStatusLabel('PAID', 'TRANSFER')).toBe('Efetuada');
  });

  it('adapts the overdue and cancelled wording to the kind', () => {
    expect(transactionStatusLabel('OVERDUE', 'EXPENSE')).toBe('Vencido');
    expect(transactionStatusLabel('OVERDUE', 'INCOME')).toBe('Atrasado');
    expect(transactionStatusLabel('CANCELLED', 'TRANSFER')).toBe('Cancelada');
    expect(transactionStatusLabel('PENDING', 'INCOME')).toBe('Pendente');
  });

  it('uses generic labels when no kind is given', () => {
    expect(transactionStatusLabel('PAID')).toBe('Pago / Recebido');
    expect(transactionStatusLabel('OVERDUE', null)).toBe('Vencido');
  });
});
