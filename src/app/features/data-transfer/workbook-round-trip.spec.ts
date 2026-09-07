import { buildCatalogs } from './catalogs';
import { readWorkbook, writeWorkbookBlob } from './excel-io';
import { parseWorkbook } from './import-parser';
import { planWorkbook } from './import-plan';
import { DatabaseRow } from './workbook-schema';
import { checkCompatibility } from './workbook-info';
import { ExportData, buildWorkbook } from './workbook-model';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const CATEGORY = '33333333-3333-4333-8333-333333333333';
const CARD = '44444444-4444-4444-8444-444444444444';
const TRANSACTION = '55555555-5555-4555-8555-555555555555';
const PERSON = '66666666-6666-4666-8666-666666666666';

const accounts: DatabaseRow[] = [
  {
    id: ACCOUNT,
    owner_user_id: OWNER,
    name: 'Conta corrente',
    type: 'BANK',
    institution: 'Banco',
    opening_balance: 1500.5,
    color: null,
    active: true,
  },
];

const categories: DatabaseRow[] = [
  {
    id: CATEGORY,
    owner_user_id: OWNER,
    kind: 'EXPENSE',
    name: 'Alimentação',
    icon: null,
    color: null,
    active: true,
  },
];

const cards: DatabaseRow[] = [
  {
    id: CARD,
    owner_user_id: OWNER,
    name: 'Cartão',
    institution: null,
    limit_amount: 5000,
    closing_day: 20,
    due_day: 28,
    color: null,
    active: true,
  },
];

const transactions: DatabaseRow[] = [
  {
    id: TRANSACTION,
    owner_user_id: OWNER,
    kind: 'EXPENSE',
    description: 'Supermercado',
    amount: 320.45,
    date: '2026-09-05',
    due_date: null,
    status: 'PAID',
    category_id: CATEGORY,
    account_id: ACCOUNT,
    destination_account_id: null,
    credit_card_id: null,
    invoice_due_date: null,
    household_id: null,
    installment_group_id: null,
    installment_number: null,
    installment_count: null,
    fixed_expense_id: null,
    recurring_income_id: null,
    recurrence_month: null,
    counterparty_user_id: null,
    settlement_direction: null,
    loan_id: null,
    loan_installment_number: null,
    financing_id: null,
    financing_installment_number: null,
    notes: 'Compra do mês',
  },
];

const allocations: DatabaseRow[] = [
  { id: '77777777-7777-4777-8777-777777777777', transaction_id: TRANSACTION, user_id: PERSON, amount: 160.22 },
];

const people: DatabaseRow[] = [{ id: PERSON, display_name: 'Bob' }];

const data: ExportData = new Map<string, readonly DatabaseRow[]>([
  ['Contas', accounts],
  ['Categorias', categories],
  ['Cartoes', cards],
  ['Emprestimos', []],
  ['Financiamentos', []],
  ['GastosFixos', []],
  ['ReceitasRecorrentes', []],
  ['Movimentacoes', transactions],
  ['Divisoes', allocations],
  ['Grupos', []],
  ['Pessoas', people],
]);

const catalogs = buildCatalogs({
  accounts,
  categories,
  cards,
  households: [],
  people,
});

const info = {
  application: 'Baru Budget',
  schemaVersion: 1,
  exportedAt: '2026-09-07T12:00:00.000Z',
  appVersion: '0.12.0',
  ownerUserId: OWNER,
  ownerName: 'Alice',
};

function byId(rows: readonly DatabaseRow[]): Map<string, DatabaseRow> {
  return new Map(rows.map((row) => [String(row['id']), row]));
}

describe('Baru Budget Excel Format round trip', () => {
  it('writes a file, reads it back and finds nothing to change', async () => {
    const model = buildWorkbook(info, data, catalogs);
    const blob = await writeWorkbookBlob(model);
    const contents = await readWorkbook(blob);

    const parsed = parseWorkbook(contents);
    expect(checkCompatibility(parsed.info).compatible).toBe(true);
    expect(parsed.unknownSheets).toEqual([]);

    const plan = planWorkbook({
      parsed: parsed.sheets,
      existing: new Map([
        ['Contas', byId(accounts)],
        ['Categorias', byId(categories)],
        ['Cartoes', byId(cards)],
        ['Movimentacoes', byId(transactions)],
        ['Divisoes', byId(allocations)],
      ]),
      catalogs,
      newId: () => 'unused',
    });

    expect(plan.invalid).toBe(0);
    expect(plan.created).toBe(0);
    expect(plan.updated).toBe(0);
    expect(plan.unchanged).toBe(5);
    expect(plan.hasWork).toBe(false);
  });

  it('carries the metadata and the readable names into the file', async () => {
    const model = buildWorkbook(info, data, catalogs);
    const blob = await writeWorkbookBlob(model);
    const contents = await readWorkbook(blob);

    const parsed = parseWorkbook(contents);
    expect(parsed.info.get('application')).toBe('Baru Budget');
    expect(parsed.info.get('schema_version')).toBe('1');
    expect(parsed.info.get('owner_name')).toBe('Alice');

    const movements = contents.find((sheet) => sheet.sheet === 'Movimentacoes')!;
    const header = movements.data[0] as string[];
    const row = movements.data[1];
    expect(row[header.indexOf('conta')]).toBe('Conta corrente');
    expect(row[header.indexOf('categoria')]).toBe('Alimentação');
    expect(row[header.indexOf('valor')]).toBe(320.45);
    expect(header).not.toContain('owner_user_id');
  });

  it('detects an edit made in the spreadsheet', async () => {
    const edited = new Map(data);
    edited.set('Movimentacoes', [{ ...transactions[0], amount: 400, description: 'Mercado' }]);
    const model = buildWorkbook(info, edited, catalogs);
    const contents = await readWorkbook(await writeWorkbookBlob(model));

    const plan = planWorkbook({
      parsed: parseWorkbook(contents).sheets,
      existing: new Map([['Movimentacoes', byId(transactions)]]),
      catalogs,
      newId: () => 'unused',
    });
    const sheet = plan.sheets.find((candidate) => candidate.sheetName === 'Movimentacoes')!;
    expect(sheet.updated).toBe(1);
    expect(sheet.rows[0].values['amount']).toBe(400);
    expect(sheet.rows[0].values['description']).toBe('Mercado');
  });
});
