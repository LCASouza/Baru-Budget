import { EMPTY_CATALOG, buildCatalog } from './catalogs';
import {
  Catalogs,
  ExistingRows,
  ParsedRow,
  fieldTypes,
  isUnchanged,
  parseCell,
  planWorkbook,
} from './import-plan';
import {
  CellValue,
  DatabaseRow,
  IMPORTABLE_SHEETS,
  SheetColumn,
  sheetByName,
} from './workbook-schema';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const ALIEN_ID = '99999999-9999-4999-8999-999999999999';
const GENERATED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const catalogs: Catalogs = {
  accounts: buildCatalog(
    [
      { id: ACCOUNT_ID, name: 'Conta corrente' },
      { id: OTHER_ACCOUNT_ID, name: 'Carteira' },
    ],
    'name',
  ),
  categories: buildCatalog(
    [
      { id: CATEGORY_ID, name: 'Alimentação' },
      { id: '44444444-4444-4444-8444-444444444444', name: 'Repetida' },
      { id: '55555555-5555-4555-8555-555555555555', name: 'Repetida' },
    ],
    'name',
  ),
  cards: EMPTY_CATALOG,
  households: EMPTY_CATALOG,
  people: EMPTY_CATALOG,
};

function row(line: number, cells: Record<string, CellValue>): ParsedRow {
  return { line, cells: new Map(Object.entries(cells)) };
}

function planAccounts(
  rows: readonly ParsedRow[],
  existing: ExistingRows = new Map<string, DatabaseRow>(),
) {
  const plan = planWorkbook({
    parsed: new Map([['Contas', rows]]),
    existing: new Map([['Contas', existing]]),
    catalogs,
    newId: () => GENERATED,
  });
  return plan.sheets.find((sheet) => sheet.sheetName === 'Contas')!;
}

const validAccount = {
  nome: 'Poupança',
  tipo: 'BANK',
  instituicao: null,
  saldo_inicial: 100,
  cor: null,
  ativo: true,
};

describe('parseCell', () => {
  const money: SheetColumn = { key: 'valor', label: 'Valor', type: 'money', role: 'editable' };
  const date: SheetColumn = { key: 'data', label: 'Data', type: 'date', role: 'editable' };
  const required: SheetColumn = { ...money, required: true };

  it('accepts numbers and Brazilian text for money', () => {
    expect(parseCell(money, 1234.567)).toEqual({ ok: true, value: 1234.57 });
    expect(parseCell(money, '1.234,56')).toEqual({ ok: true, value: 1234.56 });
  });

  it('accepts real dates and both written forms', () => {
    expect(parseCell(date, new Date(2026, 8, 5))).toEqual({ ok: true, value: '2026-09-05' });
    expect(parseCell(date, '2026-09-05')).toEqual({ ok: true, value: '2026-09-05' });
    expect(parseCell(date, '5/9/2026')).toEqual({ ok: true, value: '2026-09-05' });
    expect(parseCell(date, 'ontem').ok).toBe(false);
  });

  it('keeps an empty optional cell null and refuses an empty required one', () => {
    expect(parseCell(money, null)).toEqual({ ok: true, value: null });
    expect(parseCell(money, '   ')).toEqual({ ok: true, value: null });
    expect(parseCell(required, null).ok).toBe(false);
  });

  it('checks enums, booleans and identifiers', () => {
    const kind: SheetColumn = {
      key: 'tipo',
      label: 'Tipo',
      type: 'enum',
      role: 'editable',
      enumValues: ['INCOME', 'EXPENSE'],
    };
    expect(parseCell(kind, 'expense')).toEqual({ ok: true, value: 'EXPENSE' });
    expect(parseCell(kind, 'SAÍDA').ok).toBe(false);

    const active: SheetColumn = { key: 'ativo', label: 'Ativa', type: 'boolean', role: 'editable' };
    expect(parseCell(active, 'VERDADEIRO')).toEqual({ ok: true, value: true });
    expect(parseCell(active, 'não')).toEqual({ ok: true, value: false });
    expect(parseCell(active, 'talvez').ok).toBe(false);

    const id: SheetColumn = { key: 'id', label: 'ID', type: 'uuid', role: 'key' };
    expect(parseCell(id, ACCOUNT_ID)).toEqual({ ok: true, value: ACCOUNT_ID });
    expect(parseCell(id, 'abc').ok).toBe(false);
  });
});

describe('isUnchanged', () => {
  it('treats null, undefined and empty text as the same absence', () => {
    expect(isUnchanged({ notes: null }, { notes: '' })).toBe(true);
    expect(isUnchanged({ notes: null }, { notes: 'algo' })).toBe(false);
  });

  it('compares a numeric field by value and a text field literally', () => {
    const numeric = new Map<string, 'money'>([['amount', 'money']]);
    expect(isUnchanged({ amount: 100 }, { amount: '100.00' }, numeric)).toBe(true);
    expect(isUnchanged({ amount: 100 }, { amount: 100.01 }, numeric)).toBe(false);
    expect(isUnchanged({ description: '100' }, { description: '100.00' })).toBe(false);
  });

  it('reads the numeric fields straight from the contract', () => {
    const types = fieldTypes(sheetByName('Contas')!);
    expect(types.get('opening_balance')).toBe('money');
    expect(types.get('name')).toBe('text');
  });

  it('ignores fields the sheet does not write', () => {
    expect(isUnchanged({ name: 'Conta' }, { name: 'Conta', owner_user_id: 'u1' })).toBe(true);
  });
});

describe('planWorkbook classification', () => {
  it('creates a record when the id cell is empty', () => {
    const plan = planAccounts([row(2, { id: null, ...validAccount })]);
    expect(plan.created).toBe(1);
    expect(plan.rows[0].id).toBe(GENERATED);
  });

  it('creates a record with the id the file brings when it is unknown', () => {
    const plan = planAccounts([row(2, { id: ALIEN_ID, ...validAccount })]);
    expect(plan.rows[0].status).toBe('new');
    expect(plan.rows[0].id).toBe(ALIEN_ID);
  });

  it('updates a known record and leaves an identical one alone', () => {
    const existing: ExistingRows = new Map([
      [
        ACCOUNT_ID,
        {
          id: ACCOUNT_ID,
          name: 'Poupança',
          type: 'BANK',
          institution: null,
          opening_balance: 100,
          color: null,
          active: true,
        },
      ],
    ]);
    const unchangedPlan = planAccounts([row(2, { id: ACCOUNT_ID, ...validAccount })], existing);
    expect(unchangedPlan.unchanged).toBe(1);
    expect(unchangedPlan.updated).toBe(0);

    const changedPlan = planAccounts(
      [row(2, { id: ACCOUNT_ID, ...validAccount, saldo_inicial: 250 })],
      existing,
    );
    expect(changedPlan.updated).toBe(1);
    expect(changedPlan.rows[0].values['opening_balance']).toBe(250);
  });

  it('invalidates a row with a missing required field or a bad enum', () => {
    const plan = planAccounts([
      row(2, { ...validAccount, nome: null }),
      row(3, { ...validAccount, tipo: 'POUPANCA' }),
    ]);
    expect(plan.invalid).toBe(2);
    expect(plan.rows[0].issues[0].column).toBe('nome');
    expect(plan.rows[1].issues[0].message).toContain('fora do domínio');
  });

  it('counts records the file does not mention and keeps them', () => {
    const existing: ExistingRows = new Map([
      [ACCOUNT_ID, { id: ACCOUNT_ID, name: 'Conta corrente' }],
      [OTHER_ACCOUNT_ID, { id: OTHER_ACCOUNT_ID, name: 'Carteira' }],
    ]);
    const plan = planAccounts([row(2, { id: ACCOUNT_ID, ...validAccount })], existing);
    expect(plan.untouched).toBe(1);
  });
});

describe('planWorkbook name resolution', () => {
  function planTransaction(cells: Record<string, CellValue>) {
    const plan = planWorkbook({
      parsed: new Map([['Movimentacoes', [row(2, cells)]]]),
      existing: new Map(),
      catalogs,
      newId: () => GENERATED,
    });
    return plan.sheets.find((sheet) => sheet.sheetName === 'Movimentacoes')!.rows[0];
  }

  // An exported sheet carries every column of the contract, so a link the user
  // left blank arrives as a present cell holding nothing. A column missing from
  // the sheet altogether means something else: an older schema version that never
  // knew about it, and the plan leaves that one alone.
  const base = {
    id: null,
    tipo: 'EXPENSE',
    descricao: 'Mercado',
    valor: 100,
    data: '2026-09-05',
    status: 'PAID',
    conta: null,
    account_id: null,
  };

  it('resolves a link by name when the id cell is empty', () => {
    const planned = planTransaction({ ...base, conta: 'Conta corrente', categoria: 'Alimentação' });
    expect(planned.status).toBe('new');
    expect(planned.values['account_id']).toBe(ACCOUNT_ID);
    expect(planned.values['category_id']).toBe(CATEGORY_ID);
  });

  it('lets the id win over the name', () => {
    const planned = planTransaction({
      ...base,
      conta: 'Carteira',
      account_id: ACCOUNT_ID,
      categoria: 'Alimentação',
    });
    expect(planned.values['account_id']).toBe(ACCOUNT_ID);
  });

  it('invalidates an unknown name instead of creating a record', () => {
    const planned = planTransaction({ ...base, conta: 'Banco inventado' });
    expect(planned.status).toBe('invalid');
    expect(planned.issues[0].message).toContain('não existe');
  });

  it('invalidates an ambiguous name', () => {
    const planned = planTransaction({ ...base, categoria: 'Repetida' });
    expect(planned.status).toBe('invalid');
    expect(planned.issues[0].message).toContain('mais de um registro');
  });

  it('refuses a reference that does not belong to the owner', () => {
    const planned = planTransaction({ ...base, account_id: ALIEN_ID });
    expect(planned.status).toBe('invalid');
    expect(planned.issues[0].message).toContain('não pertence');
  });

  it('accepts a link left empty when the column allows it', () => {
    const planned = planTransaction(base);
    expect(planned.status).toBe('new');
    expect(planned.values['account_id']).toBeNull();
  });
});

describe('planWorkbook across sheets', () => {
  it('lets a later sheet reference a record created earlier in the same file', () => {
    const plan = planWorkbook({
      parsed: new Map([
        ['Contas', [row(2, { id: ALIEN_ID, ...validAccount })]],
        [
          'Movimentacoes',
          [
            row(2, {
              id: null,
              tipo: 'EXPENSE',
              descricao: 'Mercado',
              valor: 10,
              data: '2026-09-05',
              status: 'PAID',
              account_id: ALIEN_ID,
            }),
          ],
        ],
      ]),
      existing: new Map(),
      catalogs,
      newId: () => GENERATED,
    });
    const transactions = plan.sheets.find((sheet) => sheet.sheetName === 'Movimentacoes')!;
    expect(transactions.invalid).toBe(0);
    expect(transactions.created).toBe(1);
  });

  it('requires a transaction and a person on every allocation', () => {
    const plan = planWorkbook({
      parsed: new Map([['Divisoes', [row(2, { id: null, valor: 50 })]]]),
      existing: new Map(),
      catalogs,
      newId: () => GENERATED,
    });
    const allocations = plan.sheets.find((sheet) => sheet.sheetName === 'Divisoes')!;
    expect(allocations.invalid).toBe(1);
    expect(allocations.rows[0].issues.map((issue) => issue.column)).toEqual(
      expect.arrayContaining(['transaction_id', 'pessoa']),
    );
  });

  it('reports totals and whether there is anything to apply', () => {
    const empty = planWorkbook({
      parsed: new Map(),
      existing: new Map(),
      catalogs,
      newId: () => GENERATED,
    });
    expect(empty.hasWork).toBe(false);
    expect(empty.sheets).toHaveLength(
      IMPORTABLE_SHEETS.length,
    );
    expect(sheetByName('Movimentacoes')?.importable).toBe(true);
  });
});

describe('reading a schema version 1 workbook', () => {
  const loan = {
    id: null,
    descricao: 'Empréstimo',
    principal: 6000,
    taxa_juros: 1.95,
    periodo_taxa: 'MONTHLY',
    modelo_juros: 'PRICE',
    parcelas: 12,
    data_inicio: '2026-06-02',
    primeira_parcela: '2026-07-07',
  };

  function planLoan(cells: Record<string, CellValue>) {
    const plan = planWorkbook({
      parsed: new Map([['Emprestimos', [row(2, cells)]]]),
      existing: new Map(),
      catalogs,
      newId: () => GENERATED,
    });
    return plan.sheets.find((sheet) => sheet.sheetName === 'Emprestimos')!.rows[0];
  }

  it('leaves a column the workbook never carried alone', () => {
    // A version 1 file has no `seguro` and no `taxa`. Writing null for them would
    // clear a value the file was never able to describe.
    const planned = planLoan(loan);
    expect(planned.status).toBe('new');
    expect('insurance_amount' in planned.values).toBe(false);
    expect('fee_amount' in planned.values).toBe(false);
  });

  it('still clears a column the workbook carries empty', () => {
    const planned = planLoan({ ...loan, seguro: null, taxa: null });
    expect(planned.values['insurance_amount']).toBeNull();
    expect(planned.values['fee_amount']).toBeNull();
  });

  it('keeps a required column reported when the workbook omits it', () => {
    const { descricao, ...withoutDescription } = loan;
    void descricao;
    const planned = planLoan(withoutDescription);
    expect(planned.status).toBe('invalid');
    expect(planned.issues[0].column).toBe('descricao');
  });
});

describe('the statements sheet', () => {
  it('plans an observed statement', () => {
    const plan = planWorkbook({
      parsed: new Map([
        [
          'Extratos',
          [
            row(2, {
              id: null,
              financing_id: '11111111-1111-4111-8111-111111111111',
              loan_id: null,
              competencia: '2026-09-01',
              saldo_devedor: 183670.08,
              parcela: 1125.09,
              seguro: 31.59,
              taxa: 25,
              parcelas_restantes: 394,
            }),
          ],
        ],
      ]),
      existing: new Map(),
      catalogs,
      newId: () => GENERATED,
    });
    const planned = plan.sheets.find((sheet) => sheet.sheetName === 'Extratos')!.rows[0];
    expect(planned.status).toBe('new');
    expect(planned.values['outstanding_balance']).toBe(183670.08);
    expect(planned.values['remaining_count']).toBe(394);
    expect(planned.values['competence']).toBe('2026-09-01');
  });
});
