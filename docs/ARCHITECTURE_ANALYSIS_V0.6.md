# ANÁLISE ARQUITETURAL — BARU BUDGET v0.6

Data: 2026-09-06. Estado real verificado: v0.5 entregue (dashboard real por contexto e período). `transactions` possui `account_id not null`, `category_id` obrigatório fora de TRANSFER, `household_id` opcional, constraint `transactions_shape` e trigger `validate_transaction_references`. `account_balances` deriva o saldo de cada conta a partir das movimentações PAID. Enum `transaction_kind` já contém TRANSFER. A rota `/cards` é um placeholder marcado para a v0.6. Baseline: 157 testes Vitest, 374 asserções pgTAP.

---

## 1. Objetivo

Registrar compras no cartão de crédito e acompanhar faturas: cadastro de cartões com limite, fechamento e vencimento; compra vinculada ao cartão e à fatura correta; fatura com total, vencimento e situação; pagamento da fatura como transferência, sem contabilizar a despesa duas vezes. Ao final, o usuário cadastra um cartão, lança uma compra, vê em qual fatura ela caiu, e paga a fatura debitando uma conta.

## 2. Escopo

Incluído:

- Banco: tabela `credit_cards`; função imutável `invoice_due_date_for`; colunas `credit_card_id` e `invoice_due_date` em `transactions`; `account_id` passa a ser opcional; nova constraint de forma cobrindo compra no cartão e pagamento de fatura; validação de propriedade do cartão; índices; RLS e policies.
- Regra de competência da fatura explícita, com fechamento, vencimento, virada de mês, virada de ano e ajuste de dia inexistente.
- Cartões: listagem com limite, utilizado e disponível, próxima fatura; criação, edição, ativação/desativação e exclusão.
- Faturas: detalhe do cartão com faturas por vencimento, lançamentos, total, situação (Aberta, Fechada, Paga, Parcial) e ação de registrar pagamento.
- Movimentações: saída paga com conta ou com cartão; prévia da fatura no formulário; lista e filtros por cartão.
- Dashboard: card "Faturas a pagar" com as faturas não pagas que vencem no período.
- Testes pgTAP e Vitest, com a mesma tabela de casos da regra de competência nos dois lados.
- Migrations aplicadas ao projeto hospedado antes do deploy.

Fora do escopo: parcelamento (v0.7), gastos fixos e recorrências (v0.8), divisão de despesas e responsáveis por compra (v0.9), estorno de compra no cartão, faturas de cartões de terceiros, limite compartilhado entre cartões adicionais, importação de fatura, juros e rotativo.

## 3. Decisões

### 3.1 Cartões

```sql
create table public.credit_cards (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  institution   text,
  limit_amount  numeric(14,2),
  closing_day   integer not null,
  due_day       integer not null,
  color         text,
  active        boolean not null default true,
  created_at, updated_at, created_by, updated_by,
  constraint credit_cards_name_length check (char_length(name) between 1 and 60),
  constraint credit_cards_limit_positive check (limit_amount is null or limit_amount >= 0),
  constraint credit_cards_closing_day_range check (closing_day between 1 and 31),
  constraint credit_cards_due_day_range check (due_day between 1 and 31),
  constraint credit_cards_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

create unique index credit_cards_owner_name_key on public.credit_cards (owner_user_id, lower(name));
```

- Cartão é do usuário, como conta e categoria. RLS igual: leitura com `can_view(owner_user_id)`, escrita com `can_manage(owner_user_id)`.
- `limit_amount` é opcional: serve para exibir disponível, nunca bloqueia lançamento (o Baru Budget registra, não autoriza).
- Cartão não é conta: não entra em `account_balances` nem no saldo monetário. O dinheiro sai da conta quando a fatura é paga.
- Desativar esconde o cartão dos seletores e mantém o histórico. Excluir só é possível sem lançamentos (`on delete restrict`).

### 3.2 Regra de competência da fatura

Função imutável no banco, autoridade única:

```sql
public.invoice_due_date_for(purchase_date date, closing_day int, due_day int) returns date
```

Regra:

1. **Fechamento do mês da compra:** `closing = min(closing_day, último dia do mês da compra)`. Dias inexistentes são ajustados (fechamento 31 em fevereiro fecha no dia 28 ou 29).
2. **Fatura da compra:** se `dia da compra <= closing`, a compra entra na fatura que fecha nesse mês; caso contrário, na que fecha no mês seguinte. Compra feita **no** dia do fechamento entra na fatura que fecha naquele dia.
3. **Vencimento:** a partir do mês de fechamento, se `due_day > closing_day` o vencimento cai no mesmo mês do fechamento; caso contrário, no mês seguinte. O dia é ajustado ao último dia do mês quando necessário.

Exemplos verificados por teste:

| Cartão | Compra | Fecha | Vence |
|---|---|---|---|
| fecha 15, vence 25 | 10/09/2026 | 15/09/2026 | 25/09/2026 |
| fecha 15, vence 25 | 15/09/2026 | 15/09/2026 | 25/09/2026 |
| fecha 15, vence 25 | 16/09/2026 | 15/10/2026 | 25/10/2026 |
| fecha 28, vence 5 | 20/09/2026 | 28/09/2026 | 05/10/2026 |
| fecha 28, vence 5 | 29/12/2026 | 28/01/2027 | 05/02/2027 |
| fecha 31, vence 10 | 28/02/2027 | 28/02/2027 | 10/03/2027 |
| fecha 20, vence 31 | 21/04/2026 | 20/05/2026 | 31/05/2026 |
| fecha 20, vence 31 | 21/03/2026 | 20/04/2026 | 30/04/2026 |

- A fatura é identificada pelo **vencimento** (`invoice_due_date`), uma data real. O rótulo é "Fatura de \<mês do vencimento\>", que é o que o usuário paga.
- `invoice_due_date` é **gravado** na compra por trigger, não recalculado na leitura. Assim, mudar o fechamento do cartão no futuro não reorganiza faturas passadas.
- A mesma regra existe em TypeScript (`invoice.ts`) apenas para a prévia no formulário. O banco é a autoridade; os dois lados são cobertos pela mesma tabela de casos, em pgTAP e em Vitest.

### 3.3 Compra no cartão e pagamento da fatura

`transactions` ganha:

```sql
credit_card_id   uuid references public.credit_cards (id) on delete restrict,
invoice_due_date date
```

`account_id` passa a ser opcional e a constraint de forma cobre quatro casos, exatamente um por lançamento:

| Caso | kind | account_id | credit_card_id | destination_account_id | category_id | invoice_due_date |
|---|---|---|---|---|---|---|
| Receita ou despesa em conta | INCOME, EXPENSE | obrigatório | nulo | nulo | obrigatório | nulo |
| Transferência entre contas | TRANSFER | obrigatório | nulo | obrigatório e diferente | nulo | nulo |
| Compra no cartão | EXPENSE | nulo | obrigatório | nulo | obrigatório | obrigatório |
| Pagamento de fatura | TRANSFER | obrigatório | obrigatório | nulo | nulo | obrigatório |

- **Compra no cartão** é EXPENSE: entra em Despesas do período e em Gastos por categoria, como qualquer saída. Não toca em `account_balances`, porque o dinheiro ainda não saiu de conta nenhuma.
- **Pagamento de fatura** é TRANSFER: debita a conta em `account_balances` e não entra em Despesas. É exatamente a regra da seção 28 do Prompt Mestre; a prevenção de dupla contabilização é estrutural, não uma correção de relatório.
- Status da compra no cartão: PAID (efetivada) ou CANCELLED. PENDING não é oferecido, porque a pendência de um cartão é a fatura, não a compra. Faturas contam apenas compras PAID.
- Pagamento parcial é aceito: o valor do pagamento é livre e a fatura mostra pago e restante.
- `validate_transaction_references` passa a exigir que o cartão pertença ao `owner_user_id` e preenche `invoice_due_date` da compra quando o cliente não envia.

### 3.4 Faturas derivadas

Não há tabela `invoices`. Uma fatura é o conjunto de lançamentos de um cartão com o mesmo `invoice_due_date`:

```sql
create view public.credit_card_invoices
with (security_invoker = true) as
select
  t.credit_card_id,
  t.invoice_due_date,
  sum(case when t.kind = 'EXPENSE' then t.amount else 0 end) as total,
  sum(case when t.kind = 'TRANSFER' then t.amount else 0 end) as paid,
  count(*) filter (where t.kind = 'EXPENSE')                  as purchase_count
from public.transactions t
where t.credit_card_id is not null
  and t.status = 'PAID'
group by t.credit_card_id, t.invoice_due_date;
```

- `security_invoker` mantém a regra: cada usuário vê apenas as faturas que os lançamentos visíveis permitem somar.
- Situação derivada no cliente, sem estado no banco: `PAID` quando `paid >= total`; `PARTIAL` quando `0 < paid < total`; `CLOSED` quando não paga e o fechamento já passou; `OPEN` caso contrário. O fechamento é recalculado a partir do vencimento e do cartão para exibição.
- Utilizado do cartão = soma de `total - paid` das faturas não quitadas. Disponível = `limit_amount - utilizado`, exibido apenas quando há limite.

### 3.5 Interface

- **`/cards`** deixa de ser placeholder. Lista de cartões com nome, instituição, fechamento e vencimento, valor da próxima fatura, utilizado e disponível (barra quando há limite), marcação "Inativo". Ações: editar, desativar/ativar, excluir (com confirmação; `23503` orienta a desativar).
- **Detalhe do cartão** (rota `/cards/:id`): faturas por vencimento, da mais recente para a mais antiga, cada uma com total, pago, situação e lançamentos; botão "Registrar pagamento" abre o formulário de movimentação pré-preenchido como transferência da conta escolhida para aquela fatura, com o valor restante sugerido.
- **Formulário de movimentação:** para Saída, um seletor "Pagar com" entre Conta e Cartão. Com Cartão, o campo Conta some, aparece o seletor de cartão e a prévia "Entra na fatura que vence em dd/MM/yyyy". O campo Status oferece Efetivada e Cancelada. Transferência ganha destino Conta ou Fatura de cartão.
- **Movimentações:** filtro por cartão junto ao filtro de conta; a linha mostra o cartão no lugar da conta em compras no cartão.
- **Dashboard:** card "Faturas a pagar" com a soma das faturas não quitadas que vencem no período, com dica da quantidade. Aparece apenas fora de contexto de grupo (cartão é pessoal).

### 3.6 Estrutura Angular

```text
src/app/
├── core/finance/
│   └── payment-method.ts        NOVO: PaymentMethod = 'ACCOUNT' | 'CARD', rótulos
└── features/cards/              NOVO
    ├── invoice.ts               regra de competência em TypeScript, situação e rótulo (puras)
    ├── card.model.ts            CreditCard, CardInput, Invoice, InvoiceStatus, cardUsage
    ├── card.repository.ts       credit_cards e credit_card_invoices
    ├── cards.store.ts           cartões e faturas por contexto
    ├── cards-page/              lista de cartões
    ├── card-detail-page/        faturas e lançamentos do cartão
    └── card-form-dialog/        cadastro e edição
```

`TransactionsStore` ganha o filtro por cartão; `TransactionFormDialog` ganha forma de pagamento, cartão e prévia; `DashboardStore` ganha o card de faturas.

### 3.7 Migrations e versão

| Arquivo | Conteúdo |
|---|---|
| `..._credit_cards.sql` | tabela, índice único, RLS, policies, triggers de auditoria, função `invoice_due_date_for` |
| `..._card_transactions.sql` | colunas `credit_card_id` e `invoice_due_date`, `account_id` opcional, nova `transactions_shape`, `validate_transaction_references` estendida, índices |
| `..._credit_card_invoices.sql` | view `credit_card_invoices` com `security_invoker` |

Seed local: um cartão para o usuário de desenvolvimento, três compras em duas faturas e o pagamento da fatura mais antiga. `package.json` e `appVersion` passam a `0.6.0`.

## 4. Testes

pgTAP:

- `invoice_due_date.test.sql`: cada linha da tabela da seção 3.2, incluindo virada de ano e ajuste de dia inexistente; função é imutável e não executável por `anon`.
- `credit_cards.test.sql`: proprietário cria, edita, desativa e exclui; nome único por dono; dias fora de 1 a 31 rejeitados; limite negativo rejeitado; VIEW lê e não escreve; MANAGE escreve; usuário sem relação e `anon` não leem; excluir cartão com lançamentos falha com `23503`.
- `card_transactions.test.sql`: compra no cartão grava `invoice_due_date` pela regra; compra com conta e cartão ao mesmo tempo rejeitada; compra no cartão sem categoria rejeitada; compra com cartão de outro usuário rejeitada; INCOME no cartão rejeitado; pagamento de fatura exige conta e `invoice_due_date`; compra no cartão não altera `account_balances`; pagamento de fatura debita a conta; alterar o fechamento do cartão não muda a fatura de compras já gravadas.
- `credit_card_invoices.test.sql`: total, pago e contagem por fatura; cancelada não conta; pagamento parcial; membro de grupo e usuário sem relação não veem faturas alheias; `anon` não vê nada.
- `schema.test.sql` e `rls_enabled.test.sql` estendidos.

Vitest:

- `invoice`: mesma tabela de casos da regra, situação da fatura (Aberta, Fechada, Parcial, Paga) e rótulo do mês.
- `card.model`: utilizado, disponível e próxima fatura.
- `CardsStore`: carrega por contexto, recarrega após mutação, limpa no logout.
- `TransactionFormDialog`: alternar Conta e Cartão limpa o campo oposto; prévia da fatura; status restrito em compra no cartão; pagamento de fatura pré-preenchido.
- `DashboardStore`: card de faturas a pagar apenas fora de grupo.
- Páginas de cartão e detalhe: situação exibida e ação de pagamento.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Compra vinculada a cartão de outro usuário | `validate_transaction_references` compara `owner_user_id`; teste pgTAP |
| Fatura de outro usuário visível pela view | `security_invoker`; teste pgTAP |
| Dupla contabilização da despesa do cartão | Compra é EXPENSE sem conta; pagamento é TRANSFER; constraint de forma garante os quatro casos; teste pgTAP compara Despesas e saldo |
| Lançamento sem origem ou com duas origens | `transactions_shape` reescrita com exatamente uma origem |
| Fatura mudando ao editar o cartão | `invoice_due_date` gravado na compra; teste pgTAP |
| Divergência entre a regra em SQL e em TypeScript | Banco é autoridade e grava o valor; a versão TypeScript é só prévia; mesma tabela de casos nos dois testes |
| Cartão excluído apagando histórico | `on delete restrict`; interface orienta a desativar |

## 6. Dependências

Nenhuma nova.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** tabela de cartões; função e trigger da competência; colunas e constraint em `transactions`; view de faturas; páginas de cartões e detalhe; forma de pagamento no formulário; filtro por cartão; card de faturas no dashboard; testes; `db push` antes do deploy.

**PREPARAR AGORA:** `invoice_due_date` como chave da fatura (as parcelas da v0.7 gravarão uma parcela por fatura); `PaymentMethod` no formulário (recebe Gasto fixo e Empréstimo nas próximas versões); situação da fatura como função pura reutilizável.

**FAZER DEPOIS:** parcelamento (v0.7); recorrências (v0.8); responsáveis e divisão de compras no cartão (v0.9); estorno de compra; rotativo e juros de fatura; fechamento automático de fatura sem lançamentos.

**NÃO NECESSÁRIO:** tabela `invoices` materializada; cartão como conta; bloqueio de compra por limite; integração bancária.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica as três migrations ao projeto hospedado.
3. Verificação: `GET /rest/v1/credit_cards` e `GET /rest/v1/credit_card_invoices` com a chave publicável retornam lista vazia.
4. Push para `main`; Cloudflare Pages publica.
5. Validação em produção: cadastrar cartão, lançar compra antes e depois do fechamento, conferir as faturas, registrar o pagamento e verificar que o saldo da conta caiu sem alterar as despesas do período.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. Compra no dia do fechamento entra na fatura que fecha nesse dia.
2. Fatura identificada pelo vencimento; rótulo pelo mês do vencimento.
3. `invoice_due_date` gravado na compra, não recalculado na leitura.
4. Compra no cartão aceita apenas PAID e CANCELLED.
5. Faturas derivadas de view, sem tabela própria; situação calculada no cliente.
6. Pagamento parcial permitido; fatura fica Parcial.
7. Cartão não entra no saldo monetário nem em `account_balances`.
8. Limite é informativo e nunca bloqueia lançamento.
9. Estorno de compra no cartão fica para uma versão futura.

A arquitetura da v0.6 do Baru Budget está pronta para implementação após sua aprovação.
