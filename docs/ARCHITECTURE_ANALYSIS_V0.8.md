# ANÁLISE ARQUITETURAL — BARU BUDGET v0.8

Data: 2026-09-07. Estado real verificado: v0.7 entregue (parcelamentos gerados no banco, uma parcela por fatura ou por mês, view consolidada e página de comprometimento). `transactions` já carrega origem por conta ou cartão, competência de fatura gravada, agrupamento de parcelas e trigger `validate_transaction_references`. A rota `/fixed-expenses` ainda é um placeholder marcado para a v0.8. Baseline: 220 testes Vitest, 540 asserções pgTAP.

---

## 1. Objetivo

Cadastrar o que se repete todo mês e transformar isso em lançamentos reais: gastos fixos (aluguel, energia, internet, assinaturas) e receitas recorrentes (salário, vale alimentação, benefícios). Ao final, o usuário cadastra um gasto fixo com valor sugerido e dia de vencimento, gera as competências do mês com um clique, ajusta o valor da conta de luz daquele mês sem alterar o modelo, e vê o que ainda falta gerar.

## 2. Escopo

Incluído:

- Banco: enum `recurrence_frequency`; tabelas `fixed_expenses` e `recurring_incomes` com RLS e policies; colunas `fixed_expense_id`, `recurring_income_id` e `recurrence_month` em `transactions`; constraint de forma; índices únicos parciais que tornam a geração idempotente; função `generate_recurrences` que cria as competências que faltam.
- Geração explícita por mês, sem efeito colateral em leitura e sem agendador.
- Página Gastos Fixos com abas "Gastos fixos" e "Receitas recorrentes": lista dos modelos com valor sugerido, dia, frequência, origem e situação do mês selecionado; ação "Gerar lançamentos do mês"; criação, edição, ativação/desativação e exclusão.
- Instância mensal editável como qualquer movimentação, sem tocar no modelo.
- Movimentações: a linha de uma instância indica que veio de um modelo recorrente.
- Testes pgTAP e Vitest.
- Migrations aplicadas ao projeto hospedado antes do deploy.

Fora do escopo: geração automática por agendador; frequências semanal, quinzenal e personalizada; reajuste programado de valor; previsão de meses futuros sem gerar lançamento; divisão entre pessoas das instâncias (v0.9); empréstimos e financiamentos (v0.10 e v0.11); notificações de vencimento.

## 3. Decisões

### 3.1 Duas tabelas, como manda o Prompt Mestre

A seção 32 é explícita: receitas recorrentes não se misturam com gastos fixos. São duas tabelas com o mesmo formato geral e semânticas diferentes:

```sql
create type public.recurrence_frequency as enum ('MONTHLY', 'YEARLY');

create table public.fixed_expenses (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references public.profiles (id) on delete cascade,
  description    text not null,
  category_id    uuid not null references public.categories (id) on delete restrict,
  account_id     uuid references public.accounts (id) on delete restrict,
  credit_card_id uuid references public.credit_cards (id) on delete restrict,
  household_id   uuid references public.households (id) on delete set null,
  default_amount numeric(14,2) not null,
  due_day        integer not null,
  frequency      public.recurrence_frequency not null default 'MONTHLY',
  anchor_month   integer,          -- exigido quando a frequência é anual
  active         boolean not null default true,
  notes          text,
  created_at, updated_at, created_by, updated_by
);

create table public.recurring_incomes (
  ... mesma estrutura, sem credit_card_id, com receipt_day no lugar de due_day
);
```

- Gasto fixo tem exatamente uma origem: conta ou cartão. Assinatura no cartão é caso comum e usa a mesma regra de fatura da v0.6.
- Receita recorrente sempre cai em uma conta; não existe receita em cartão no modelo.
- `category_id` obrigatório e do tipo certo (EXPENSE para gastos, INCOME para receitas), validado por trigger contra o proprietário, como já é feito em `transactions`.
- `due_day` e `receipt_day` entre 1 e 31, ajustados ao último dia do mês na geração.
- `frequency = YEARLY` exige `anchor_month` (1 a 12): IPVA, IPTU, seguro.
- Desativar esconde o modelo da geração e das listas ativas, preservando as instâncias já criadas.

### 3.2 A instância é uma movimentação comum

Cada competência gerada é uma linha em `transactions`, exatamente como uma parcela. Consequências desejadas: a instância aparece nas movimentações, entra nas despesas ou receitas do período, respeita o RLS, pode ser editada, cancelada ou excluída, e o valor de um mês pode diferir do valor sugerido sem alterar o modelo. É assim que a seção 31 do Prompt Mestre é atendida: "permitir alterar uma competência mensal sem destruir o template original".

```sql
alter table public.transactions
  add column fixed_expense_id    uuid references public.fixed_expenses (id) on delete set null,
  add column recurring_income_id uuid references public.recurring_incomes (id) on delete set null,
  add column recurrence_month    date;

create unique index transactions_fixed_expense_month_key
  on public.transactions (fixed_expense_id, recurrence_month)
  where fixed_expense_id is not null;

create unique index transactions_recurring_income_month_key
  on public.transactions (recurring_income_id, recurrence_month)
  where recurring_income_id is not null;
```

Constraint de forma: no máximo um modelo por lançamento; quando há modelo, `recurrence_month` é obrigatório e é o primeiro dia do mês; gasto fixo só em EXPENSE e receita recorrente só em INCOME.

`on delete set null` preserva o histórico quando o modelo é excluído: os lançamentos continuam existindo como movimentações comuns. Os índices únicos parciais ignoram nulos, então nada quebra.

### 3.3 Geração explícita e idempotente

Sem agendador disponível, a geração é uma ação do usuário:

```sql
public.generate_recurrences(p_owner_user_id uuid, p_month date) returns integer
```

`language plpgsql`, direitos de invocador, `set search_path = ''`. Para cada modelo ativo do proprietário cuja frequência bate com o mês (mensal sempre; anual apenas no `anchor_month`), insere a competência que faltar e devolve quantos lançamentos criou.

- **Idempotência** vem dos índices únicos parciais: a função usa `on conflict do nothing`, então gerar duas vezes o mesmo mês não duplica nada. Uma instância cancelada continua ocupando a competência e impede recriação silenciosa.
- **Data e status.** Gasto fixo: `date` e `due_date` no dia de vencimento ajustado ao mês, status PENDING. Em cartão, `invoice_due_date` é preenchida pela trigger existente a partir da data. Receita recorrente: `date` no dia de recebimento ajustado, status PENDING.
- **Valor** é o `default_amount` do modelo; o usuário ajusta a instância quando o valor real chega.
- **Direitos de invocador** fazem o RLS decidir cada inserção: quem tem VIEW não gera, quem tem MANAGE gera para o proprietário e fica registrado em `created_by`.

Regeneração de meses passados é permitida: o usuário escolhe o mês no seletor do cabeçalho e gera. Meses futuros também, o que serve de projeção concreta.

### 3.4 Interface

- **`/fixed-expenses`** deixa de ser placeholder. Cabeçalho com o total mensal previsto de cada aba. Duas abas por rota: `/fixed-expenses/expenses` (padrão) e `/fixed-expenses/incomes`.
- Cada lista mostra descrição, categoria, origem (conta ou cartão), valor sugerido, dia, frequência, e a situação no mês selecionado: "Lançado" com o valor real da instância ou "Falta gerar". Modelos inativos aparecem marcados.
- Botão **"Gerar lançamentos do mês"** com a contagem do que falta; desabilitado quando não falta nada ou quando o contexto é somente leitura. Depois de gerar, um aviso informa quantos lançamentos foram criados.
- Formulário do modelo: descrição, categoria, origem (conta ou cartão, só em gastos), valor sugerido, dia, frequência (mensal ou anual, com mês de referência quando anual), grupo e observações.
- Clicar na situação "Lançado" abre a instância no formulário de movimentação, onde o valor daquele mês é ajustado sem tocar no modelo.
- **Movimentações:** a linha de uma instância recebe a marca "Fixo" ou "Recorrente" ao lado da descrição, como já acontece com "4/12".
- **Dashboard:** sem card novo. O card "Pendentes" já soma as instâncias pendentes do período, e um card a mais só repetiria a informação.

### 3.5 Estrutura Angular

```text
src/app/features/recurrences/            NOVO
├── recurrence.ts                        occursInMonth, competenceDate, rótulos (puras)
├── recurrence.model.ts                  FixedExpense, RecurringIncome, RecurrenceTemplate unificado para a UI, status do mês
├── recurrence.repository.ts             as duas tabelas, instâncias do mês, RPC de geração
├── recurrences.store.ts                 modelos por contexto, instâncias do mês selecionado, pendências, mutações
├── recurrences-page/                    abas por rota
├── fixed-expenses-tab/ recurring-incomes-tab/
└── recurrence-form-dialog/              um formulário para os dois tipos, parametrizado
```

O modelo unificado `RecurrenceTemplate` existe apenas na interface, para não duplicar lista, formulário e store; a persistência continua em duas tabelas, como o Prompt Mestre define.

### 3.6 Migrations e versão

| Arquivo | Conteúdo |
|---|---|
| `..._recurrences.sql` | enum, `fixed_expenses`, `recurring_incomes`, índices, RLS, policies, triggers de auditoria e de validação de referências |
| `..._recurrence_transactions.sql` | colunas em `transactions`, constraint de forma, índices únicos parciais, `generate_recurrences` |

Seed local: aluguel e internet como gastos fixos em conta, uma assinatura no cartão, salário e vale alimentação como receitas recorrentes, com as competências do mês corrente já geradas. `package.json` e `appVersion` passam a `0.8.0`.

## 4. Testes

pgTAP:

- `recurrence_templates.test.sql`: proprietário cria, edita, desativa e exclui; dia fora de 1 a 31 rejeitado; valor não positivo rejeitado; gasto fixo com conta e cartão ao mesmo tempo rejeitado; gasto fixo sem origem rejeitado; categoria de tipo errado rejeitada; categoria, conta e cartão de outro usuário rejeitados; anual sem mês de referência rejeitado; VIEW lê e não escreve; MANAGE escreve; usuário sem relação e `anon` não leem.
- `generate_recurrences.test.sql`: gera uma competência por modelo ativo; modelo inativo não gera; gerar duas vezes o mesmo mês não duplica; instância excluída é recriada; instância cancelada não é recriada; valor e dia seguem o modelo com o dia ajustado ao mês; gasto fixo em cartão recebe a fatura correta; anual gera apenas no mês de referência; VIEW não gera; MANAGE gera para o proprietário com `created_by` correto; `anon` não executa.
- `recurrence_transactions.test.sql`: constraint de forma (dois modelos, mês ausente, mês fora do primeiro dia, gasto fixo em receita); excluir o modelo mantém os lançamentos e libera a competência; editar a instância não altera o modelo.
- `schema.test.sql` e `rls_enabled.test.sql` estendidos.

Vitest:

- `recurrence`: ocorrência no mês para mensal e anual; data da competência com dia ajustado (31 em fevereiro); rótulos de frequência.
- `recurrence.model`: unificação dos dois tipos para a lista; situação do mês (Lançado, Falta gerar, Inativo); total mensal previsto.
- `RecurrencesStore`: carrega modelos e instâncias por contexto e período; conta pendências; recarrega após gerar e após mutação; limpa no logout.
- `RecurrenceFormDialog`: campos por tipo (cartão só em gastos), mês de referência só em anual, validação e chamada ao store.
- `RecurrencesPage`: contagem de pendências e ação de geração desabilitada em contexto somente leitura.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Geração ignorando RLS | Função com direitos de invocador; teste pgTAP com VIEW e MANAGE |
| Modelo apontando para categoria, conta ou cartão de outro usuário | Trigger de validação nas duas tabelas; teste pgTAP |
| Geração duplicando lançamentos | Índices únicos parciais mais `on conflict do nothing`; teste pgTAP gerando duas vezes |
| Instância recriada depois de cancelada | A linha cancelada ocupa a competência; teste pgTAP |
| Exclusão do modelo apagando histórico | `on delete set null`; teste pgTAP |
| Instância de gasto fixo caindo na fatura errada | Reaproveita a regra da v0.6 pela trigger existente; teste pgTAP |

## 6. Dependências

Nenhuma nova.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** as duas tabelas com RLS e validação; colunas e constraint em `transactions`; índices únicos; função de geração idempotente; página com abas, situação do mês e ação de gerar; formulário do modelo; marca nas movimentações; testes.

**PREPARAR AGORA:** `recurrence_month` como competência reutilizável por projeções futuras; modelo unificado na interface para receber empréstimos e financiamentos como origem de lançamento recorrente nas v0.10 e v0.11; geração por intervalo de meses (a função aceita um mês; chamar em laço cobre um intervalo quando fizer falta).

**FAZER DEPOIS:** geração automática agendada; frequências adicionais; reajuste programado; projeção de meses futuros sem lançamento; divisão entre pessoas (v0.9); notificações (fora do escopo do produto).

**NÃO NECESSÁRIO:** tabela única de recorrências; materialização em leitura; job externo; duplicar a lógica de fatura.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica as duas migrations ao projeto hospedado.
3. Verificação: `GET /rest/v1/fixed_expenses` e `GET /rest/v1/recurring_incomes` com a chave publicável retornam lista vazia; `anon` não executa `generate_recurrences`.
4. Push para `main`; Cloudflare Pages publica.
5. Validação: cadastrar um gasto fixo, gerar o mês, ajustar o valor de uma instância e conferir que o modelo não mudou; gerar o mesmo mês de novo e confirmar que nada duplica.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. Duas tabelas, como a seção 32 do Prompt Mestre determina; a unificação existe apenas na interface.
2. Geração explícita por mês, sem agendador e sem efeito colateral em leitura.
3. Idempotência por índice único parcial; instância cancelada ocupa a competência.
4. Instâncias nascem pendentes, com o valor sugerido do modelo.
5. Gasto fixo aceita conta ou cartão; receita recorrente aceita apenas conta.
6. Frequências mensal e anual; anual exige mês de referência.
7. Excluir o modelo preserva os lançamentos já gerados.
8. Sem card novo no dashboard.

A arquitetura da v0.8 do Baru Budget está pronta para implementação após sua aprovação.
