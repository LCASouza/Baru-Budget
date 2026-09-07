# ANÁLISE ARQUITETURAL — BARU BUDGET v0.7

Data: 2026-09-07. Estado real verificado: v0.6 entregue (cartões, regra de competência da fatura gravada em `transactions.invoice_due_date`, view `credit_card_invoices`, compra no cartão como saída sem conta e pagamento de fatura como transferência). `transactions` tem `account_id` opcional, `credit_card_id`, `invoice_due_date`, constraint `transactions_shape` com quatro casos e trigger `validate_transaction_references`. Função imutável `public.invoice_due_date_for` disponível. A rota `/installments` ainda é um placeholder marcado para a v0.7. Baseline: 192 testes Vitest, 465 asserções pgTAP.

---

## 1. Objetivo

Registrar compras parceladas e acompanhar o comprometimento futuro: uma compra em N vezes gera N parcelas, cada uma na sua competência (fatura do cartão ou mês da conta), com parcela atual, restantes, próxima parcela e total comprometido. Ao final, o usuário lança "Notebook 12x de R$ 350", vê cada parcela na fatura certa e acompanha quanto ainda deve nos próximos meses.

## 2. Escopo

Incluído:

- Banco: colunas `installment_group_id`, `installment_number` e `installment_count` em `transactions`; constraint de forma do parcelamento; índice; função `create_installment_purchase` que gera as parcelas com a regra oficial; view `installment_purchases`.
- Divisão do valor em centavos com a sobra na primeira parcela.
- Parcelamento no cartão: uma parcela por fatura, em faturas consecutivas.
- Parcelamento em conta (carnê): uma parcela por mês, pendente, com vencimento no dia da compra ajustado ao mês.
- Página Parcelas: comprometimento total e por mês, lista de parcelamentos com progresso, próxima parcela e restante, parcelas do parcelamento sob demanda, filtros por origem e por situação.
- Formulário de movimentação: campo "Parcelar em" com prévia do valor e da primeira competência.
- Movimentações: descrição mostra "4/12"; filtro por parcelamento não é necessário (o filtro por cartão já cobre).
- Dashboard: card "Parcelas futuras" com o comprometimento após o período.
- Exclusão do parcelamento inteiro.
- Testes pgTAP e Vitest, com a mesma tabela de casos da divisão e das competências.
- Migrations aplicadas ao projeto hospedado antes do deploy.

Fora do escopo: edição em massa do parcelamento (descrição, categoria e valor de todas as parcelas de uma vez), antecipação de parcelas com desconto, juros embutidos no parcelamento, renegociação, divisão entre pessoas das parcelas (v0.9), gastos fixos e recorrências (v0.8), parcelamento de receita.

## 3. Decisões

### 3.1 Uma parcela é uma movimentação

Cada parcela é uma linha em `transactions`, não uma projeção. Uma compra de R$ 900 em 3x cria três saídas de R$ 300, cada uma na sua fatura. Consequências, todas desejadas e já testadas nas versões anteriores:

- As faturas de setembro, outubro e novembro mostram R$ 300 cada, sem regra especial na view de faturas.
- As despesas do mês, os gastos por categoria e o dashboard já contam a parcela do mês, não a compra inteira.
- O saldo da conta continua intocado no cartão; no carnê, cada parcela é paga individualmente.
- A pessoa responsável (v0.9) deverá o valor da parcela na competência dela, que é o comportamento pedido pela seção 30 do Prompt Mestre.

Nenhuma tabela de parcelamento: o agrupamento vive em três colunas e a visão consolidada é uma view, como já é feito com faturas e saldos.

```sql
alter table public.transactions
  add column installment_group_id uuid,
  add column installment_number   integer,
  add column installment_count    integer;

create index transactions_installment_idx
  on public.transactions (installment_group_id, installment_number)
  where installment_group_id is not null;

alter table public.transactions add constraint transactions_installment_shape check (
  (installment_group_id is null and installment_number is null and installment_count is null)
  or (
    installment_group_id is not null
    and kind = 'EXPENSE'
    and installment_number is not null
    and installment_count is not null
    and installment_count >= 2
    and installment_number between 1 and installment_count
  )
);
```

O parcelamento é sempre despesa. A descrição é igual em todas as parcelas; "4/12" é montado na interface a partir das colunas, não gravado no texto.

### 3.2 Divisão do valor

Função imutável `public.split_installment_amounts(total numeric, count integer) returns numeric[]`:

1. Converte o total para centavos inteiros.
2. `base = centavos / count` (divisão inteira) e `sobra = centavos - base * count`.
3. A sobra é somada à **primeira** parcela, prática usual no Brasil.

| Total | Parcelas | Resultado |
|---|---|---|
| 900,00 | 3 | 300,00 · 300,00 · 300,00 |
| 100,00 | 3 | 33,34 · 33,33 · 33,33 |
| 0,05 | 2 | 0,03 · 0,02 |
| 1.234,56 | 7 | 176,40 · 176,36 × 6 |

A soma das parcelas é sempre igual ao total, o que é verificado por teste.

### 3.3 Competência de cada parcela

- **Cartão:** a primeira parcela usa `invoice_due_date_for(data_da_compra, fechamento, vencimento)`; a parcela `k` vence no mesmo dia de vencimento do mês seguinte ao da parcela anterior, com o dia ajustado ao último dia do mês. Uma compra parcelada feita depois do fechamento começa na fatura seguinte, como qualquer compra.
- **Conta (carnê):** a parcela `k` tem data e vencimento no dia da compra, `k-1` meses depois, com o dia ajustado ao último dia do mês (compra dia 31 gera parcela em 28 de fevereiro). Todas nascem PENDING.

Exemplo pedido pela seção 30 do Prompt Mestre: cartão que fecha dia 20 e vence dia 5, compra de R$ 900 em 3x no dia 10/09/2026 gera parcelas de R$ 300 nas faturas de 05/10, 05/11 e 05/12.

### 3.4 Geração no banco

`public.create_installment_purchase(...) returns uuid` (o identificador do grupo), `language plpgsql`, **security invoker**, `set search_path = ''`:

- Parâmetros: proprietário, descrição, valor total, número de parcelas, data, categoria, cartão, conta, grupo familiar, observações.
- Valida `count >= 2`, exatamente uma origem (cartão ou conta) e delega o resto às constraints e à trigger já existentes.
- Insere as N parcelas em uma única instrução; se qualquer uma violar RLS ou constraint, nada é gravado.
- Direitos de invocador: o RLS decide o que pode ser inserido, exatamente como em um insert direto. Um usuário com MANAGE pode parcelar para o proprietário; um com VIEW não.

Gerar no banco evita divergência entre a regra de competência do servidor e a do cliente, e torna a criação atômica em uma chamada. O cliente calcula apenas a prévia.

### 3.5 View consolidada

```sql
create view public.installment_purchases
with (security_invoker = true) as
select
  t.installment_group_id as id,
  t.owner_user_id, t.credit_card_id, t.account_id, t.category_id,
  min(t.description)                        as description,
  max(t.installment_count)                  as installment_count,
  count(*)::integer                         as recorded_count,
  sum(t.amount)                             as total_amount,
  min(coalesce(t.invoice_due_date, t.date)) as first_competence,
  max(coalesce(t.invoice_due_date, t.date)) as last_competence,
  count(*) filter (where coalesce(t.invoice_due_date, t.date) > current_date)::integer as remaining_count,
  coalesce(sum(t.amount) filter (where coalesce(t.invoice_due_date, t.date) > current_date), 0) as remaining_amount
from public.transactions t
where t.installment_group_id is not null
  and t.status <> 'CANCELLED'
group by t.installment_group_id, t.owner_user_id, t.credit_card_id, t.account_id, t.category_id;
```

- `security_invoker` mantém a regra de visibilidade das movimentações.
- Competência é `invoice_due_date` no cartão e `date` na conta, o mesmo critério usado para ordenar parcelas.
- Parcelas canceladas saem do parcelamento sem apagar histórico.
- Parcela atual e restantes são derivadas no cliente a partir de `recorded_count` e `remaining_count`.

### 3.6 Interface

- **Formulário de movimentação:** para Saída, campo "Parcelar em" (1 a 60). Com mais de 1, o rótulo do valor passa a "Valor total" e aparece a prévia "12x de R$ 350,00 · primeira em Outubro 2026". Ao salvar, chama a função de geração. Parcelamento só existe na criação; editar uma parcela existente continua igual e não altera as demais.
- **`/installments`** deixa de ser placeholder: cards de comprometimento (Total restante, Restante no mês, Próximos 6 meses), lista de parcelamentos com descrição, origem, progresso "4/12", valor da parcela, próxima competência e restante; cada item expande e carrega suas parcelas sob demanda, com a competência e a situação de cada uma. Filtros: origem (cartão ou conta, e qual) e situação (Em andamento, Concluídos).
- **Movimentações:** a linha de uma parcela mostra "Notebook 4/12".
- **Detalhe do cartão:** a linha da fatura mostra "4/12" junto da descrição.
- **Dashboard:** card "Parcelas futuras" com o total comprometido depois do período selecionado, fora de contexto de grupo.
- **Exclusão:** no formulário de uma parcela, além de "Excluir", aparece "Excluir parcelamento", que remove todas as parcelas do grupo após confirmação.

### 3.7 Estrutura Angular

```text
src/app/features/installments/          NOVO
├── installment.ts                      splitInstallmentAmounts, installmentCompetences, rótulo "4/12" (puras)
├── installment.model.ts                InstallmentPurchase, InstallmentView, progresso e situação
├── installment.repository.ts           view, parcelas de um grupo, criação via RPC, exclusão do grupo
├── installments.store.ts               parcelamentos por contexto, comprometimento por mês
└── installments-page/
```

`TransactionFormDialog` ganha o campo de parcelas e a prévia; `TransactionsStore` e a lista mostram "4/12"; `DashboardStore` ganha o card de parcelas futuras.

### 3.8 Migrations e versão

| Arquivo | Conteúdo |
|---|---|
| `..._installments.sql` | colunas, constraint, índice, `split_installment_amounts`, `create_installment_purchase` |
| `..._installment_purchases.sql` | view `installment_purchases` com `security_invoker` |

Seed local: uma compra parcelada em 3x no cartão do usuário de desenvolvimento e um carnê em 4x na conta corrente. `package.json` e `appVersion` passam a `0.7.0`.

## 4. Testes

pgTAP:

- `split_installments.test.sql`: cada linha da tabela da seção 3.2; a soma sempre bate com o total; `count` menor que 2 é rejeitado; função imutável e não executável por `anon`.
- `installments.test.sql`: parcelamento no cartão gera N parcelas em faturas consecutivas, com numeração 1..N e a mesma descrição; parcelamento em conta gera N parcelas mensais PENDING com vencimento ajustado ao mês; compra depois do fechamento começa na fatura seguinte; parcelamento com cartão e conta ao mesmo tempo é rejeitado; parcelamento sem origem é rejeitado; `count = 1` é rejeitado; parcela sem grupo com numeração é rejeitada; numeração fora de 1..N é rejeitada; parcelamento como receita é rejeitado; usuário com VIEW não gera parcelamento; usuário com MANAGE gera para o proprietário; `anon` não executa a função; excluir o grupo remove todas as parcelas.
- `installment_purchases.test.sql`: uma linha por grupo com total, quantidade, primeira e última competência; canceladas fora; restantes e valor restante calculados pela competência; proprietário, VIEW e membro de grupo veem o que devem; `anon` não vê nada.
- `credit_card_invoices` continua correta com parcelas: cada fatura recebe uma parcela.
- `schema.test.sql` e `rls_enabled.test.sql` estendidos.

Vitest:

- `installment`: mesma tabela de divisão do pgTAP; competências no cartão e na conta, com virada de ano e dia ajustado; rótulo "4/12".
- `installment.model`: progresso, parcela atual, situação (Em andamento, Concluído), próxima parcela.
- `InstallmentsStore`: carrega por contexto, comprometimento total e por mês, recarrega após criar e excluir.
- `TransactionFormDialog`: campo de parcelas aparece só em Saída; prévia do valor e da primeira competência; salvar com parcelas chama a criação de parcelamento em vez do insert simples; edição de parcela existente não oferece o campo.
- `InstallmentsPage`: progresso exibido e filtros.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Função de geração ignorando RLS | `security invoker`: cada insert passa pelas policies; teste pgTAP com VIEW e MANAGE |
| Parcelamento com origem inconsistente | Constraint de forma existente mais validação na função; teste pgTAP |
| Parcelas de grupos diferentes se misturando | `installment_group_id` gerado no banco (`gen_random_uuid`), nunca recebido do cliente |
| Soma das parcelas diferente do total | Divisão em centavos com sobra na primeira; teste pgTAP e Vitest |
| Comprometimento expondo dados de terceiros | View com `security_invoker`; teste pgTAP |
| Exclusão parcial deixando o parcelamento inconsistente | Excluir uma parcela é permitido e a view recalcula; "Excluir parcelamento" remove o grupo inteiro |

## 6. Dependências

Nenhuma nova. `MatExpansionModule` já vem com o Angular Material instalado.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** colunas e constraint; divisão e geração no banco; view consolidada; página de parcelas com comprometimento; campo de parcelas no formulário com prévia; "4/12" nas listas; card no dashboard; exclusão do grupo; testes.

**PREPARAR AGORA:** competência por parcela como base para a divisão entre pessoas da v0.9; `installment_group_id` reutilizável por recorrências (v0.8) se elas seguirem o mesmo padrão de geração; comprometimento por mês reaproveitável no dashboard.

**FAZER DEPOIS:** edição em massa do parcelamento; antecipação e renegociação; juros do parcelamento; parcelas divididas entre pessoas (v0.9); parcelamento de financiamento (v0.11).

**NÃO NECESSÁRIO:** tabela de parcelamento; geração no cliente; projeção de parcelas sem lançamento; parcelamento de receita.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica as duas migrations ao projeto hospedado.
3. Verificação: `GET /rest/v1/installment_purchases` com a chave publicável retorna lista vazia.
4. Push para `main`; Cloudflare Pages publica.
5. Validação: lançar uma compra parcelada no cartão e conferir uma parcela por fatura; lançar um carnê e conferir as parcelas mensais pendentes.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. Cada parcela é uma movimentação real; não há tabela de parcelamento.
2. A sobra dos centavos vai para a primeira parcela.
3. Parcelamento é sempre despesa, com no mínimo duas parcelas e no máximo sessenta.
4. No cartão, as parcelas caem em faturas consecutivas a partir da fatura da compra.
5. Na conta, as parcelas nascem pendentes com vencimento no dia da compra ajustado ao mês.
6. A geração acontece no banco, em uma chamada atômica.
7. Parcelamento existe apenas na criação; editar uma parcela não altera as demais.
8. "Excluir parcelamento" remove todas as parcelas do grupo, inclusive as passadas.
9. Comprometimento é medido pela competência de cada parcela em relação a hoje.

A arquitetura da v0.7 do Baru Budget está pronta para implementação após sua aprovação.
