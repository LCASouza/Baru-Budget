// Baru Budget Excel Format, schema version 2.
//
// This module is the whole contract: the export walks it to write cells and the
// import walks it to read them, so the two sides cannot drift.
//
// Version 2 adds the observed statements and the instalment charges. It only
// adds: every sheet, column key and value of version 1 means the same thing, so
// a version 1 workbook is read by leaving the columns it does not carry
// untouched instead of overwriting them with nothing. That is the whole
// converter, and it lives in `planRow`.

export const SCHEMA_VERSION = 2;

/** Versions the import accepts. A version 1 file is read and converted. */
export const READABLE_SCHEMA_VERSIONS: readonly number[] = [1, 2];
export const APPLICATION_NAME = 'Baru Budget';

export type CellValue = string | number | boolean | Date | null;
export type DatabaseRow = Record<string, unknown>;

export type CellType = 'text' | 'number' | 'money' | 'date' | 'boolean' | 'uuid' | 'enum';

/** Tables that carry the owner directly. */
export type OwnedTable =
  | 'accounts'
  | 'categories'
  | 'credit_cards'
  | 'loans'
  | 'financings'
  | 'fixed_expenses'
  | 'recurring_incomes'
  | 'transactions';

/** Tables without an owner column, where row level security alone decides. */
export type SharedTable =
  | 'transaction_allocations'
  | 'debt_statements'
  | 'households'
  | 'profiles';

/** Tables the format covers. Nothing outside this list is ever read or written. */
export type ExportableTable = OwnedTable | SharedTable;

export const OWNED_TABLES: readonly OwnedTable[] = [
  'accounts',
  'categories',
  'credit_cards',
  'loans',
  'financings',
  'fixed_expenses',
  'recurring_incomes',
  'transactions',
];

export function isOwnedTable(table: ExportableTable): table is OwnedTable {
  return (OWNED_TABLES as readonly string[]).includes(table);
}

/**
 * `key` columns identify the record, `editable` ones are written back,
 * `readonly` ones are exported for reading and ignored on import, and `lookup`
 * ones carry a readable name that resolves an id only when the id cell is empty.
 */
export type ColumnRole = 'key' | 'editable' | 'readonly' | 'lookup';

/** Catalogs used to turn an id into a name and a name back into an id. */
export type CatalogName = 'accounts' | 'categories' | 'cards' | 'households' | 'people';

export interface SheetColumn {
  /** Header written in the sheet and, for editable columns, the database field. */
  readonly key: string;
  /** Portuguese label used by the preview screen. */
  readonly label: string;
  readonly type: CellType;
  readonly role: ColumnRole;
  readonly required?: boolean;
  readonly enumValues?: readonly string[];
  /** Database field when it differs from `key`. */
  readonly field?: string;
  /** Lookup columns only: the id field this name can fill and where to look. */
  readonly fills?: { readonly field: string; readonly catalog: CatalogName };
  /** Lookup columns only: the filled id must end up present. */
  readonly requiredRef?: boolean;
  /** Readonly columns only: the database field they mirror. */
  readonly source?: string;
}

export interface SheetSpec {
  /** Sheet name in the workbook. */
  readonly name: string;
  readonly table: ExportableTable;
  readonly importable: boolean;
  /** Short line written above the table, so the file explains itself. */
  readonly note: string;
  readonly columns: readonly SheetColumn[];
}

const ID: SheetColumn = { key: 'id', label: 'ID', type: 'uuid', role: 'key' };

function lookup(
  key: string,
  label: string,
  field: string,
  catalog: CatalogName,
): SheetColumn {
  return { key, label, type: 'text', role: 'lookup', fills: { field, catalog } };
}

function idRef(key: string, label: string): SheetColumn {
  return { key, label, type: 'uuid', role: 'editable' };
}

const ACCOUNT_TYPES = ['BANK', 'CASH', 'BENEFIT', 'OTHER'] as const;
const CATEGORY_KINDS = ['INCOME', 'EXPENSE'] as const;
const TRANSACTION_KINDS = ['INCOME', 'EXPENSE', 'TRANSFER', 'SETTLEMENT'] as const;
const TRANSACTION_STATUSES = ['PENDING', 'PAID', 'CANCELLED'] as const;
const SETTLEMENT_DIRECTIONS = ['PAY', 'RECEIVE'] as const;
const FREQUENCIES = ['MONTHLY', 'YEARLY'] as const;
const INTEREST_PERIODS = ['MONTHLY', 'YEARLY'] as const;
const LOAN_MODELS = ['SIMPLE', 'PRICE'] as const;
const FINANCING_SYSTEMS = ['PRICE', 'SAC'] as const;

export const ACCOUNTS_SHEET: SheetSpec = {
  name: 'Contas',
  table: 'accounts',
  importable: true,
  note: 'Contas do proprietário. O saldo atual é derivado das movimentações e não aparece aqui.',
  columns: [
    ID,
    { key: 'nome', label: 'Nome', type: 'text', role: 'editable', field: 'name', required: true },
    { key: 'tipo', label: 'Tipo', type: 'enum', role: 'editable', field: 'type', required: true, enumValues: ACCOUNT_TYPES },
    { key: 'instituicao', label: 'Instituição', type: 'text', role: 'editable', field: 'institution' },
    { key: 'saldo_inicial', label: 'Saldo inicial', type: 'money', role: 'editable', field: 'opening_balance', required: true },
    { key: 'cor', label: 'Cor', type: 'text', role: 'editable', field: 'color' },
    { key: 'ativo', label: 'Ativa', type: 'boolean', role: 'editable', field: 'active', required: true },
  ],
};

export const CATEGORIES_SHEET: SheetSpec = {
  name: 'Categorias',
  table: 'categories',
  importable: true,
  note: 'Categorias do proprietário. O tipo separa receitas de despesas e não pode misturar.',
  columns: [
    ID,
    { key: 'tipo', label: 'Tipo', type: 'enum', role: 'editable', field: 'kind', required: true, enumValues: CATEGORY_KINDS },
    { key: 'nome', label: 'Nome', type: 'text', role: 'editable', field: 'name', required: true },
    { key: 'icone', label: 'Ícone', type: 'text', role: 'editable', field: 'icon' },
    { key: 'cor', label: 'Cor', type: 'text', role: 'editable', field: 'color' },
    { key: 'ativo', label: 'Ativa', type: 'boolean', role: 'editable', field: 'active', required: true },
  ],
};

export const CARDS_SHEET: SheetSpec = {
  name: 'Cartoes',
  table: 'credit_cards',
  importable: true,
  note: 'Cartões de crédito. A fatura é derivada das compras e não aparece aqui.',
  columns: [
    ID,
    { key: 'nome', label: 'Nome', type: 'text', role: 'editable', field: 'name', required: true },
    { key: 'instituicao', label: 'Instituição', type: 'text', role: 'editable', field: 'institution' },
    { key: 'limite', label: 'Limite', type: 'money', role: 'editable', field: 'limit_amount' },
    { key: 'dia_fechamento', label: 'Dia de fechamento', type: 'number', role: 'editable', field: 'closing_day', required: true },
    { key: 'dia_vencimento', label: 'Dia de vencimento', type: 'number', role: 'editable', field: 'due_day', required: true },
    { key: 'cor', label: 'Cor', type: 'text', role: 'editable', field: 'color' },
    { key: 'ativo', label: 'Ativo', type: 'boolean', role: 'editable', field: 'active', required: true },
  ],
};

export const LOANS_SHEET: SheetSpec = {
  name: 'Emprestimos',
  table: 'loans',
  importable: true,
  note: 'Empréstimos tomados. As parcelas ficam em Movimentacoes, vinculadas por emprestimo_id.',
  columns: [
    ID,
    { key: 'descricao', label: 'Descrição', type: 'text', role: 'editable', field: 'description', required: true },
    { key: 'credor', label: 'Credor', type: 'text', role: 'editable', field: 'lender' },
    lookup('conta', 'Conta', 'account_id', 'accounts'),
    idRef('account_id', 'ID da conta'),
    lookup('categoria', 'Categoria das parcelas', 'category_id', 'categories'),
    idRef('category_id', 'ID da categoria'),
    lookup('categoria_liberacao', 'Categoria da liberação', 'disbursement_category_id', 'categories'),
    idRef('disbursement_category_id', 'ID da categoria da liberação'),
    lookup('grupo', 'Grupo', 'household_id', 'households'),
    idRef('household_id', 'ID do grupo'),
    { key: 'principal', label: 'Valor emprestado', type: 'money', role: 'editable', required: true },
    { key: 'taxa_juros', label: 'Taxa de juros (%)', type: 'number', role: 'editable', field: 'interest_rate', required: true },
    { key: 'periodo_taxa', label: 'Período da taxa', type: 'enum', role: 'editable', field: 'interest_period', required: true, enumValues: INTEREST_PERIODS },
    { key: 'modelo_juros', label: 'Modelo de juros', type: 'enum', role: 'editable', field: 'interest_model', required: true, enumValues: LOAN_MODELS },
    { key: 'parcelas', label: 'Parcelas', type: 'number', role: 'editable', field: 'installment_count', required: true },
    { key: 'data_inicio', label: 'Data do empréstimo', type: 'date', role: 'editable', field: 'start_date', required: true },
    { key: 'primeira_parcela', label: 'Primeira parcela', type: 'date', role: 'editable', field: 'first_due_date', required: true },
    { key: 'observacoes', label: 'Observações', type: 'text', role: 'editable', field: 'notes' },
    { key: 'seguro', label: 'Seguro', type: 'money', role: 'editable', field: 'insurance_amount' },
    { key: 'taxa', label: 'Taxa operacional', type: 'money', role: 'editable', field: 'fee_amount' },
  ],
};

export const FINANCINGS_SHEET: SheetSpec = {
  name: 'Financiamentos',
  table: 'financings',
  importable: true,
  note: 'Financiamentos. O valor do bem não é lançamento: só a entrada e as parcelas viram movimentação.',
  columns: [
    ID,
    { key: 'descricao', label: 'Descrição', type: 'text', role: 'editable', field: 'description', required: true },
    { key: 'instituicao', label: 'Instituição', type: 'text', role: 'editable', field: 'institution' },
    lookup('conta', 'Conta', 'account_id', 'accounts'),
    idRef('account_id', 'ID da conta'),
    lookup('categoria', 'Categoria das parcelas', 'category_id', 'categories'),
    idRef('category_id', 'ID da categoria'),
    lookup('categoria_entrada', 'Categoria da entrada', 'down_payment_category_id', 'categories'),
    idRef('down_payment_category_id', 'ID da categoria da entrada'),
    lookup('grupo', 'Grupo', 'household_id', 'households'),
    idRef('household_id', 'ID do grupo'),
    { key: 'valor_bem', label: 'Valor do bem', type: 'money', role: 'editable', field: 'asset_value', required: true },
    { key: 'entrada', label: 'Entrada', type: 'money', role: 'editable', field: 'down_payment', required: true },
    { key: 'valor_financiado', label: 'Valor financiado', type: 'money', role: 'readonly', source: 'financed_amount' },
    { key: 'taxa_juros', label: 'Taxa de juros (%)', type: 'number', role: 'editable', field: 'interest_rate', required: true },
    { key: 'periodo_taxa', label: 'Período da taxa', type: 'enum', role: 'editable', field: 'interest_period', required: true, enumValues: INTEREST_PERIODS },
    { key: 'sistema', label: 'Sistema', type: 'enum', role: 'editable', field: 'system', required: true, enumValues: FINANCING_SYSTEMS },
    { key: 'parcelas', label: 'Parcelas', type: 'number', role: 'editable', field: 'installment_count', required: true },
    { key: 'data_aquisicao', label: 'Data da aquisição', type: 'date', role: 'editable', field: 'acquisition_date', required: true },
    { key: 'primeira_parcela', label: 'Primeira parcela', type: 'date', role: 'editable', field: 'first_due_date', required: true },
    { key: 'observacoes', label: 'Observações', type: 'text', role: 'editable', field: 'notes' },
    { key: 'seguro', label: 'Seguro', type: 'money', role: 'editable', field: 'insurance_amount' },
    { key: 'taxa', label: 'Taxa operacional', type: 'money', role: 'editable', field: 'fee_amount' },
  ],
};

export const FIXED_EXPENSES_SHEET: SheetSpec = {
  name: 'GastosFixos',
  table: 'fixed_expenses',
  importable: true,
  note: 'Modelos de gasto fixo. Cada mês gerado vira uma movimentação com gasto_fixo_id.',
  columns: [
    ID,
    { key: 'descricao', label: 'Descrição', type: 'text', role: 'editable', field: 'description', required: true },
    lookup('categoria', 'Categoria', 'category_id', 'categories'),
    idRef('category_id', 'ID da categoria'),
    lookup('conta', 'Conta', 'account_id', 'accounts'),
    idRef('account_id', 'ID da conta'),
    lookup('cartao', 'Cartão', 'credit_card_id', 'cards'),
    idRef('credit_card_id', 'ID do cartão'),
    lookup('grupo', 'Grupo', 'household_id', 'households'),
    idRef('household_id', 'ID do grupo'),
    { key: 'valor_padrao', label: 'Valor padrão', type: 'money', role: 'editable', field: 'default_amount', required: true },
    { key: 'dia_vencimento', label: 'Dia de vencimento', type: 'number', role: 'editable', field: 'due_day', required: true },
    { key: 'frequencia', label: 'Frequência', type: 'enum', role: 'editable', field: 'frequency', required: true, enumValues: FREQUENCIES },
    { key: 'mes_base', label: 'Mês base', type: 'number', role: 'editable', field: 'anchor_month' },
    { key: 'ativo', label: 'Ativo', type: 'boolean', role: 'editable', field: 'active', required: true },
    { key: 'observacoes', label: 'Observações', type: 'text', role: 'editable', field: 'notes' },
  ],
};

export const RECURRING_INCOMES_SHEET: SheetSpec = {
  name: 'ReceitasRecorrentes',
  table: 'recurring_incomes',
  importable: true,
  note: 'Modelos de receita recorrente. Cada mês gerado vira uma movimentação com receita_recorrente_id.',
  columns: [
    ID,
    { key: 'descricao', label: 'Descrição', type: 'text', role: 'editable', field: 'description', required: true },
    lookup('categoria', 'Categoria', 'category_id', 'categories'),
    idRef('category_id', 'ID da categoria'),
    lookup('conta', 'Conta', 'account_id', 'accounts'),
    idRef('account_id', 'ID da conta'),
    lookup('grupo', 'Grupo', 'household_id', 'households'),
    idRef('household_id', 'ID do grupo'),
    { key: 'valor_padrao', label: 'Valor padrão', type: 'money', role: 'editable', field: 'default_amount', required: true },
    { key: 'dia_recebimento', label: 'Dia de recebimento', type: 'number', role: 'editable', field: 'receipt_day', required: true },
    { key: 'frequencia', label: 'Frequência', type: 'enum', role: 'editable', field: 'frequency', required: true, enumValues: FREQUENCIES },
    { key: 'mes_base', label: 'Mês base', type: 'number', role: 'editable', field: 'anchor_month' },
    { key: 'ativo', label: 'Ativa', type: 'boolean', role: 'editable', field: 'active', required: true },
    { key: 'observacoes', label: 'Observações', type: 'text', role: 'editable', field: 'notes' },
  ],
};

export const TRANSACTIONS_SHEET: SheetSpec = {
  name: 'Movimentacoes',
  table: 'transactions',
  importable: true,
  note: 'Todas as movimentações, incluindo parcelas, instâncias de recorrência, compras de cartão e acertos.',
  columns: [
    ID,
    { key: 'tipo', label: 'Tipo', type: 'enum', role: 'editable', field: 'kind', required: true, enumValues: TRANSACTION_KINDS },
    { key: 'descricao', label: 'Descrição', type: 'text', role: 'editable', field: 'description', required: true },
    { key: 'valor', label: 'Valor', type: 'money', role: 'editable', field: 'amount', required: true },
    { key: 'data', label: 'Data', type: 'date', role: 'editable', field: 'date', required: true },
    { key: 'vencimento', label: 'Vencimento', type: 'date', role: 'editable', field: 'due_date' },
    { key: 'status', label: 'Status', type: 'enum', role: 'editable', required: true, enumValues: TRANSACTION_STATUSES },
    lookup('categoria', 'Categoria', 'category_id', 'categories'),
    idRef('category_id', 'ID da categoria'),
    lookup('conta', 'Conta', 'account_id', 'accounts'),
    idRef('account_id', 'ID da conta'),
    lookup('conta_destino', 'Conta de destino', 'destination_account_id', 'accounts'),
    idRef('destination_account_id', 'ID da conta de destino'),
    lookup('cartao', 'Cartão', 'credit_card_id', 'cards'),
    idRef('credit_card_id', 'ID do cartão'),
    { key: 'vencimento_fatura', label: 'Vencimento da fatura', type: 'date', role: 'editable', field: 'invoice_due_date' },
    lookup('grupo', 'Grupo', 'household_id', 'households'),
    idRef('household_id', 'ID do grupo'),
    idRef('installment_group_id', 'ID do parcelamento'),
    { key: 'parcela', label: 'Parcela', type: 'number', role: 'editable', field: 'installment_number' },
    { key: 'total_parcelas', label: 'Total de parcelas', type: 'number', role: 'editable', field: 'installment_count' },
    idRef('fixed_expense_id', 'ID do gasto fixo'),
    idRef('recurring_income_id', 'ID da receita recorrente'),
    { key: 'mes_recorrencia', label: 'Mês da recorrência', type: 'date', role: 'editable', field: 'recurrence_month' },
    lookup('contraparte', 'Contraparte', 'counterparty_user_id', 'people'),
    idRef('counterparty_user_id', 'ID da contraparte'),
    { key: 'direcao_acerto', label: 'Direção do acerto', type: 'enum', role: 'editable', field: 'settlement_direction', enumValues: SETTLEMENT_DIRECTIONS },
    idRef('loan_id', 'ID do empréstimo'),
    { key: 'parcela_emprestimo', label: 'Parcela do empréstimo', type: 'number', role: 'editable', field: 'loan_installment_number' },
    idRef('financing_id', 'ID do financiamento'),
    { key: 'parcela_financiamento', label: 'Parcela do financiamento', type: 'number', role: 'editable', field: 'financing_installment_number' },
    { key: 'observacoes', label: 'Observações', type: 'text', role: 'editable', field: 'notes' },
  ],
};

export const ALLOCATIONS_SHEET: SheetSpec = {
  name: 'Divisoes',
  table: 'transaction_allocations',
  importable: true,
  note: 'Divisão de uma despesa entre pessoas. A soma das divisões precisa ser igual ao valor da movimentação.',
  columns: [
    ID,
    { ...idRef('transaction_id', 'ID da movimentação'), required: true },
    { ...lookup('pessoa', 'Pessoa', 'user_id', 'people'), requiredRef: true },
    idRef('user_id', 'ID da pessoa'),
    { key: 'valor', label: 'Valor', type: 'money', role: 'editable', field: 'amount', required: true },
  ],
};

export const STATEMENTS_SHEET: SheetSpec = {
  name: 'Extratos',
  table: 'debt_statements',
  importable: true,
  note: 'O que o credor informou em cada mês. Preencha emprestimo_id ou financiamento_id, nunca os dois.',
  columns: [
    ID,
    idRef('loan_id', 'ID do empréstimo'),
    idRef('financing_id', 'ID do financiamento'),
    { key: 'competencia', label: 'Mês', type: 'date', role: 'editable', field: 'competence', required: true },
    { key: 'saldo_devedor', label: 'Saldo devedor', type: 'money', role: 'editable', field: 'outstanding_balance', required: true },
    { key: 'parcela', label: 'Parcela', type: 'money', role: 'editable', field: 'installment_amount', required: true },
    { key: 'seguro', label: 'Seguro', type: 'money', role: 'editable', field: 'insurance_amount' },
    { key: 'taxa', label: 'Taxa operacional', type: 'money', role: 'editable', field: 'fee_amount' },
    { key: 'parcelas_restantes', label: 'Parcelas restantes', type: 'number', role: 'editable', field: 'remaining_count', required: true },
    { key: 'observacoes', label: 'Observações', type: 'text', role: 'editable', field: 'notes' },
  ],
};

export const HOUSEHOLDS_SHEET: SheetSpec = {
  name: 'Grupos',
  table: 'households',
  importable: false,
  note: 'Somente leitura. Grupos existem para dar nome à coluna grupo e não são importados.',
  columns: [
    ID,
    { key: 'nome', label: 'Nome', type: 'text', role: 'readonly', source: 'name' },
  ],
};

export const PEOPLE_SHEET: SheetSpec = {
  name: 'Pessoas',
  table: 'profiles',
  importable: false,
  note: 'Somente leitura. Pessoas existem para dar nome às divisões e aos acertos e não são importadas.',
  columns: [
    ID,
    { key: 'nome', label: 'Nome', type: 'text', role: 'readonly', source: 'display_name' },
  ],
};

/**
 * Sheets in workbook order, which is also the import order: a sheet never
 * depends on one below it.
 */
export const WORKBOOK_V2: readonly SheetSpec[] = [
  ACCOUNTS_SHEET,
  CATEGORIES_SHEET,
  CARDS_SHEET,
  LOANS_SHEET,
  FINANCINGS_SHEET,
  FIXED_EXPENSES_SHEET,
  RECURRING_INCOMES_SHEET,
  TRANSACTIONS_SHEET,
  ALLOCATIONS_SHEET,
  STATEMENTS_SHEET,
  HOUSEHOLDS_SHEET,
  PEOPLE_SHEET,
];

export const IMPORTABLE_SHEETS = WORKBOOK_V2.filter((sheet) => sheet.importable);

/** Columns the format never carries: ownership and audit belong to the system. */
export const FORBIDDEN_FIELDS: readonly string[] = [
  'owner_user_id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
];

export function databaseField(column: SheetColumn): string {
  return column.field ?? column.source ?? column.key;
}

export function sheetByName(name: string): SheetSpec | null {
  return WORKBOOK_V2.find((sheet) => sheet.name === name) ?? null;
}
