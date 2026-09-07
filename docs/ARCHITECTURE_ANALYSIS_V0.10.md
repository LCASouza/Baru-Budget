# ANÁLISE ARQUITETURAL — BARU BUDGET v0.10

Data: 2026-09-07. Estado real verificado: v0.9 entregue (divisão de despesas com invariante no banco, acertos como movimentação SETTLEMENT, saldos derivados entre pessoas). `transactions` já suporta quatro tipos, quatro origens, parcelamento, recorrência, contraparte e divisão. `monthly_transaction_totals` soma apenas INCOME e EXPENSE não canceladas. `account_balances` reflete todos os tipos. A rota `/loans` é um placeholder marcado para a v0.10. Baseline: 260 testes Vitest, 692 asserções pgTAP.

---

## 1. Objetivo

Registrar empréstimos tomados e acompanhar o que ainda falta pagar: principal, taxa, modelo de juros explícito, parcelas geradas mês a mês, saldo devedor e total restante. Ao final, o usuário cadastra um empréstimo de R$ 10.000 em 12 vezes pela Tabela Price a 1,5% ao mês, vê a parcela calculada, o dinheiro entrar na conta sem inflar as receitas do mês, e acompanha o saldo devedor caindo a cada parcela paga.

## 2. Escopo

Incluído:

- Banco: enums `loan_interest_model` e `interest_period`; tabela `loans`; colunas `loan_id` e `loan_installment_number` em `transactions`; constraint de forma; índices; função `generate_loan_schedule`; `monthly_transaction_totals` deixa de contar a liberação do empréstimo como receita.
- Dois modelos de juros explícitos, com fórmula documentada e testada: juros simples e Tabela Price.
- Conversão de taxa anual para mensal definida por modelo, documentada e testada.
- Geração da liberação e das parcelas, idempotente.
- Página Empréstimos: lista com principal, taxa, modelo, progresso, próxima parcela, total restante e saldo devedor; detalhe com a tabela de amortização; criação, edição do cadastro e exclusão.
- Dashboard: card "Empréstimos" com o total restante, fora de contexto de grupo.
- Testes matemáticos pgTAP e Vitest.
- Migrations aplicadas ao projeto hospedado antes do deploy.

Fora do escopo: empréstimo concedido a outra pessoa com juros (dinheiro emprestado por você); renegociação e portabilidade; amortização extraordinária; carência; seguro, IOF e tarifas; juros compostos sem parcelamento (pagamento único no fim); financiamentos, que são a v0.11.

## 3. Decisões

### 3.1 Empréstimo tomado, não concedido

A v0.10 cobre dinheiro **recebido** por empréstimo e devolvido em parcelas, que é o caso da seção 34 do Prompt Mestre. Emprestar dinheiro a outra pessoa continua fora: sem juros, isso já é divisão e acerto (v0.9); com juros e cronograma, fica registrado como limitação conhecida para uma versão futura. Evita sobreposição com os saldos entre pessoas e mantém a semântica de cada tela clara.

```sql
create type public.loan_interest_model as enum ('SIMPLE', 'PRICE');
create type public.interest_period as enum ('MONTHLY', 'YEARLY');

create table public.loans (
  id               uuid primary key default gen_random_uuid(),
  owner_user_id    uuid not null references public.profiles (id) on delete cascade,
  description      text not null,
  lender           text,
  account_id       uuid not null references public.accounts (id) on delete restrict,
  category_id      uuid not null references public.categories (id) on delete restrict,
  household_id     uuid references public.households (id) on delete set null,
  principal        numeric(14,2) not null,
  interest_rate    numeric(9,6) not null,       -- percentual por período
  interest_period  public.interest_period not null default 'MONTHLY',
  interest_model   public.loan_interest_model not null,
  installment_count integer not null,
  start_date       date not null,
  first_due_date   date not null,
  notes            text,
  created_at, updated_at, created_by, updated_by,
  constraint loans_principal_positive check (principal > 0),
  constraint loans_rate_range check (interest_rate >= 0 and interest_rate < 100),
  constraint loans_installments_range check (installment_count between 1 and 480)
);
```

- `account_id` é a conta onde o dinheiro entrou e de onde as parcelas saem. `category_id` é a categoria de despesa das parcelas (por exemplo "Empréstimo").
- `interest_rate` é percentual, não fração: 1.5 significa 1,5% por período.
- Taxa zero é aceita: empréstimo sem juros entre pessoas ou adiantamento.
- Sem `outstanding_balance` armazenado. A seção 33 cita o campo, mas a seção 24 pede para não guardar saldo derivável; o saldo é sempre calculado a partir das parcelas e da tabela de amortização.

### 3.2 Modelos de juros explícitos

A seção 33 exige que fórmulas nunca se misturem em silêncio. Dois modelos, cada um com fórmula fixa:

| Modelo | Parcela | Juros da parcela k | Amortização da parcela k |
|---|---|---|---|
| `SIMPLE` (juros simples) | `(P + P·i·n) / n` | `P·i` (constante) | `P/n` (constante) |
| `PRICE` (Tabela Price) | `P · i / (1 − (1+i)^−n)` | `saldo(k−1) · i` | `parcela − juros` |

Com `i = 0`, ambos degeneram para `P/n`, o que é tratado explicitamente para não dividir por zero na Price.

**Conversão da taxa anual para mensal**, quando `interest_period = 'YEARLY'`, também por modelo e documentada:

| Modelo | Conversão | Motivo |
|---|---|---|
| `SIMPLE` | `i = a / 12` (proporcional) | Juros simples são lineares no tempo; a convenção brasileira é proporcional |
| `PRICE` | `i = (1 + a)^(1/12) − 1` (efetiva) | A Price capitaliza; a taxa equivalente preserva o custo efetivo |

As duas conversões são declaradas, não inferidas, e cada uma tem teste próprio.

**Arredondamento:** as parcelas são calculadas em centavos inteiros e a diferença acumulada vai para a **última** parcela, de modo que as parcelas iniciais batam com o valor que a instituição cobra. A soma das parcelas é sempre igual ao total, o que é verificado por teste.

### 3.3 Empréstimo não é renda

A seção 34 é explícita: o dinheiro recebido aumenta o caixa, mas não infla as receitas do mês.

```sql
alter table public.transactions
  add column loan_id uuid references public.loans (id) on delete set null,
  add column loan_installment_number integer;
```

- **Liberação:** movimentação INCOME com `loan_id`, na conta do empréstimo, na data de início. Entra em `account_balances` (o caixa aumenta) e é **excluída** de `monthly_transaction_totals`, que passa a filtrar `loan_id is null` nas receitas. O mesmo filtro vale no resumo do dashboard e da página de movimentações, aplicado pela função pura que já calcula o resumo.
- **Parcelas:** movimentações EXPENSE com `loan_id` e `loan_installment_number`, pendentes, com vencimento no dia da primeira parcela deslocado mês a mês e ajustado ao último dia do mês. São despesas normais do período, o que está correto: pagar o empréstimo é despesa.
- Constraint: `loan_installment_number` só existe com `loan_id` e em EXPENSE; a liberação é INCOME sem número. Índice único parcial garante uma liberação por empréstimo e uma parcela por número.
- Excluir o empréstimo desfaz o vínculo (`on delete set null`) e preserva os lançamentos; a liberação volta a contar como receita nesse caso, o que fica registrado como limitação conhecida.

### 3.4 Geração do cronograma

`public.generate_loan_schedule(p_loan_id uuid, p_with_disbursement boolean default true) returns integer`, direitos de invocador, `set search_path = ''`:

- Calcula as parcelas com o modelo do empréstimo, em centavos, com a sobra na última.
- Insere a liberação (quando pedida e ainda inexistente) e as parcelas que faltarem, com `on conflict do nothing`; devolve quantos lançamentos criou.
- Idempotente pelos índices únicos: gerar de novo não duplica. Uma parcela excluída é recriada; uma parcela cancelada continua ocupando o número.
- O RLS decide cada inserção: VIEW não gera, MANAGE gera para o proprietário.

A tabela de amortização exibida na interface é calculada por função pura no cliente, a partir dos dados do empréstimo, e comparada com as parcelas realmente gravadas. Divergências aparecem como diferença entre o previsto e o lançado, sem reescrever nada.

### 3.5 Saldo devedor e total restante

Dois números diferentes, com rótulos distintos, ambos derivados:

- **Total restante a pagar** = soma das parcelas ainda não pagas (principal mais juros futuros). É o que sai do bolso daqui para frente.
- **Saldo devedor** = principal ainda não amortizado, obtido da tabela de amortização na posição da última parcela paga. Na Price cai devagar no começo; nos juros simples cai linearmente.

A interface mostra os dois lado a lado com explicação curta, porque confundi-los é o erro clássico desse domínio.

### 3.6 Interface

- **`/loans`** deixa de ser placeholder: lista de empréstimos com credor, principal, taxa e modelo, progresso "4/12", próxima parcela, total restante e saldo devedor; barra de progresso pelo principal amortizado. Ações: ver detalhe, editar cadastro, gerar cronograma, excluir.
- **Detalhe** com a tabela de amortização (parcela, vencimento, valor, juros, amortização, saldo depois) marcando as pagas, e o comparativo entre previsto e lançado.
- **Formulário:** descrição, credor, conta, categoria, principal, taxa e período, modelo de juros, número de parcelas, data de início, primeira parcela, grupo e observações. Prévia ao vivo com o valor da parcela, o total a pagar e o total de juros, recalculada a cada mudança.
- **Movimentações:** a linha de uma parcela mostra "Empréstimo 4/12"; a liberação mostra "Empréstimo".
- **Dashboard:** card "Empréstimos" com o total restante a pagar, fora de contexto de grupo.

### 3.7 Estrutura Angular

```text
src/app/features/loans/                  NOVO
├── loan-math.ts                         monthlyRate, priceInstalment, buildSchedule, totals (puras)
├── loan.model.ts                        Loan, LoanInput, LoanView, progresso, saldos
├── loan.repository.ts                   tabela, lançamentos do empréstimo, RPC de geração
├── loans.store.ts                       empréstimos por contexto, cronograma sob demanda
├── loans-page/
├── loan-detail-page/
└── loan-form-dialog/
```

`DashboardStore` ganha o card; a lista de movimentações ganha a marca; `summarizeDashboard` e `summarizeTransactions` passam a ignorar receitas com `loan_id`.

### 3.8 Migrations e versão

| Arquivo | Conteúdo |
|---|---|
| `..._loans.sql` | enums, tabela, RLS, policies, triggers de auditoria e de validação de referências, colunas em `transactions`, constraint, índices únicos parciais, `generate_loan_schedule` |
| `..._loan_totals.sql` | `monthly_transaction_totals` recriada excluindo a liberação de empréstimo das receitas |

Seed local: um empréstimo de R$ 10.000 em 12 parcelas pela Price a 1,5% ao mês, com a liberação e as parcelas geradas, duas já pagas. `package.json` e `appVersion` passam a `0.10.0`.

## 4. Testes

pgTAP:

- `loan_math.test.sql`: parcela Price de R$ 10.000 em 12x a 1,5% (valor conhecido, conferido com a fórmula); parcela de juros simples; taxa zero nos dois modelos; soma das parcelas igual ao total; conversão anual para mensal em cada modelo; arredondamento na última parcela.
- `loans.test.sql`: proprietário cria, edita e exclui; principal não positivo, taxa fora da faixa e número de parcelas fora da faixa rejeitados; conta e categoria de outro usuário rejeitadas; categoria de receita rejeitada; VIEW lê e não escreve; MANAGE escreve; usuário sem relação e `anon` não leem.
- `generate_loan_schedule.test.sql`: gera liberação e N parcelas com valores e vencimentos corretos; gerar de novo não duplica; parcela excluída é recriada; parcela cancelada não é; geração sem liberação; liberação entra no saldo da conta e **não** entra em `monthly_transaction_totals`; parcelas entram como despesa; VIEW não gera; MANAGE gera; `anon` não executa; excluir o empréstimo preserva os lançamentos.
- `schema.test.sql` e `rls_enabled.test.sql` estendidos.

Vitest:

- `loan-math`: mesma tabela de casos do pgTAP; tabela de amortização da Price com saldo chegando a zero na última parcela; juros simples com amortização constante; saldo devedor após k parcelas; total de juros; conversão anual por modelo; arredondamento.
- `loan.model`: progresso, próxima parcela, total restante, saldo devedor a partir das parcelas lançadas.
- `LoansStore`: carrega por contexto, cronograma sob demanda, recarrega após gerar e após mutação.
- `LoanFormDialog`: prévia da parcela por modelo, validação, chamada ao store.
- `dashboard-summary`: receita com `loan_id` fora das receitas do período.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Empréstimo inflando receitas | Filtro por `loan_id` na view e nas funções puras; teste pgTAP e Vitest |
| Fórmulas misturadas em silêncio | Modelo obrigatório por empréstimo, fórmula e conversão documentadas e testadas por modelo |
| Saldo devedor divergindo do real | Nada armazenado; derivado da tabela de amortização; previsto e lançado comparados na tela |
| Geração duplicando parcelas | Índices únicos parciais mais `on conflict do nothing` |
| Cronograma gerado ignorando RLS | Função com direitos de invocador; teste pgTAP com VIEW e MANAGE |
| Conta ou categoria de outro usuário | Trigger de validação reaproveitando os helpers da v0.8 |
| Erro de centavos acumulado | Cálculo em centavos com sobra na última parcela; teste de soma |

## 6. Dependências

Nenhuma nova.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** tabela de empréstimos; modelos de juros explícitos com conversão documentada; colunas e constraint em `transactions`; geração idempotente; exclusão da liberação das receitas; página com lista, detalhe e formulário; card no dashboard; testes matemáticos.

**PREPARAR AGORA:** `loan-math.ts` como base para os financiamentos da v0.11, que usam a mesma Price com entrada e valor do bem; `loan_id` como padrão de vínculo reaproveitável por `financing_id`; comparativo previsto contra lançado reutilizável.

**FAZER DEPOIS:** empréstimo concedido com juros; renegociação e portabilidade; amortização extraordinária; carência; IOF, seguro e tarifas; unificar o comprometimento futuro de parcelas de compra e de empréstimo em uma tela só.

**NÃO NECESSÁRIO:** saldo devedor armazenado; um terceiro modelo de juros sem caso de uso; cálculo de CET; integração bancária.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica as duas migrations ao projeto hospedado.
3. Verificação: `GET /rest/v1/loans` com a chave publicável retorna lista vazia; `anon` não executa `generate_loan_schedule`.
4. Push para `main`; Cloudflare Pages publica.
5. Validação: cadastrar um empréstimo Price, conferir a parcela contra uma calculadora, gerar o cronograma, confirmar que o caixa subiu sem alterar as receitas do mês e que o saldo devedor cai a cada parcela paga.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. A v0.10 cobre apenas empréstimo tomado; conceder empréstimo com juros fica para depois.
2. Dois modelos: juros simples e Tabela Price. Juros compostos com pagamento único não são oferecidos.
3. A taxa é percentual por período; a conversão de anual para mensal é proporcional em juros simples e efetiva na Price, ambas documentadas.
4. A sobra de centavos vai para a última parcela.
5. A liberação é uma receita vinculada ao empréstimo, somada ao caixa e excluída das receitas do período.
6. Saldo devedor e total restante são valores distintos, ambos derivados e exibidos lado a lado.
7. `outstanding_balance` da seção 33 é realizado como valor derivado, não como coluna.
8. Excluir o empréstimo preserva os lançamentos e desfaz o vínculo.

A arquitetura da v0.10 do Baru Budget está pronta para implementação após sua aprovação.
