# ANÁLISE ARQUITETURAL — BARU BUDGET v0.11

Data: 2026-09-07. Estado real verificado: v0.10 entregue (empréstimos tomados, dois modelos de juros explícitos, cronograma idempotente, saldo devedor derivado, liberação fora das receitas do mês). `transactions` já carrega cinco vínculos de origem: cartão, parcelamento, recorrência, contraparte e empréstimo. `loan_math` e `loan-math.ts` provam a mesma tabela de casos nos dois lados. A rota `/financings` ainda é um placeholder marcado para a v0.11. Baseline: 284 testes Vitest, 771 asserções pgTAP.

---

## 1. Objetivo

Registrar financiamentos de bens e acompanhar o que falta pagar: valor do bem, entrada, valor financiado, sistema de amortização, parcelas geradas mês a mês e saldo devedor. Ao final, o usuário cadastra um imóvel de R$ 300.000 com R$ 60.000 de entrada em 240 parcelas pela Tabela SAC, vê a primeira e a última parcela, acompanha o saldo devedor cair, e o total gasto no mês da compra é a entrada — nunca o valor do bem.

## 2. Escopo

Incluído:

- Banco: enum `financing_system`; tabela `financings`; colunas `financing_id` e `financing_installment_number` em `transactions`; constraint de forma; índices únicos parciais; funções `financing_monthly_rate`, `financing_installment_amounts` e `generate_financing_schedule`.
- Dois sistemas de amortização explícitos, com fórmula documentada e testada: Tabela Price e SAC.
- Regra financeira de não duplicação, estrutural: o valor do bem nunca vira lançamento.
- Geração da entrada e das parcelas, idempotente.
- Página Financiamentos: lista com bem, entrada, valor financiado, sistema, progresso, próxima parcela e saldo devedor; detalhe com a tabela de amortização; criação, edição e exclusão.
- Dashboard: card "Financiamentos" com o total restante, fora de contexto de grupo.
- Promoção da matemática de amortização para um módulo compartilhado, usado por empréstimos e financiamentos.
- Testes matemáticos pgTAP e Vitest, incluindo os testes de não duplicação.
- Migrations aplicadas ao projeto hospedado antes do deploy.

Fora do escopo: consórcio; leasing; sistemas SACRE e americano; correção monetária por índice (TR, IPCA, IGP-M); seguro obrigatório, taxa de administração e demais encargos mensais; amortização extraordinária e refinanciamento; controle patrimonial do bem, depreciação e valor de revenda; venda do bem com quitação; formato Excel, que é a v0.12.

## 3. Decisões

### 3.1 A regra de não duplicação é estrutural

A seção 35 do Prompt Mestre pede para "definir regra financeira sem duplicar: aquisição + parcela como duas despesas do mesmo valor". O erro que ela descreve é lançar a compra do bem por R$ 300.000 e depois lançar as 240 parcelas: o mesmo dinheiro contado duas vezes, e o mês da compra com uma despesa que nunca saiu da conta.

A solução segue o mesmo padrão da v0.6, onde compra no cartão e pagamento da fatura não podem se somar porque têm formas diferentes: aqui a duplicação fica impossível porque **o valor do bem não é um lançamento**.

| Elemento | Vira movimentação? | Por quê |
|---|---|---|
| Valor do bem | Não | Não é dinheiro que saiu da sua conta |
| Entrada | Sim, uma despesa | Saiu da sua conta na data da aquisição |
| Valor financiado | Não | Foi pago pelo banco ao vendedor, nunca passou pelo seu caixa |
| Parcelas | Sim, uma despesa cada | Saem da sua conta mês a mês |

O total efetivamente lançado é `entrada + soma das parcelas`, que é `valor do bem + juros`. A identidade fecha e nada é contado duas vezes.

Essa é também a diferença entre financiamento e empréstimo, e vale a pena declará-la: no empréstimo o dinheiro **entra** na sua conta e por isso existe uma receita vinculada, excluída das receitas do mês. No financiamento o dinheiro vai direto do banco ao vendedor, então não existe receita nenhuma a excluir. Nenhuma exceção nova em `monthly_transaction_totals`.

### 3.2 Tabela `financings`

```sql
create type public.financing_system as enum ('PRICE', 'SAC');

create table public.financings (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null references public.profiles (id) on delete cascade,
  description       text not null,
  institution       text,
  account_id        uuid not null references public.accounts (id) on delete restrict,
  category_id       uuid not null references public.categories (id) on delete restrict,
  down_payment_category_id uuid references public.categories (id) on delete restrict,
  household_id      uuid references public.households (id) on delete set null,
  asset_value       numeric(14,2) not null,
  down_payment      numeric(14,2) not null default 0,
  financed_amount   numeric(14,2) generated always as (asset_value - down_payment) stored,
  interest_rate     numeric(9,6) not null,        -- percentual por período
  interest_period   public.interest_period not null default 'MONTHLY',
  system            public.financing_system not null,
  installment_count integer not null,
  acquisition_date  date not null,
  first_due_date    date not null,
  notes             text,
  created_at, updated_at, created_by, updated_by,
  constraint financings_asset_value_positive check (asset_value > 0),
  constraint financings_down_payment_range check (down_payment >= 0 and down_payment < asset_value),
  constraint financings_rate_range check (interest_rate >= 0 and interest_rate < 100),
  constraint financings_installments_range check (installment_count between 1 and 480)
);
```

- `financed_amount` é coluna **gerada**, não guardada à mão. A seção 35 pede o campo e a seção 24 proíbe guardar o que é derivável; uma coluna gerada atende as duas: o campo existe, é consultável e filtrável, e não pode divergir de `asset_value - down_payment`.
- `down_payment < asset_value` garante que sempre há algo financiado. Entrada zero é aceita e não gera lançamento de entrada.
- `category_id` é a categoria de despesa das parcelas. `down_payment_category_id` é opcional e permite classificar a entrada de outro jeito (por exemplo "Imóvel" na entrada e "Financiamento" nas parcelas); quando nula, a entrada usa a mesma categoria das parcelas.
- `interest_period` é o enum já criado na v0.10, reaproveitado.
- Nada de `installment_amount`, `paid_installments`, `remaining_installments` ou `outstanding_balance` armazenados. Na SAC a parcela nem é constante, então guardar uma só seria falso; os quatro campos da seção 35 aparecem na tela como valores derivados.

### 3.3 Dois sistemas de amortização

| Sistema | Amortização da parcela k | Juros da parcela k | Parcela |
|---|---|---|---|
| `PRICE` | `parcela − juros` (cresce) | `saldo(k−1) · i` (cai) | `F · i / (1 − (1+i)^−n)`, constante |
| `SAC` | `F / n`, constante | `saldo(k−1) · i` (cai) | `F/n + juros`, decrescente |

Com `i = 0`, ambos degeneram para `F/n`. A soma dos juros na SAC tem forma fechada, `i · F · (n+1) / 2`, o que dá um teste independente da implementação — não é a mesma conta escrita duas vezes.

A conversão de taxa anual para mensal no financiamento é sempre **efetiva**, `i = (1 + a)^(1/12) − 1`, porque tanto a Price quanto a SAC capitalizam sobre o saldo devedor. Diferente da v0.10, aqui não há escolha de convenção: `financing_monthly_rate(p_rate, p_period)` não recebe sistema porque a resposta não depende dele.

Arredondamento: mesma convenção da v0.10, cálculo em centavos com a sobra na última parcela, para que as parcelas iniciais batam com o carnê do banco e o saldo termine exatamente em zero.

### 3.4 Matemática compartilhada, sem duplicar fórmula

A Price já está implementada e testada nos dois lados. Repetir a fórmula em `financings` criaria duas verdades que podem divergir em uma correção futura.

- No banco: `financing_installment_amounts` delega a Price para `loan_installment_amounts` e implementa apenas a SAC. Nenhuma migration da v0.10 é alterada.
- No frontend: a matemática pura sai de `features/loans/loan-math.ts` para `shared/finance/amortization.ts` (`monthlyRate`, `priceInstalment`, `buildSchedule`, `scheduleTotals`, `ScheduleRow`), ganha a SAC, e `loan-math.ts` passa a reexportar o que já expunha mais os rótulos próprios de empréstimo. Nenhum consumidor de empréstimos muda de import, e financiamentos não importa de dentro de outra feature.

O `AmortizationSystem` compartilhado é a união `'PRICE' | 'SAC' | 'SIMPLE'`; cada feature oferece só os seus na interface.

### 3.5 Vínculo com as movimentações

```sql
alter table public.transactions
  add column financing_id uuid references public.financings (id) on delete set null,
  add column financing_installment_number integer;

alter table public.transactions add constraint transactions_financing_shape check (
  case
    when financing_id is not null then
      kind = 'EXPENSE'
      and (financing_installment_number is null or financing_installment_number >= 1)
    else
      financing_installment_number is null
      or (kind = 'EXPENSE' and financing_installment_number >= 1)
  end
);

create unique index transactions_financing_down_payment_key
  on public.transactions (financing_id)
  where financing_id is not null and financing_installment_number is null;

create unique index transactions_financing_installment_key
  on public.transactions (financing_id, financing_installment_number)
  where financing_installment_number is not null;
```

Tudo é despesa: entrada e parcelas. O discriminador é o número — nulo é a entrada, `>= 1` é parcela. O ramo `else` repete a lição das v0.8 e v0.10: com `on delete set null`, apagar o financiamento deixaria um número órfão e quebraria a constraint, então a forma órfã é permitida e o histórico sobrevive.

Uma movimentação não pode pertencer a um empréstimo e a um financiamento ao mesmo tempo; uma constraint simples recusa os dois vínculos preenchidos.

### 3.6 Geração do cronograma

`generate_financing_schedule(p_financing_id uuid, p_with_down_payment boolean default true)`, com direitos de invocador como todas as geradoras desde a v0.7: a RLS decide cada insert, quem tem VIEW não gera. Cria a entrada, quando há entrada e categoria definida, e as parcelas ainda ausentes, com `on conflict do nothing` sobre os índices parciais. Rodar de novo não duplica; uma parcela apagada volta; uma parcela cancelada mantém o número e não é recriada. As datas usam `shift_month_day`, que já trata mês curto.

### 3.7 Saldo devedor, total restante e a parcela que a seção 35 pede

Três valores distintos, todos derivados, exibidos juntos porque confundi-los é o erro clássico:

- **Saldo devedor**: principal ainda não amortizado, lido da tabela de amortização na última parcela paga.
- **Total restante**: soma das parcelas em aberto, principal mais juros futuros.
- **Parcela**: na Price é uma só; na SAC a tela mostra a primeira, a próxima e a última, porque uma parcela única não existe.

`paid_installments` e `remaining_installments` vêm da contagem das parcelas lançadas por status, como na v0.10.

### 3.8 Interface

- `/financings`: cards de compromisso no topo (total restante, saldo devedor, próxima parcela); lista com bem, instituição, sistema, valor financiado, barra de progresso, próxima parcela e saldo devedor; ações gerar, editar e excluir.
- `/financings/:id`: tabela de amortização completa com parcela, juros, amortização e saldo, marcando o que está pago e sinalizando parcela lançada com valor diferente do previsto, sem reescrever nada.
- Formulário com prévia ao vivo: ao digitar bem, entrada, taxa, sistema e número de parcelas, mostra o valor financiado, a primeira e a última parcela, o total pago e o total de juros. A prévia deixa explícito, em uma linha, que o valor do bem não vira lançamento.
- Lista de movimentações ganha a marca de financiamento, como já acontece com empréstimo e parcelamento.
- Dashboard: card "Financiamentos" com o total restante, fora de contexto de grupo.

### 3.9 Estrutura Angular

```
src/app/shared/finance/amortization.ts        matemática pura compartilhada (+ SAC)
src/app/features/financings/
  financing-math.ts                           sistemas, rótulos e descrições
  financing.model.ts                          Financing, FinancingInput, buildFinancingView
  financing.repository.ts                     acesso a financings e às movimentações vinculadas
  financings.store.ts                         estado por contexto, geração e mutações
  financings-page/
  financing-detail-page/
  financing-form-dialog/
```

Rotas `/financings` e `/financings/:id` substituem o placeholder. Signals, `resource()` e `input()` como nas versões anteriores.

### 3.10 Migrations e versão

- `20260907210100_financings.sql`: enum, tabela, funções matemáticas, RLS, triggers de auditoria e validação de referências.
- `20260907210200_financing_schedule.sql`: colunas e constraints em `transactions`, índices e `generate_financing_schedule`.

Versão `0.11.0` em `package.json` e `environment.appVersion`. Seed com um financiamento SAC para desenvolvimento local.

## 4. Testes

pgTAP:

- `financing_math.test.sql`: parcela Price do valor financiado; primeira, intermediária e última parcela da SAC; soma dos juros da SAC contra a forma fechada `i·F·(n+1)/2`; taxa zero nos dois sistemas; soma das parcelas igual ao total; conversão anual efetiva com ida e volta de doze meses; sobra de centavos na última parcela; imutabilidade; `anon` não executa.
- `financings.test.sql`: proprietário cria, edita e exclui; `financed_amount` acompanha bem e entrada e não aceita escrita direta; entrada igual ou maior que o bem recusada; valor do bem não positivo, taxa e número de parcelas fora da faixa recusados; conta e categoria de outro usuário recusadas; categoria de receita recusada; VIEW lê e não escreve; MANAGE escreve; usuário sem relação e `anon` não leem.
- `generate_financing_schedule.test.sql`: gera entrada e N parcelas com valores e vencimentos corretos; gerar de novo não duplica; parcela apagada volta, cancelada não; geração sem entrada; entrada zero não gera lançamento; forma recusa parcela numerada que não é despesa e vínculo duplo com empréstimo; excluir o financiamento preserva os lançamentos.
- **Não duplicação**, o teste que dá nome à versão: depois de gerar, a soma das despesas vinculadas ao financiamento é `entrada + soma das parcelas`; nenhuma movimentação tem o valor do bem; `monthly_transaction_totals` do mês da aquisição registra a entrada e não o bem.
- `schema.test.sql` e `rls_enabled.test.sql` estendidos.

Vitest:

- `amortization`: mesma tabela de casos do pgTAP nos três sistemas; saldo chegando a zero na última parcela; parcela decrescente na SAC; entradas irregulares.
- `financing.model`: valor financiado, progresso, próxima parcela, total restante, saldo devedor a partir das parcelas lançadas, parcelas canceladas ignoradas.
- `FinancingsStore`: carga por contexto, geração, recarga após mutação, logout.
- `FinancingFormDialog`: prévia por sistema, validação de entrada maior que o bem, chamada ao store.
- `dashboard-summary`: entrada e parcelas contam como despesa; nenhuma receita aparece por causa do financiamento.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Dupla contabilização do bem | O valor do bem não tem lançamento; teste pgTAP soma o que existe e confere com entrada mais parcelas |
| Valor financiado divergindo | Coluna gerada, impossível de escrever fora da identidade |
| Fórmulas duplicadas divergindo | Price implementada uma vez, no banco e no frontend, reaproveitada pelos dois domínios |
| Cronograma gerado ignorando RLS | Função com direitos de invocador; teste com VIEW e MANAGE |
| Conta ou categoria de outro usuário | Trigger de validação reaproveitando os helpers existentes |
| Erro de centavos acumulado em 240 parcelas | Cálculo em centavos com sobra na última; teste de soma no prazo longo |
| Vínculo duplo empréstimo e financiamento | Constraint recusa os dois preenchidos |

## 6. Dependências

Nenhuma nova.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** tabela `financings` com valor financiado gerado; Price e SAC com fórmulas documentadas; regra de não duplicação estrutural e testada; colunas, constraint e índices em `transactions`; geração idempotente; página com lista, detalhe e formulário; card no dashboard; promoção da matemática para módulo compartilhado.

**PREPARAR AGORA:** `amortization.ts` e as funções do banco prontas para um terceiro sistema; `financing_id` seguindo o mesmo padrão de vínculo das v0.7, v0.8 e v0.10, o que dá à v0.12 um formato Excel uniforme para todas as origens; comprometimento futuro de parcelas de compra, empréstimo e financiamento com a mesma forma, pronto para unificação.

**FAZER DEPOIS:** correção monetária por índice; seguro e taxa de administração; amortização extraordinária com recálculo de prazo ou de parcela; refinanciamento; consórcio e leasing; venda do bem com quitação; controle patrimonial.

**NÃO NECESSÁRIO:** saldo devedor, parcela e contagens armazenados; cálculo de CET; SACRE sem caso de uso; integração bancária.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica as duas migrations ao projeto hospedado.
3. Verificação: `GET /rest/v1/financings` com a chave publicável retorna lista vazia; `anon` não executa `generate_financing_schedule`.
4. Push para `main`; Cloudflare Pages publica.
5. Validação: cadastrar um financiamento SAC, conferir a primeira e a última parcela contra uma calculadora, gerar o cronograma e confirmar que o mês da aquisição registra a entrada e não o valor do bem.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. O valor do bem nunca vira movimentação; só entrada e parcelas viram. É essa a regra de não duplicação da seção 35.
2. Financiamento não gera receita, ao contrário do empréstimo, porque o dinheiro vai do banco direto ao vendedor.
3. Dois sistemas: Price e SAC. SACRE e americano ficam de fora.
4. A conversão de taxa anual para mensal é sempre efetiva, porque os dois sistemas capitalizam.
5. `financed_amount` é coluna gerada; `installment_amount`, `paid_installments`, `remaining_installments` e `outstanding_balance` são derivados na tela.
6. A entrada é uma despesa própria, com categoria opcionalmente distinta das parcelas; entrada zero não gera lançamento.
7. A sobra de centavos vai para a última parcela.
8. Excluir o financiamento preserva os lançamentos e desfaz o vínculo.
9. A matemática de amortização passa a viver em `shared/finance`, sem alterar as migrations da v0.10.

A arquitetura da v0.11 do Baru Budget está pronta para implementação após sua aprovação.
