# ANÁLISE ARQUITETURAL — BARU BUDGET v0.9

Data: 2026-09-07. Estado real verificado: v0.8 entregue (gastos fixos e receitas recorrentes com geração idempotente). `transactions` tem quatro origens possíveis, agrupamento de parcelas, vínculo com modelos recorrentes e a constraint `transactions_kind_supported` que ainda bloqueia SETTLEMENT. `account_balances` soma INCOME positivo e o resto negativo. Policies de leitura de `transactions` cobrem proprietário, concessões e grupo. A rota `/settlements` é um placeholder marcado para a v0.9. Baseline: 237 testes Vitest, 619 asserções pgTAP.

---

## 1. Objetivo

Separar quem pagou de quem é responsável e acertar contas entre pessoas: dividir uma despesa entre usuários, calcular quanto cada um deve, registrar o pagamento entre pessoas e mostrar a receber, a pagar e o saldo líquido. Ao final, o usuário lança um mercado de R$ 600 pago por ele com metade da responsabilidade de outra pessoa, essa pessoa vê que deve R$ 300, e o Pix de acerto zera a dívida sem alterar a despesa original.

## 2. Escopo

Incluído:

- Banco: tabela `transaction_allocations` com invariante de soma garantido por constraint trigger adiada; enum `settlement_direction`; coluna `counterparty_user_id` em `transactions`; SETTLEMENT liberado no enum de tipos; forma do acerto na constraint; `account_balances` passa a tratar acertos; visibilidade de movimentações, alocações e perfis para as contrapartes; view `people_balances`.
- Função `set_transaction_allocations` que substitui a divisão de uma movimentação em uma chamada atômica.
- Divisão no formulário de movimentação, com divisão igualitária e validação da soma.
- Página Acertos: cards de a receber, a pagar e saldo líquido; saldo por pessoa; itens em aberto por pessoa; registro de acerto.
- Dashboard: cards "A receber" e "A pagar" voltam com dados reais.
- Movimentações: a linha de uma despesa dividida indica a divisão.
- Testes pgTAP e Vitest.
- Migrations aplicadas ao projeto hospedado antes do deploy.

Fora do escopo: divisão por percentual armazenado (a divisão é sempre gravada em valores); divisão de receitas; divisão de parcelas individuais com regra própria (cada parcela é dividida como qualquer despesa); acerto parcial automático que quita itens específicos; cobrança, lembrete ou notificação; empréstimos e financiamentos (v0.10 e v0.11).

## 3. Decisões

### 3.1 Quem pagou e quem é responsável

O pagador é o proprietário da movimentação (`owner_user_id`), porque é dele a conta ou o cartão de onde o dinheiro saiu. A responsabilidade fica em uma tabela própria:

```sql
create table public.transaction_allocations (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete restrict,
  amount         numeric(14,2) not null,
  created_at, updated_at, created_by, updated_by,
  constraint transaction_allocations_amount_positive check (amount > 0)
);

create unique index transaction_allocations_unique_user
  on public.transaction_allocations (transaction_id, user_id);
```

- Uma linha por responsável, valores em reais, sem percentual armazenado. Percentual é entrada da interface, nunca estado.
- Divisão só existe em despesa. Um acerto, uma transferência ou uma receita não têm responsáveis.
- Excluir a movimentação leva a divisão junto (`on delete cascade`); excluir um perfil é bloqueado enquanto houver divisão apontando para ele.

### 3.2 O invariante da soma vive no banco

A seção 22 do Prompt Mestre exige que a soma das divisões corresponda ao total e que inconsistências não passem em silêncio. Um `check` não enxerga várias linhas, então o invariante é uma **constraint trigger adiada**:

```sql
create constraint trigger transaction_allocations_sum_matches
  after insert or update or delete on public.transaction_allocations
  deferrable initially deferred
  for each row execute function public.check_allocation_sum();

create constraint trigger transactions_allocation_sum_matches
  after update of amount on public.transactions
  deferrable initially deferred
  for each row execute function public.check_transaction_allocation_sum();
```

- A verificação acontece no fim da transação: substituir três linhas por duas passa pelos estados intermediários sem erro e falha no commit se a soma não fechar.
- Regra: quando a movimentação tem qualquer divisão, a soma das divisões é exatamente o valor da movimentação. Não existe divisão parcial implícita; a parte do próprio pagador é uma linha como as outras.
- Mudar o valor de uma despesa dividida exige ajustar a divisão na mesma transação, o que a trigger em `transactions` garante.

Para o cliente não precisar orquestrar isso, a substituição é uma chamada só:

```sql
public.set_transaction_allocations(p_transaction_id uuid, p_user_ids uuid[], p_amounts numeric[]) returns integer
```

Direitos de invocador: apaga as divisões atuais e insere as novas; o RLS decide, e a trigger adiada valida no commit. Arrays vazios removem a divisão.

### 3.3 Acerto é uma movimentação

A seção 23 pede um registro de acerto e a seção 15 já reserva SETTLEMENT no vocabulário de `transaction_kind`. **Decisão: o acerto é uma movimentação de tipo SETTLEMENT, não uma tabela separada.** Motivos:

- O acerto move dinheiro de verdade: sai ou entra em uma conta. Como movimentação, `account_balances` já reflete isso; como tabela separada, o cálculo de saldo teria que unir duas fontes.
- Mantém um único razão: filtros, período, contexto financeiro e auditoria funcionam sem caso especial.
- A seção 24 pede para não armazenar saldo derivado; um razão único torna o cálculo de a receber e a pagar uniforme.

```sql
create type public.settlement_direction as enum ('PAY', 'RECEIVE');

alter table public.transactions
  add column counterparty_user_id uuid references public.profiles (id) on delete restrict,
  add column settlement_direction public.settlement_direction;
```

- `transactions_kind_supported` passa a aceitar SETTLEMENT.
- Forma do acerto: `kind = 'SETTLEMENT'` exige conta, contraparte e direção; proíbe categoria, cartão, conta de destino, fatura, parcelamento e modelo recorrente. A contraparte é diferente do proprietário.
- PAY debita a conta do proprietário; RECEIVE credita. `account_balances` passa a somar `+amount` para INCOME e para SETTLEMENT RECEIVE, e `-amount` para o restante.
- Acerto **não** é receita nem despesa: `monthly_transaction_totals` já filtra apenas INCOME e EXPENSE, então nada muda no dashboard de receitas e despesas. O acerto também não altera a despesa que originou a dívida, como a seção 23 exige.

### 3.4 Visibilidade entre as partes

Se alguém aloca R$ 300 de uma compra para mim, eu preciso ver isso mesmo sem ter concessão sobre as finanças dessa pessoa. Sem isso, "a pagar" seria inútil. As policies ganham:

- `transaction_allocations`: leitura para quem pode ver o dono da movimentação **ou** para o próprio responsável; escrita apenas para quem pode administrar o dono.
- `transactions`: além das regras atuais, leitura quando existe divisão para mim (`public.is_allocated_to_me(id)`, `security definer`) ou quando sou a contraparte de um acerto.
- `profiles`: leitura também para quem divide despesas ou acertos comigo (`public.shares_ledger_with(other)`).

O que a contraparte passa a enxergar é exatamente o necessário: a movimentação que gerou a dívida e o nome de quem pagou. Conta, cartão, saldo e demais lançamentos continuam fora do alcance.

### 3.5 Saldos entre pessoas

Nada de saldo armazenado. Uma view calcula o líquido por par, do ponto de vista de quem consulta:

```sql
create view public.people_balances with (security_invoker = true) as
with entries as (
  -- divisão: o responsável deve ao pagador
  select t.owner_user_id as creditor, a.user_id as debtor, a.amount
    from public.transaction_allocations a
    join public.transactions t on t.id = a.transaction_id
   where t.kind = 'EXPENSE' and t.status <> 'CANCELLED' and a.user_id <> t.owner_user_id
  union all
  -- acerto: quem paga ganha crédito contra quem recebe
  select case when t.settlement_direction = 'PAY' then t.owner_user_id else t.counterparty_user_id end,
         case when t.settlement_direction = 'PAY' then t.counterparty_user_id else t.owner_user_id end,
         t.amount
    from public.transactions t
   where t.kind = 'SETTLEMENT' and t.status <> 'CANCELLED'
)
select
  case when creditor = auth.uid() then debtor else creditor end as counterparty_user_id,
  sum(case when creditor = auth.uid() then amount else -amount end) as balance
from entries
where auth.uid() in (creditor, debtor)
group by 1;
```

- Positivo significa a receber; negativo, a pagar. O total de cada lado e o líquido são somados no cliente a partir dessas linhas.
- `security_invoker` combinado com as policies da seção 3.4 faz cada usuário ver apenas os pares que o envolvem, com os valores que ele tem direito de ver.
- Alocação para o próprio pagador é ignorada: ninguém deve a si mesmo.
- Acerto cancelado e despesa cancelada saem do cálculo.

Exemplo da seção 24: Pai deve 420, Esposa deve 150, e eu devo 80 à Mãe. A view devolve três linhas (+420, +150, −80); a interface mostra a receber 570, a pagar 80 e líquido +490.

### 3.6 Interface

- **Formulário de movimentação:** em Saída, uma seção "Dividir com" lista os responsáveis. Botão para adicionar pessoa (entre membros dos meus grupos e contrapartes de concessão), campo de valor por pessoa, atalho "dividir igualmente" e um indicador do que falta alocar. Salvar chama a divisão logo após gravar a movimentação, na mesma ação do usuário. Sem divisão, nada muda no fluxo atual.
- **`/settlements`** deixa de ser placeholder: cards A receber, A pagar e Saldo líquido; lista de pessoas com o saldo de cada uma; cada pessoa expande e mostra os itens que compõem o saldo (despesas divididas e acertos), carregados sob demanda; botão "Registrar acerto" abre um formulário com pessoa, direção, valor sugerido pelo saldo, conta e data.
- **Movimentações:** a linha de uma despesa dividida ganha a marca "Dividida"; quando a despesa é de outra pessoa e eu sou responsável, a linha mostra o valor que me cabe.
- **Dashboard:** os cards "A receber" e "A pagar", retirados na v0.5 por falta de fonte real, voltam alimentados pela view.

### 3.7 Estrutura Angular

```text
src/app/features/settlements/            NOVO
├── allocation.ts                        splitEqually, remainingToAllocate, validação (puras)
├── allocation.model.ts                  Allocation, AllocationInput, PersonBalance, totais
├── settlements.repository.ts            alocações, view de saldos, itens do par, RPC
├── settlements.store.ts                 saldos por contexto, itens por pessoa, mutações
├── settlements-page/
└── settlement-form-dialog/
```

`TransactionFormDialog` ganha a seção de divisão; `DashboardStore` volta a ter os dois cards; a lista de movimentações ganha a marca.

### 3.8 Migrations e versão

| Arquivo | Conteúdo |
|---|---|
| `..._allocations.sql` | tabela, índice único, RLS, policies, triggers de auditoria, `check_allocation_sum`, constraint triggers adiadas, `set_transaction_allocations`, `is_allocated_to_me` |
| `..._settlements.sql` | enum `settlement_direction`, colunas em `transactions`, SETTLEMENT liberado, forma do acerto, `account_balances` atualizada, policies de `transactions` e `profiles`, `shares_ledger_with` |
| `..._people_balances.sql` | view `people_balances` |

Seed local: um mercado dividido meio a meio entre os dois usuários de desenvolvimento e um acerto parcial, deixando saldo em aberto. `package.json` e `appVersion` passam a `0.9.0`.

## 4. Testes

pgTAP:

- `allocations.test.sql`: divisão que fecha é aceita; divisão que não fecha falha no commit; valor zero ou negativo rejeitado; duas linhas para a mesma pessoa rejeitadas; alocação em receita, transferência ou acerto rejeitada; alterar o valor da despesa sem ajustar a divisão falha no commit; ajustar os dois na mesma transação passa; excluir a despesa remove a divisão; o responsável enxerga a movimentação e a própria linha, e não enxerga as demais; VIEW lê e não escreve; MANAGE escreve; `anon` não lê.
- `settlements.test.sql`: acerto PAY debita a conta e RECEIVE credita; acerto não entra em receitas nem despesas; forma inválida rejeitada (sem conta, sem contraparte, sem direção, com categoria, com cartão, contraparte igual ao proprietário); a contraparte enxerga o acerto; SETTLEMENT continua proibido com parcelamento ou modelo recorrente.
- `people_balances.test.sql`: o exemplo da seção 24 com três pessoas; divisão para o próprio pagador ignorada; acerto reduz a dívida na direção certa; despesa e acerto cancelados fora; cada lado do par vê o mesmo valor com sinal oposto; terceiro não relacionado não vê nada; `anon` não vê nada.
- `schema.test.sql` e `rls_enabled.test.sql` estendidos.

Vitest:

- `allocation`: divisão igualitária com sobra na primeira pessoa; quanto falta alocar; validação de soma; detecção de pessoa repetida.
- `allocation.model`: totais a receber, a pagar e líquido a partir das linhas da view; ordenação por valor.
- `SettlementsStore`: carrega saldos por contexto; itens de uma pessoa sob demanda; recarrega após acerto e após divisão.
- `TransactionFormDialog`: seção de divisão só em despesa; divisão igualitária; salvar chama a substituição de divisão; soma diferente do total bloqueia o salvamento.
- `SettlementFormDialog`: direção, valor sugerido pelo saldo e validação.
- `DashboardStore`: cards a receber e a pagar a partir dos saldos.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Divisão inconsistente aceita em silêncio | Constraint triggers adiadas nas duas pontas; testes pgTAP de commit |
| Contraparte sem acesso ao que deve | Policies de leitura por alocação e por acerto; teste pgTAP |
| Contraparte vendo mais do que deve | A leitura liberada é só da movimentação envolvida e do perfil; conta, cartão e saldo continuam fora; teste pgTAP |
| Alocar para pessoa sem relação comigo | A interface oferece apenas membros de grupo e contrapartes de concessão; o banco aceita qualquer perfil, o que é registrado como limitação conhecida |
| Acerto alterando a despesa de origem | Acerto é lançamento independente; nenhuma escrita na despesa; teste pgTAP |
| Saldo derivado divergindo | Nada é armazenado; a view calcula sempre |
| Recursão de RLS entre movimentações e alocações | `is_allocated_to_me` e `shares_ledger_with` são `security definer` |

## 6. Dependências

Nenhuma nova.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** tabela de alocações com invariante no banco; função de substituição atômica; acerto como movimentação com direção e contraparte; saldo em conta correto; visibilidade entre as partes; view de saldos; página de acertos; divisão no formulário; cards no dashboard; testes.

**PREPARAR AGORA:** `counterparty_user_id` reutilizável por empréstimos entre pessoas (v0.10); `people_balances` como fonte única de a receber e a pagar; divisão igualitária como função pura reaproveitável.

**FAZER DEPOIS:** quitação de itens específicos por acerto; divisão por percentual na entrada; divisão de receitas; cobrança e lembretes; exportação do extrato entre pessoas (v0.12).

**NÃO NECESSÁRIO:** tabela `settlements` separada; saldo materializado; percentual armazenado; conciliação automática.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica as três migrations ao projeto hospedado.
3. Verificação: `GET /rest/v1/transaction_allocations` e `GET /rest/v1/people_balances` com a chave publicável retornam lista vazia.
4. Push para `main`; Cloudflare Pages publica.
5. Validação com dois usuários: dividir uma despesa, conferir o saldo dos dois lados, registrar o acerto e ver o saldo zerar sem alterar a despesa.

Nenhum passo exige ação do administrador além do segundo usuário já previsto na v0.4.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. **O acerto é uma movimentação de tipo SETTLEMENT, não a tabela `settlements` citada na seção 23.** O vocabulário da seção 15 já previa o tipo, o acerto move dinheiro de verdade e o razão único evita duplicar o cálculo de saldo. Reversível por migration se você preferir a tabela separada.
2. Quando há divisão, a soma é exatamente o valor da despesa; a parte do pagador é uma linha como as outras.
3. Divisão apenas em despesa, em valores, sem percentual armazenado.
4. Uma linha por pessoa e por despesa.
5. A contraparte passa a ver a despesa que a envolve e o nome de quem pagou.
6. Saldos calculados por view, nunca armazenados.
7. Acerto não entra em receitas nem despesas do período.
8. A interface sugere apenas pessoas com quem já existe grupo ou concessão.

A arquitetura da v0.9 do Baru Budget está pronta para implementação após sua aprovação.
