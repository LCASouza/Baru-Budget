# ANÁLISE ARQUITETURAL — BARU BUDGET v0.5

Data: 2026-09-06. Estado real verificado: v0.4 entregue (grupos, concessões VIEW/MANAGE, contexto financeiro real no header com `FinancialContextService`, stores de contas, categorias e movimentações por contexto e período). O dashboard continua inteiramente mockado (`dashboard.mock.ts`): seis cards (Receitas, Despesas, Saldo, Benefícios, A receber, A pagar), gráfico Receitas × Despesas de seis meses com escala fixa de 2 mil por marca, Gastos por categoria, Próximos vencimentos, Transações recentes e Acertos. O dashboard ignora o período e o contexto. `TransactionsStore` já carrega o mês do contexto ativo e resolve nomes de categoria, conta e membro; `AccountsStore` já calcula saldo monetário e de benefícios. Baseline: 133 testes Vitest, 357 asserções pgTAP.

---

## 1. Objetivo

Substituir o dashboard de exemplo por um dashboard real que responde ao período e ao contexto selecionados no header: cards de resumo, evolução de receitas e despesas nos últimos meses, despesas por categoria, despesas por pessoa em grupos, pendências do período e movimentações recentes. Ao final, a página inicial reflete os dados reais de "Minhas finanças", de cada grupo e de cada finança compartilhada, no mês escolhido.

## 2. Escopo

Incluído:

- Banco: view `monthly_transaction_totals` (`security_invoker`) com totais mensais de receitas e despesas por dono e grupo.
- Cards de resumo por contexto: Receitas, Despesas, Saldo do período, Pendentes; Saldo monetário e Benefícios nos contextos pessoal e compartilhado.
- Gráfico Receitas × Despesas dos últimos seis meses, terminando no mês selecionado, com escala adaptativa.
- Despesas por categoria no período; em grupo, também Despesas por pessoa.
- Pendências do período (movimentações PENDING, vencidas primeiro) e Movimentações recentes com atalho para a página completa.
- Estados vazios e de carregamento; dashboard reage ao período (header/mobile) e ao contexto.
- Remoção dos mocks e do componente de acertos (retorna na v0.9 com dados reais).
- Testes pgTAP para a view e Vitest para os cálculos puros, escala do gráfico e store.
- Migration aplicada ao projeto hospedado antes do deploy.

Fora do escopo: A receber e A pagar entre pessoas (v0.9), cartões e faturas (v0.6), parcelas futuras (v0.7), gastos fixos (v0.8), empréstimos e financiamentos (v0.10, v0.11), evolução do saldo e receitas por origem (sem necessidade demonstrada), intervalo de datas personalizado e filtros por pessoa dentro do dashboard (o contexto já seleciona a pessoa ou o grupo), exportação.

## 3. Decisões

### 3.1 Fontes de dados

Duas fontes, sem duplicar consultas:

- **Mês selecionado:** o dashboard reutiliza `TransactionsStore.views()` (lista completa do mês no contexto ativo, sem os filtros da página de movimentações). Dela saem cards, categoria, pessoa, pendências e recentes. Navegar entre Dashboard e Movimentações não repete a consulta.
- **Seis meses:** view agregada no banco, consultada por dono ou por grupo para o intervalo de seis meses.

```sql
create view public.monthly_transaction_totals
with (security_invoker = true) as
select
  owner_user_id,
  household_id,
  (date_trunc('month', date))::date as month,
  kind,
  sum(amount) as total,
  count(*)    as transaction_count
from public.transactions
where status <> 'CANCELLED'
  and kind in ('INCOME', 'EXPENSE')
group by owner_user_id, household_id, date_trunc('month', date), kind;
```

- `security_invoker` aplica o RLS de `transactions` linha a linha antes da agregação: quem tem VIEW soma os lançamentos do dono; membro de grupo soma apenas os lançamentos marcados com o grupo; ninguém obtém totais de dados que não pode ler.
- Contexto pessoal ou compartilhado: `owner_user_id = dono`, somando no cliente as linhas de todos os `household_id` (um lançamento meu marcado com o grupo continua sendo despesa minha). Contexto de grupo: `household_id = grupo`, somando as linhas de todos os membros.
- Competência: PAID e PENDING contam; CANCELLED e TRANSFER não, coerente com o resumo da página de movimentações.

### 3.2 Cálculos puros (`features/dashboard/dashboard-summary.ts`)

| Função | Entrada | Saída |
|---|---|---|
| `summarizeDashboard(views)` | movimentações do mês | receitas, despesas, saldo, pendentes (soma de EXPENSE com status PENDING), contagens |
| `spendingByCategory(views)` | movimentações do mês | despesas por nome de categoria, ordenadas, "Sem categoria" para nomes não visíveis |
| `spendingByOwner(views)` | movimentações do mês | despesas por membro (`ownerName`), para contexto de grupo |
| `pendingByDueDate(views, today)` | movimentações do mês | PENDING ordenadas por `coalesce(due_date, date)`, vencidas primeiro, com `DisplayStatus` |
| `recentTransactions(views, limit)` | movimentações do mês | últimas por data e criação |
| `buildMonthlySeries(rows, period, months)` | linhas da view, mês final, quantidade | série contínua com meses sem dados zerados, rótulos `MMM` em pt-BR |
| `niceTickStep(maxValue, targetTicks)` | maior valor | passo da escala em 1, 2 ou 5 × 10ⁿ para cerca de quatro marcas |

Todas sem dependência de Angular, somando em centavos (`sumAmounts`).

### 3.3 Store

`DashboardStore` (`providedIn: 'root'`):

- `resource()` para a view, com parâmetros derivados de `FinancialContextService.dataOwnerId()`/`householdId()` e de `PeriodService.month()` (intervalo de seis meses terminando no mês selecionado). Recarrega ao trocar contexto ou mês e limpa no logout.
- `computed` para cards, categoria, pessoa, pendências e recentes a partir de `TransactionsStore.views()`, `AccountsStore.totals()` e do contexto.
- Estado de carregamento combinado (`TransactionsStore.isLoading` ou série mensal) e erro com "Tentar novamente" recarregando ambos.

### 3.4 Cards por contexto

| Card | Pessoal / compartilhado | Grupo | Origem |
|---|---|---|---|
| Receitas | sim | sim | `summarizeDashboard` |
| Despesas | sim | sim | `summarizeDashboard` |
| Saldo do período | sim | sim | receitas − despesas |
| Pendentes | sim | sim | despesas PENDING do mês; dica com quantidade e vencidas |
| Saldo monetário | sim | não | `AccountsStore.totals().money` (contas do dono) |
| Benefícios | sim | não | `AccountsStore.totals().benefit` |

Saldo monetário e Benefícios são caixa (contas, PAID); os demais são competência do mês. Em grupo não há contas, logo não há saldo de caixa a exibir. "A receber" e "A pagar" saem até a v0.9.

### 3.5 Gráficos

- **Receitas × Despesas (seis meses):** `IncomeExpenseChart` existente, alimentado por `buildMonthlySeries`. A escala fixa de 2 mil é substituída por `niceTickStep`, com rótulos "500", "2 mil", "10 mil". Meses sem lançamentos aparecem zerados para manter o eixo contínuo. Tooltip por barra permanece.
- **Despesas por categoria:** `CategoryChart` existente, generalizado com entradas `title` e `subtitle`, alimentado por `spendingByCategory`. Mostra até oito categorias e agrupa o restante em "Outras".
- **Despesas por pessoa (grupo):** mesmo `CategoryChart` com `spendingByOwner`. Exibido apenas em contexto de grupo.
- Sem gráfico de evolução do saldo nem de receitas por origem nesta versão: não há necessidade demonstrada e o espaço já está ocupado por informação útil.

### 3.6 Listas

- **Pendências do período:** `UpcomingPayments` existente, renomeado para `PendingPayments`, com dados de `pendingByDueDate`; vencidas destacadas com o rótulo do tipo (`transactionStatusLabel`); clique abre o formulário (edição ou somente leitura conforme permissão). Título "Pendências do período" e subtítulo com a quantidade.
- **Movimentações recentes:** `TransactionList` existente, alimentado por `TransactionView` (últimas cinco); em grupo mostra quem registrou; "Ver todas" leva a `/transactions`.
- `SettlementSummary` e `dashboard.mock.ts` removidos; `SummaryTone` mantém `receivable`/`payable` para a v0.9.

### 3.7 Estados

- Carregando: barra de progresso no topo, cards com valores zerados só depois do primeiro carregamento.
- Sem contas no contexto pessoal: card único de orientação com atalho para Configurações (mesmo padrão da página de movimentações).
- Mês sem movimentações: cards em zero, gráficos com "Sem movimentações no período", listas com estado vazio e atalho "Nova movimentação" quando o contexto permite.
- Erro: mensagem com "Tentar novamente".

### 3.8 Estrutura Angular

```text
src/app/features/dashboard/
├── dashboard.models.ts          MonthlyTotals, NamedAmount (substitui CategorySpending), PendingItem
├── dashboard-summary.ts         NOVO: funções puras da seção 3.2
├── dashboard.repository.ts      NOVO: listMonthlyTotals(scope, range)
├── dashboard.store.ts           NOVO
├── dashboard-page.*             reescrito com dados reais e estados
└── components/
    ├── income-expense-chart/    escala adaptativa (niceTickStep)
    ├── category-chart/          title/subtitle, limite de linhas com "Outras", estado vazio
    ├── pending-payments/        renomeado de upcoming-payments; recebe PendingItem
    └── transaction-list/        recebe TransactionView
```

Removidos: `dashboard.mock.ts`, `components/settlement-summary/`.

### 3.9 Migration e versão

| Arquivo | Conteúdo |
|---|---|
| `20260906..._monthly_totals.sql` | view `monthly_transaction_totals` com `security_invoker` |

`database.types.ts` regenerado. `package.json` e `appVersion` passam a `0.5.0`.

## 4. Testes

pgTAP:

- `monthly_totals.test.sql`: totais por mês e tipo; CANCELLED e TRANSFER ignorados; PENDING incluído; dono vê os próprios totais; VIEW vê os totais do dono; membro vê apenas linhas do grupo; usuário sem relação e `anon` não veem nada; `schema.test.sql` com a view e suas colunas; `rls_enabled.test.sql` já exige `security_invoker` em toda view.

Vitest:

- `dashboard-summary`: resumo (pendentes, contagens), categoria com "Outras" e "Sem categoria", pessoa, pendências ordenadas com vencidas primeiro, recentes, série mensal com meses zerados e virada de ano, `niceTickStep` para valores de 300 a 300 mil.
- `IncomeExpenseChart`: escala adaptativa (marcas para valores pequenos e grandes) além dos testes existentes.
- `DashboardStore`: parâmetros da série por contexto (dono, grupo) e período; cards por contexto (grupo sem saldo monetário e benefícios); recarrega ao mudar mês; erro exposto.
- `CategoryChart`: limite de linhas e estado vazio.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| View agregada vazando totais de outros usuários | `security_invoker`; teste pgTAP com VIEW, membro, usuário sem relação e `anon`; guarda transversal existente |
| Totais de grupo revelando saldos pessoais | Só receitas e despesas marcadas com o grupo entram; cards de caixa ocultos em grupo |
| Dados de outro contexto exibidos após trocar o seletor | Parâmetros dos `resource()` derivam do contexto; troca recarrega |
| Escala de gráfico enganosa | Escala adaptativa testada; eixo sempre começa em zero |

## 6. Dependências

Nenhuma nova. Gráficos continuam em SVG e HTML sem biblioteca.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** view mensal; funções puras; `DashboardStore`; página com cards, gráficos, pendências e recentes por contexto e período; remoção dos mocks; escala adaptativa; testes; `db push` antes do deploy.

**PREPARAR AGORA:** `NamedAmount` genérico para gráficos de barras horizontais (cartão e pessoa nas próximas versões); `SummaryTone` de a receber/a pagar mantido para a v0.9; `pendingByDueDate` reutilizável por faturas (v0.6) e gastos fixos (v0.8).

**FAZER DEPOIS:** A receber/A pagar e acertos (v0.9); cards de cartões, faturas, parcelas, gastos fixos, empréstimos e financiamentos nas versões que criam cada entidade; evolução do saldo e receitas por origem se houver demanda; intervalo personalizado (v0.13).

**NÃO NECESSÁRIO:** biblioteca de gráficos; materialização dos totais; cache no cliente além dos `resource()`; Edge Functions.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica a migration ao projeto hospedado.
3. Verificação: `GET /rest/v1/monthly_transaction_totals` com a chave publicável retorna lista vazia.
4. Push para `main`; Cloudflare Pages publica.
5. Validação em produção: dashboard no mês atual e anterior, em contexto pessoal e, quando houver, de grupo e compartilhado.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. Dashboard reutiliza a lista do mês de `TransactionsStore`; apenas a série de seis meses tem consulta própria (view).
2. Cards de competência (PAID + PENDING, sem TRANSFER e CANCELLED) e cards de caixa (PAID) convivem com rótulos distintos; em grupo só há competência.
3. "A receber", "A pagar" e Acertos saem até a v0.9.
4. Seis meses fixos no gráfico de evolução, terminando no mês selecionado.
5. Pendências limitadas ao mês selecionado, vencidas primeiro.
6. Até oito categorias no gráfico, restante em "Outras".

A arquitetura da v0.5 do Baru Budget está pronta para implementação após sua aprovação.
