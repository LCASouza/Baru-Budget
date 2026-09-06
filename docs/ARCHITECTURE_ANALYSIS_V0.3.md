# ANÁLISE ARQUITETURAL — BARU BUDGET v0.3

Data: 2026-09-06. Estado real verificado: v0.2 entregue (login por e-mail e senha, sessão persistente, rotas protegidas, perfil real no header, projeto hospedado com as seis migrations da v0.1 aplicadas e em sincronia com o local, deploy automático em `https://baru-budget.pages.dev`). Baseline: 37 testes Vitest, 99 asserções pgTAP, build e lint passando. Ainda mockados: dashboard, formulário de nova movimentação (categorias, contas, origens e status fixos em `transaction-form.mock.ts`), seletor de contexto. As rotas `/transactions` e `/settings` exibem placeholders. O `PeriodFilter` mantém um estado local com mês-base fixo (setembro de 2026) e não é consumido por nenhuma feature. Nenhuma tela de contas ou categorias existe; o banco não possui a tabela `transactions`.

---

## 1. Objetivo

Registrar as finanças reais: entradas, saídas e transferências entre contas próprias, com cadastro de contas (inclusive benefícios) e categorias, filtros básicos por período, tipo, categoria, conta e status, saldo por conta separado entre dinheiro e benefícios e resumo do período. Ao final, o usuário cadastra contas e categorias, lança movimentações pelo celular ou desktop, edita e exclui lançamentos, muda de mês e vê os saldos corretos.

## 2. Escopo

Incluído:

- Banco: enum `transaction_status`, tabela `transactions` (INCOME, EXPENSE, TRANSFER), validação de integridade entre tabelas, view `account_balances`, RLS owner-only, defaults de auditoria, seed local de exemplo, tipos regenerados.
- Movimentações: página com abas Todas / Entradas / Saídas, filtros (categoria, conta, status, busca por descrição), resumo do período (entradas, saídas, saldo), lista agrupada por dia, criação, edição e exclusão.
- Formulário de movimentação ligado a dados reais, com transferência entre contas, status e vencimento.
- Contas: listagem com saldo atual, totais de saldo monetário e de benefícios, criação, edição, ativação/desativação e exclusão.
- Categorias: listagem por tipo (receita/despesa), criação, edição, ativação/desativação e exclusão.
- Configurações: página com abas Contas, Categorias e Perfil (edição de `display_name`, pendência registrada na v0.2).
- Período global (mês) compartilhado entre header e páginas, com mês corrente como padrão.
- Testes pgTAP e Vitest para regras, integridade, RLS, saldos, datas, valores e filtros.
- Migration aplicada ao projeto hospedado antes do deploy do frontend.

Fora do escopo: SETTLEMENT (v0.9), `household_id` e policies de grants (v0.4), dashboard real (v0.5), cartões e origem da despesa (v0.6), parcelas (v0.7), recorrências (v0.8), intervalo de datas personalizado e filtros por pessoa/grupo (v0.5), cores e ícones de contas e categorias na interface (sem consumidor até os gráficos da v0.5), anexos, importação/exportação.

## 3. Decisões

### 3.1 Tabela `transactions`

```sql
create type public.transaction_status as enum ('PENDING', 'PAID', 'CANCELLED');

create table public.transactions (
  id                     uuid primary key default gen_random_uuid(),
  owner_user_id          uuid not null references public.profiles (id) on delete cascade,
  kind                   public.transaction_kind not null,
  description            text not null,
  amount                 numeric(14, 2) not null,
  date                   date not null,
  due_date               date,
  status                 public.transaction_status not null default 'PAID',
  category_id            uuid references public.categories (id) on delete restrict,
  account_id             uuid not null references public.accounts (id) on delete restrict,
  destination_account_id uuid references public.accounts (id) on delete restrict,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid not null default auth.uid() references public.profiles (id),
  updated_by             uuid not null default auth.uid() references public.profiles (id),
  constraint transactions_description_length check (char_length(description) between 1 and 120),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint transactions_kind_supported check (kind in ('INCOME', 'EXPENSE', 'TRANSFER')),
  constraint transactions_shape check (
    (kind = 'TRANSFER'
      and category_id is null
      and destination_account_id is not null
      and destination_account_id <> account_id)
    or
    (kind <> 'TRANSFER'
      and category_id is not null
      and destination_account_id is null)
  )
);

create index transactions_owner_date_idx on public.transactions (owner_user_id, date desc);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_destination_account_idx on public.transactions (destination_account_id)
  where destination_account_id is not null;
```

- `amount` é sempre positivo; a direção vem de `kind`. INCOME credita `account_id`; EXPENSE debita `account_id`; TRANSFER debita `account_id` e credita `destination_account_id`.
- `date` é a data financeira do lançamento (competência); `due_date` é o vencimento opcional, relevante para PENDING. Ambas são `date`, sem timezone.
- `category_id` é obrigatório em INCOME e EXPENSE e nulo em TRANSFER (transferência entre contas próprias não é receita nem despesa).
- `kind_supported` bloqueia SETTLEMENT até a v0.9, que substitui essa constraint e a `transactions_shape` ao introduzir acertos. O enum permanece o vocabulário oficial.
- `account_id` é obrigatório nesta versão. A v0.6 o torna opcional para compras no cartão (`credit_card_id`), com constraint de exatamente uma origem. `household_id` entra na v0.4 como coluna nula, junto com as policies de grupo. Colunas de origem (`credit_card_id`, `fixed_expense_id`, `loan_id`, `financing_id`) entram nas versões que criam cada tabela.
- Exclusão de conta ou categoria referenciada é bloqueada (`on delete restrict`). A interface oferece desativação (`active = false`) como caminho normal; a exclusão só funciona para registros sem uso.
- `created_by`/`updated_by` passam a ter `default auth.uid()`, também em `categories` e `accounts` (previsto na análise da v0.1 e não aplicado). Os triggers de auditoria continuam sobrescrevendo com o usuário autenticado; o efeito prático é que os tipos `Insert` gerados deixam de exigir esses campos. `owner_user_id` permanece explícito, porque a v0.4 permite que um usuário MANAGE crie lançamentos de outro proprietário.

### 3.2 Status e vencimento

- Valores persistidos: PENDING, PAID, CANCELLED. Padrão PAID (o caso mais comum é registrar algo já pago ou recebido).
- OVERDUE não é persistido. É um estado derivado: `status = PENDING and coalesce(due_date, date) < current_date`. Isso evita job agendado e garante que o estado nunca fique desatualizado. A interface exibe "Vencido" e o filtro de status oferece a opção; a v0.5 usa a mesma regra para "Próximos vencimentos".
- CANCELLED preserva o histórico sem afetar saldo nem resumo.

### 3.3 Integridade entre tabelas

Chaves estrangeiras são verificadas fora do RLS, então um `category_id` ou `account_id` de outro usuário seria aceito se o UUID fosse conhecido. A função de trigger `public.validate_transaction_references()` (`before insert or update`, invocador, `search_path = ''`) garante:

- `category_id`, quando presente, pertence a `owner_user_id` e tem `kind` igual ao da movimentação (INCOME ↔ INCOME, EXPENSE ↔ EXPENSE);
- `account_id` e `destination_account_id` pertencem a `owner_user_id`.

A função consulta `categories` e `accounts` sob o RLS do chamador: registros invisíveis são tratados como inexistentes e a operação falha fechada. Na v0.4, quando um usuário MANAGE puder ver as contas do proprietário, a verificação continua correta porque compara `owner_user_id` explicitamente.

### 3.4 Saldos

```sql
create view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.owner_user_id,
  a.opening_balance,
  a.opening_balance + coalesce(m.movement, 0) as current_balance
from public.accounts a
left join (
  select account_id, sum(delta) as movement
  from (
    select account_id, case when kind = 'INCOME' then amount else -amount end as delta
    from public.transactions where status = 'PAID'
    union all
    select destination_account_id, amount
    from public.transactions where status = 'PAID' and kind = 'TRANSFER'
  ) as movements
  group by account_id
) as m on m.account_id = a.id;
```

- Saldo atual = `opening_balance` + movimentações PAID. PENDING ainda não saiu nem entrou na conta; CANCELLED nunca conta. Nenhum saldo é armazenado.
- `security_invoker = true` faz a view respeitar o RLS de `accounts` e `transactions`; cada usuário vê apenas os próprios saldos, e `anon` não vê nada. O teste transversal de RLS passa a exigir `security_invoker` em toda view do schema `public`.
- Saldo monetário = soma das contas ativas com `type` diferente de BENEFIT; saldo de benefícios = contas ativas BENEFIT. A separação é feita por função pura no Angular a partir da view, porque a mesma regra alimenta os cards da v0.5.
- Resumo do período (página de movimentações): entradas = soma de INCOME, saídas = soma de EXPENSE, saldo = entradas − saídas, considerando PAID e PENDING (competência do mês) e ignorando CANCELLED e TRANSFER. O resumo é competência; o saldo de conta é caixa. Os dois conceitos ficam documentados nos rótulos da interface.

### 3.5 RLS

Policies owner-only em `transactions`, iguais às de `accounts` e `categories`: `select`, `insert`, `update`, `delete` para `authenticated` com `(select auth.uid()) = owner_user_id` (`with check` em insert e update, impedindo transferência de propriedade). Nenhuma policy para `anon`. A v0.4 substitui essas policies pelas funções `can_view`/`can_manage`, como já previsto.

### 3.6 Migrations e seed

| Arquivo | Conteúdo |
|---|---|
| `20260906..._audit_defaults.sql` | `default auth.uid()` em `created_by`/`updated_by` de `categories` e `accounts` |
| `20260906..._transactions.sql` | enum `transaction_status`, tabela, índices, RLS, policies, triggers de auditoria, `validate_transaction_references()` e trigger |
| `20260906..._account_balances.sql` | view `account_balances` com `security_invoker` |

- `database.types.ts` regenerado no mesmo commit; a view aparece em `Views` e é consumida como `Tables<'account_balances'>`.
- `supabase/seed.sql` passa a criar, para o usuário de desenvolvimento local, três contas (Conta corrente, Dinheiro, Vale alimentação) e um conjunto pequeno de movimentações no mês corrente e no anterior, com datas relativas a `current_date`. Somente local; `db push` não executa seed.
- Ordem de entrega: `npx supabase db push` no projeto hospedado antes do push para `main`, para que o frontend publicado nunca aponte para um schema sem `transactions`.

### 3.7 Período global

- `core/period/period.model.ts`: funções puras `currentMonth(now)`, `shiftMonth(period, delta)`, `monthRange(period)` (primeiro e último dia como `yyyy-MM-dd`) e `monthLabel(period)` em pt-BR.
- `core/period/period.service.ts`: signal `month` iniciado no mês corrente, `range` e `label` computados, `previous()`, `next()`, `reset()`.
- `PeriodFilter` passa a ler e escrever no serviço, deixando de ter estado próprio e mês-base fixo. O header (desktop) e as páginas (mobile) manipulam o mesmo período. O dashboard continua ignorando o período até a v0.5.

### 3.8 Estrutura Angular

```text
src/app/
├── core/
│   ├── finance/
│   │   └── transaction-status.ts        NOVO: TransactionStatus, rótulos, DisplayStatus com OVERDUE
│   ├── period/                          NOVO
│   │   ├── period.model.ts
│   │   └── period.service.ts
│   └── profile/profile.repository.ts    + updateDisplayName
├── shared/
│   ├── dates/iso-date.ts                NOVO: toIsoDate, parseIsoDate, todayIso (sem deslocamento UTC)
│   ├── money/money.ts                   NOVO: parseAmountInput, formatAmountInput, sumAmounts (centavos)
│   ├── text/normalize.ts                NOVO: busca sem acento/caixa
│   └── components/
│       ├── confirm-dialog/              NOVO: confirmação de exclusão
│       ├── period-filter/               ligado ao PeriodService
│       └── empty-state/                 NOVO: ícone, título, texto e ação opcional
└── features/
    ├── transactions/
    │   ├── transaction.model.ts         Transaction, TransactionInput, displayStatus, TransactionView
    │   ├── transaction.repository.ts    listByDateRange, create, update, remove
    │   ├── transaction-summary.ts       summarizeTransactions, filterTransactions (puras)
    │   ├── transactions.store.ts        filtros, resource por período, views, resumo, mutações
    │   ├── transactions-page/           abas, filtros, cards de resumo, lista por dia, estados vazios
    │   └── transaction-form-dialog/     criação e edição, transferência, exclusão
    ├── accounts/
    │   ├── account.model.ts             Account, AccountBalance, AccountInput, splitBalances
    │   ├── account.repository.ts
    │   ├── accounts.store.ts
    │   ├── accounts-page/
    │   └── account-form-dialog/
    ├── categories/
    │   ├── category.model.ts
    │   ├── category.repository.ts
    │   ├── categories.store.ts
    │   ├── categories-page/
    │   └── category-form-dialog/
    └── settings/
        ├── settings-page/               abas Contas | Categorias | Perfil (mat-tab-nav-bar + rotas filhas)
        └── profile-page/                edição de display_name
```

- `transaction-form.mock.ts` é removido. `dashboard.mock.ts` e `shell.mock.ts` (contextos) permanecem até a v0.5 e a v0.4.
- Stores são serviços `providedIn: 'root'` com signals e `resource()`, no padrão de `CurrentProfileService`: parâmetros derivados do usuário autenticado (limpam no logout) e, para movimentações, do período. Não há biblioteca de estado.
- Repositories são o único ponto com `supabase.from(...)`. Movimentações são carregadas sem embedding: nomes de categoria e conta são resolvidos no cliente pelos mapas `byId` dos stores de categorias e contas, o que evita a ambiguidade das duas FKs para `accounts` e mantém os tipos gerados como única fonte.

### 3.9 Página de movimentações

- Abas Todas / Entradas / Saídas, refletidas no query param `kind` (URL compartilhável e botão voltar funcionando). Transferências aparecem em Todas com ícone próprio.
- Filtros: categoria (do tipo selecionado), conta, status (Todos, Pendente, Pago, Vencido, Cancelado) e busca por descrição. No mobile os filtros ficam recolhidos atrás de um botão "Filtrar" com contador de filtros ativos; no desktop, em linha acima da lista.
- Carregamento: o repository busca o mês do período global (`date between start and end`, ordenado por `date desc, created_at desc`). Abas, filtros e busca são aplicados no cliente sobre o mês carregado por função pura, o que torna a troca de aba instantânea e mantém o repository simples. Limite explícito de 1000 linhas por mês (limite do PostgREST); registrado como limitação conhecida.
- Resumo do período em três `SummaryCard`: Entradas, Saídas e Saldo do período (com sinal), calculados sobre a lista filtrada.
- Lista agrupada por dia, linhas com ícone por tipo, descrição, categoria e conta, chip de status quando não for PAID, valor com sinal e cor. A mesma lista serve desktop e mobile (sem tabela larga). Toque/clique abre o formulário em modo de edição.
- Estados vazios distintos: sem contas cadastradas (ação "Cadastrar conta" para `/settings/accounts`), sem movimentações no mês (ação "Nova movimentação"), nenhum resultado para os filtros (ação "Limpar filtros").
- Erro de carregamento exibe mensagem com ação "Tentar novamente".

### 3.10 Formulário de movimentação

- Aberto pelo header, pelo FAB mobile e pela lista (edição). Recebe opcionalmente a movimentação por `MAT_DIALOG_DATA` e devolve `saved`, `deleted` ou nada.
- Tipo: Entrada, Saída, Transferência. Ao mudar o tipo, a categoria é limpa.
- Campos: descrição, valor (texto com `inputmode="decimal"`, aceita `1.234,56` e `1234,56`, convertido por `parseAmountInput`), data (datepicker, padrão hoje), categoria (oculta em Transferência), conta ("De" e "Para" em Transferência, contas ativas apenas), status (Pendente, Pago, Cancelado), vencimento (exibido quando Pendente), observações.
- Validação no cliente espelhando as constraints: descrição obrigatória, valor > 0, data obrigatória, categoria obrigatória fora de Transferência, conta obrigatória, conta de destino obrigatória e diferente da origem em Transferência.
- Os chips de "Tipo/origem" do protótipo (À vista, Cartão, Gasto fixo, Empréstimo, Financiamento) saem do formulário: não existe origem persistível antes da v0.6. Voltam quando `credit_card_id` existir.
- Edição mostra "Excluir" com diálogo de confirmação. Erros de gravação aparecem em snackbar com mensagem em português; erros conhecidos (`23505` nome duplicado, `23503` registro em uso) recebem texto específico.
- Sem contas ativas cadastradas, o formulário exibe orientação e desabilita o salvamento.

### 3.11 Contas e categorias

- Rota `/settings` deixa de ser placeholder e recebe `SettingsPage` com abas por rota: `/settings/accounts` (padrão), `/settings/categories`, `/settings/profile`. O título do header permanece "Configurações".
- Contas: cards com nome, tipo, instituição, saldo atual (da view) e marcação "Inativa". Cabeçalho com dois cards: Saldo monetário e Benefícios (contas ativas). Ações: editar, desativar/ativar, excluir (com confirmação; falha `23503` orienta a desativar). Formulário: nome, tipo, instituição, saldo inicial. Contas inativas ficam ocultas nos seletores do formulário de movimentação, mas continuam nos filtros e no histórico.
- Categorias: duas seções (Receitas, Despesas) com nome e marcação "Inativa". Mesmas ações. Formulário: tipo (bloqueado na edição, porque mudar o tipo invalidaria movimentações existentes) e nome. Categorias inativas ficam fora do formulário de movimentação e permanecem nos filtros.
- Cor e ícone continuam no banco e fora da interface até a v0.5.

### 3.12 Perfil

- `/settings/profile`: formulário com `display_name` (1 a 80 caracteres) usando a policy `profiles_update_own` existente. `ProfileRepository.updateDisplayName` e recarga de `CurrentProfileService` após salvar. E-mail exibido somente leitura; troca de senha continua com o administrador (v0.13).

### 3.13 Datas e valores

- Colunas `date` trafegam como `yyyy-MM-dd`. `toIsoDate` monta a string a partir de ano, mês e dia locais (nunca `toISOString`, que desloca para UTC e muda o dia à noite no Brasil); `parseIsoDate` cria `Date` à meia-noite local para o datepicker.
- Valores trafegam como `number` com duas casas. Somas no cliente usam centavos inteiros (`sumAmounts`) para evitar erro de ponto flutuante. Formatação de exibição permanece com `CurrencyPipe` (`R$ 1.234,56`).

### 3.14 Rotas

```text
/transactions                 TransactionsPage (query param kind=INCOME|EXPENSE)
/settings                     SettingsPage
  ├── accounts                AccountsPage (padrão)
  ├── categories              CategoriesPage
  └── profile                 ProfilePage
```

Todas dentro do `Shell` protegido por `authGuard`, carregadas sob demanda. Placeholders das demais áreas permanecem.

### 3.15 Versão da aplicação

`package.json` e `appVersion` passam a `0.3.0` na entrega (permanecem em `0.1.0` desde a v0.1; o rodapé da sidebar exibe esse valor).

## 4. Testes

pgTAP (`supabase/tests/`):

- `schema.test.sql` (estendido): enum `transaction_status`, tabela e colunas, constraints, índices, triggers, função de validação, view, defaults de auditoria.
- `rls_enabled.test.sql` (estendido): toda view do schema `public` tem `security_invoker = true`.
- `transactions.test.sql` (novo): proprietário insere, lê, edita e exclui; auditoria preenchida; `amount <= 0`, descrição vazia, SETTLEMENT, TRANSFER sem destino, TRANSFER com destino igual à origem, TRANSFER com categoria, INCOME sem categoria e INCOME com categoria de despesa são rejeitados; categoria e contas de outro usuário são rejeitadas; troca de `owner_user_id` é rejeitada; outro usuário não lê, não altera e não exclui; `anon` não lê; excluir conta ou categoria em uso falha com `23503`; desativar conta em uso funciona.
- `account_balances.test.sql` (novo): saldo = inicial + entradas pagas − saídas pagas; transferência debita a origem e credita o destino; PENDING e CANCELLED não afetam; conta sem movimentação retorna o saldo inicial; outro usuário vê apenas os próprios saldos; `anon` não vê nada.

Vitest:

- `period.model`: mês corrente, deslocamento com virada de ano, intervalo de fevereiro em ano bissexto, rótulo pt-BR.
- `iso-date`: conversão ida e volta sem deslocamento de dia, inclusive às 23h locais.
- `money`: `parseAmountInput` com `1.234,56`, `1234,56`, `12`, vazio e texto inválido; `formatAmountInput`; `sumAmounts` com `0.1 + 0.2`.
- `transaction.model` e `transaction-summary`: `displayStatus` (pendente vencido, pendente sem vencimento usando `date`, pago, cancelado); resumo ignora TRANSFER e CANCELLED e inclui PENDING; filtro por aba, categoria, conta, status derivado e busca sem acento.
- `account.model`: `splitBalances` separa BENEFIT das demais e ignora contas inativas.
- `PeriodService` e `PeriodFilter`: navegação altera o intervalo compartilhado; rótulo derivado do mês corrente.
- `TransactionsStore`, `AccountsStore`, `CategoriesStore` com repositories substituídos por dublês: carregam pelo usuário e período, limpam no logout, recarregam após criar/editar/excluir, expõem erro de carregamento.
- `TransactionFormDialog`: troca de tipo limpa a categoria; Transferência oculta categoria e exige destino diferente; formulário inválido não chama o store; edição pré-preenche e devolve `saved`; sem contas o salvamento fica desabilitado.
- `AccountFormDialog` e `CategoryFormDialog`: validação e chamada ao store.
- Specs existentes ajustadas onde o `PeriodFilter` deixa de ter mês-base fixo.

Sem testes de HTML trivial.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Referenciar categoria ou conta de outro usuário por UUID | Trigger `validate_transaction_references` com verificação de `owner_user_id`; teste pgTAP |
| Categoria de despesa em uma entrada (ou vice-versa) | Mesma trigger compara `kind`; teste pgTAP |
| Uso prematuro de SETTLEMENT sem as regras da v0.9 | `transactions_kind_supported` |
| Transferência inconsistente (sem destino, mesmo destino, com categoria) | `transactions_shape` |
| View expondo saldos de outros usuários | `security_invoker = true`; teste transversal exige a opção em toda view |
| Valor negativo ou zero invertendo a direção | `transactions_amount_positive` |
| Transferência de propriedade por update | `with check` na policy; teste pgTAP |
| Exclusão de conta ou categoria apagando histórico | `on delete restrict`; interface orienta desativação |
| Filtros apenas no cliente | São conveniência de exibição; o RLS limita os dados devolvidos |
| Mês com mais de 1000 lançamentos truncado pelo PostgREST | Limite explícito e ordenação determinística; registrado como limitação; paginação quando houver necessidade real |
| Dia da movimentação alterado por conversão UTC | Helpers de data locais com testes |
| `created_by` forjado | Triggers de auditoria da v0.1 continuam sobrescrevendo com `auth.uid()` |
| Logs com dados financeiros | Nenhum log de valores ou descrições; apenas mensagens técnicas de erro |

## 6. Dependências

Nenhuma nova. Angular Material já fornece abas, chips, datepicker, selects, diálogos e snackbar. Sem biblioteca de datas, moeda ou estado.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** enum e tabela `transactions` com constraints, trigger de integridade, RLS e índices; view `account_balances`; repositories, stores e páginas de movimentações, contas e categorias; formulário real com transferência; período global; helpers de data e valor; estados vazios; testes pgTAP e Vitest; `db push` antes do deploy; documentação da versão.

**PREPARAR AGORA:** `default auth.uid()` em `created_by`/`updated_by`; `DisplayStatus` com OVERDUE derivado (reutilizado em "Próximos vencimentos" na v0.5); `splitBalances` e `summarizeTransactions` como funções puras (reutilizadas no dashboard da v0.5); `ConfirmDialog` e `EmptyState` compartilhados; seed local de exemplo; `owner_user_id` explícito no repository (v0.4 troca pelo contexto ativo); versão `0.3.0`.

**FAZER DEPOIS:** `household_id` e policies `can_view`/`can_manage` (v0.4); dashboard real, intervalo personalizado, filtros por pessoa e grupo, cores de contas e categorias nos gráficos (v0.5); origem da despesa e `credit_card_id` (v0.6); SETTLEMENT (v0.9); paginação de movimentações quando houver volume real; troca de senha e recuperação (v0.13); CI (v1.0).

**NÃO NECESSÁRIO:** status OVERDUE persistido com job agendado; saldo armazenado em `accounts`; embedding PostgREST com hints de FK; tabela em `mat-table` para desktop; soft delete de movimentações; Edge Functions; biblioteca de estado.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push` aplica as três migrations ao projeto hospedado (vínculo já existente).
3. Verificação no hospedado: `GET /rest/v1/transactions` e `GET /rest/v1/account_balances` com a chave publicável retornam lista vazia.
4. Push para `main`; Cloudflare Pages publica o frontend.
5. Validação no celular: cadastrar conta, lançar entrada, saída e transferência, mudar de mês, editar e excluir.

Nenhum passo exige ação do administrador além da aprovação desta análise.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, todas reversíveis por migration ou ajuste de interface:

1. OVERDUE derivado de `status` e `due_date`, não persistido.
2. Saldo de conta considera apenas PAID; resumo do período considera PAID e PENDING; CANCELLED nunca conta; TRANSFER não entra no resumo.
3. Categoria obrigatória em INCOME e EXPENSE e proibida em TRANSFER.
4. `account_id` obrigatório até a v0.6; `household_id` só na v0.4.
5. Contas, categorias e perfil administrados em Configurações, com abas por rota.
6. Período global mensal como único filtro de data; demais filtros aplicados no cliente sobre o mês carregado.
7. Chips de origem removidos do formulário até a v0.6.
8. Dashboard permanece com dados de exemplo até a v0.5.
9. Cor e ícone de contas e categorias sem interface até a v0.5.
10. `default auth.uid()` adicionado às colunas de auditoria de `categories` e `accounts`.

A arquitetura da v0.3 do Baru Budget está pronta para implementação após sua aprovação.
