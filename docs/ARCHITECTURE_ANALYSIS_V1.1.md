# ANÁLISE ARQUITETURAL — BARU BUDGET v1.1

Data: 2026-09-08. Estado real verificado, não presumido: v1.0 está `IN_PROGRESS`, com dez verificações em produção ainda abertas; a suíte tem 34 arquivos pgTAP com 973 asserções e 64 arquivos Vitest com 392 testes; `financings` existe desde a v0.11 com `financed_amount` gerado por `asset_value - down_payment`; o cronograma é calculado por `financing_installment_amounts` no banco e por `buildSchedule` em `shared/finance/amortization.ts`, que se espelham; não existe view de saldo de financiamento — `outstandingPrincipal` é derivado em TypeScript a partir do cronograma projetado; e `generate_financing_schedule` grava as parcelas uma única vez, com valor fixo.

Caso real que motivou a versão, medido contra o contrato da Caixa de um financiamento habitacional de 420 meses:

| Grandeza | Modelo atual | Contrato real | Divergência |
|---|---|---|---|
| Parcela (principal + juros) | R$ 1.082,63 | R$ 1.125,09 | +R$ 42,46 |
| Encargos mensais | não modelado | R$ 56,59 | seguro R$ 31,59 + taxa R$ 25,00 |
| Parcela cobrada | R$ 1.082,63 | R$ 1.181,68 | +R$ 99,05 |
| Saldo devedor após 26 parcelas | R$ 176.082,71 | R$ 183.670,08 | +R$ 7.587,37 (+4,31%) |

A divergência de 4,31% aparece com 6% do contrato decorrido e cresce, porque o saldo real é reajustado por índice e o projetado não.

---

## 1. Objetivo

Fazer o Baru Budget representar um financiamento indexado sem mentir sobre ele. Ao final, o saldo devedor e a parcela mostrados na tela correspondem ao que o credor cobra, e quando não correspondem o sistema diz por quê, em vez de exibir uma projeção com aparência de fato.

## 2. Escopo

Incluído:

- **Encargos da parcela**: seguro e taxa operacional passam a existir no modelo e a compor o valor da movimentação gerada.
- **Correção monetária observada**: registro do que o credor informou em cada competência — saldo devedor, parcela, seguro e taxa — e reprojeção do cronograma a partir dessa observação.
- **Saldo devedor observado**: quando existe observação, o saldo exibido é o observado, não o projetado.
- **Reprojeção sem reescrita do passado**: parcelas já pagas são fato e não mudam; apenas as pendentes a partir da observação são atualizadas.
- **Origem visível na interface**: a tela de financiamento distingue valor projetado de valor observado, com a data da última observação.
- **Empréstimos**: `loans` recebe o mesmo modelo de observação, porque o problema é idêntico e duas formas de descrever a mesma coisa seriam pior que uma.
- **Excel schema version 2**: o workbook sobe de versão, com conversor da versão 1, para acomodar a aba e as colunas novas.

Fora do escopo: qualquer item da seção 65 do Prompt Mestre; previsão de índice futuro; consulta automática de TR, IPCA ou IGPM em serviço externo; renegociação, portabilidade, amortização extraordinária e quitação antecipada.

## 3. Decisões

### 3.1 São dois problemas, não um

O contrato diverge por duas causas independentes, e tratá-las juntas produziria um modelo confuso.

A primeira é determinística: seguro e taxa operacional são cobrados todo mês e hoje simplesmente não existem no modelo. No contrato medido são R$ 56,59 por mês, R$ 23.767,80 ao longo de 420 parcelas. Não há nada a estimar — é uma coluna que falta.

A segunda é indexação: o saldo é corrigido por um índice contratual cujo valor futuro ninguém conhece. É aqui que a modelagem precisa de cuidado.

### 3.2 Correção é observada, nunca projetada

A decisão central da versão. Projetar correção exigiria escolher uma taxa futura para a TR, e o número escolhido apareceria na tela com a mesma autoridade de um saldo real. Um erro de projeção em contrato de 35 anos é grande, e o usuário não teria como distinguir o que é fato do que é palpite.

O sistema passa a registrar o que o credor informou, e só isso:

```text
financing_statements
  id
  financing_id
  competence           date     mês da observação, dia 1
  outstanding_balance  numeric  saldo devedor informado
  installment_amount   numeric  parcela de principal + juros
  insurance_amount     numeric  seguro do mês
  fee_amount           numeric  taxa operacional do mês
  remaining_count      integer  parcelas restantes informadas
  notes                text
  unique (financing_id, competence)
```

Entre observações o cronograma continua projetado, mas a partir do saldo observado mais recente e das parcelas restantes informadas, não do valor financiado original. Assim a projeção erra pouco no curto prazo e se corrige a cada observação, em vez de acumular erro por 35 anos.

O nome `financing_statements` é deliberado: a tabela guarda extrato, não ajuste. Ela não corrige nada — ela registra o que foi informado.

### 3.3 O cronograma vira uma função por partes

`buildSchedule` hoje recebe principal, taxa, contagem e sistema, e devolve o cronograma inteiro. Passa a receber também as observações, e o cronograma fica dividido em trechos:

```text
contrato ──► primeira observação ──► segunda observação ──► ...
   projetado          projetado a partir do saldo observado
```

Cada observação reancora principal e contagem. A taxa continua sendo a do contrato, porque o que o índice corrige é o saldo, não o juro.

A função permanece pura e continua espelhada entre TypeScript e SQL. É o mesmo contrato de sempre: `input → calculation → output`, sem dependência de componente Angular, conforme a seção 59 do Prompt Mestre.

### 3.4 Parcela paga é fato e não se reescreve

Quando uma observação chega, as parcelas com status `PAID` ficam intocadas: elas registram dinheiro que já saiu da conta. Só as pendentes a partir da competência da observação são atualizadas, e a atualização é idempotente — rodar duas vezes não duplica nem altera nada.

Isso preserva a regra que a v0.11 já estabeleceu: o histórico é o que aconteceu, não o que o cronograma acha que deveria ter acontecido.

### 3.5 Encargos entram na movimentação, com a composição visível

O valor da movimentação gerada passa a ser `parcela + seguro + taxa`, porque é o que efetivamente sai da conta, e o extrato bancário precisa bater. A composição não se perde: a tela de detalhe do financiamento mostra as três parcelas do valor separadamente, a partir do cronograma e da observação.

Guardar apenas a parcela pura deixaria o saldo da conta errado todo mês; guardar apenas o total esconderia quanto do pagamento é juro. As duas informações existem, em lugares diferentes e com papéis diferentes.

### 3.6 O saldo devedor passa a ter procedência

`outstandingPrincipal` deixa de ser sempre projetado:

| Situação | Saldo exibido |
|---|---|
| Sem observação | Projetado pelo contrato, como hoje |
| Com observação | Saldo observado, menos as amortizações projetadas desde então |

A interface mostra qual dos dois está em uso e a data da observação. Um saldo projetado apresentado como se fosse extrato é exatamente o defeito que esta versão existe para corrigir, e seria incoerente substituí-lo por outro número sem procedência.

### 3.7 Principal contratado e valor liberado são grandezas diferentes

Empréstimo pessoal com IOF financiado tem duas quantias, e o modelo atual só tem uma. Medido num contrato real: valor escolhido R$ 6.000,00, IOF R$ 127,30, valor contratado R$ 6.127,30. O juro incide sobre o contratado, mas o que entra na conta é o escolhido.

`loans.principal` é usado nos dois papéis: é a base do cronograma e é o valor da movimentação de liberação, lançada como `INCOME` por `generate_loan_schedule`. Preencher o principal com o valor contratado acerta a parcela e infla a conta em R$ 127,30; preencher com o valor liberado acerta a conta e erra a parcela em R$ 12,72 por mês.

A v1.1 separa as duas: o principal continua sendo a base do cálculo e a liberação passa a ter valor próprio, com o tributo financiado registrado como o que é. É o mesmo defeito de forma que a seção 9 descreve na entrada do financiamento, e a correção é a mesma — quantias com papéis distintos precisam de campos distintos.

## 4. Testes

Vitest, sobre funções puras:

- `buildSchedule` sem observação produz exatamente o cronograma de hoje, garantindo que a v0.11 não regride.
- Uma observação no meio do contrato reancora saldo e contagem, e as parcelas anteriores permanecem idênticas.
- Duas observações produzem três trechos, cada um partindo do saldo do anterior.
- Observação com `remaining_count` diferente do restante projetado vence a projeção.
- Composição da parcela: `parcela + seguro + taxa` fecha com o valor da movimentação, ao centavo.
- Reprojeção não altera parcela `PAID`, e é idempotente.
- Caso real da Caixa como fixture: 179.200,00, 420 meses, 6,6971% a.a., observação de saldo 183.670,08 com 394 restantes, parcela 1.125,09, seguro 31,59, taxa 25,00 — a parcela projetada a partir da observação fica dentro de R$ 5,00 da cobrada.

pgTAP:

- `financing_statements` com RLS espelhando `financings`: `VIEW` lê e não escreve, `MANAGE` escreve, terceiro não vê.
- `unique (financing_id, competence)` recusa duas observações do mesmo mês.
- Saldo, parcela, seguro e taxa recusam valor negativo.
- A reprojeção no banco e a de TypeScript concordam sobre a mesma fixture, que é o teste que impede os dois lados de divergirem.
- `security_surface.test.sql` e `view_isolation.test.sql` continuam passando com a tabela nova, sem exceção adicionada.

## 5. Segurança

`financing_statements` não carrega `owner_user_id`: o dono é o do financiamento, e as políticas resolvem por `financing_id`, do mesmo jeito que `transaction_allocations` já faz. Isso mantém a regra da seção 3 do Prompt Mestre — a autorização vive no banco, nunca no cliente.

A tabela entra nas colunas de auditoria (`created_by`, `updated_by`) e nos dois gatilhos, como qualquer tabela com auditoria, e o teste transversal que exige os dois gatilhos passa a cobri-la sem alteração.

Nenhum dado novo é sensível: saldo e parcela de um financiamento já são visíveis para quem enxerga o financiamento. Nada é exportado para fora do que a seção 49 já permite.

## 6. Dependências

Nenhuma dependência nova. Não há consulta a serviço externo, não há biblioteca financeira adicional, e o cálculo continua sendo aritmética sobre inteiros de centavos com as funções que já existem em `shared/money/money.ts`.

O formato Excel é afetado: `financing_statements` é uma aba nova e colunas novas entram em `Financiamentos`. Isso é mudança de contrato do workbook, que a v0.12 congelou na versão 1. Ver seção 9.

## 7. Sugestões classificadas

**Aceito e movido para o escopo.** Aplicar o mesmo modelo de observação a `loans`. A tabela é análoga e o problema é idêntico em empréstimo com correção. Custo pequeno, porque a função de cronograma já é compartilhada.

**Recomendado depois.** Um lembrete mensal para registrar a observação. Sem alimentação periódica o modelo degrada como o atual, só que mais devagar. Fica melhor numa versão que trate de lembretes em geral.

**Não recomendado.** Importar TR ou IPCA de serviço externo. Cai em "integração automática" da seção 65, cria dependência de disponibilidade de terceiro e não resolve o problema: o índice publicado não determina sozinho o saldo, que depende também da data de aniversário e das regras do contrato. A observação do extrato é mais simples e mais correta.

**Não recomendado.** Deixar o usuário digitar a parcela direto na movimentação. Resolveria a tela do mês e destruiria o cronograma, o saldo devedor e o total de juros, que são a razão de o financiamento ser uma entidade e não uma despesa fixa.

## 8. Passos de entrega

1. Migração: `financing_statements`, com RLS, auditoria e restrições.
2. `financing_installment_amounts` e `generate_financing_schedule` passam a considerar observações; a reprojeção é idempotente.
3. Colunas de encargo em `financings`, com valor padrão zero, para que todo financiamento existente continue idêntico.
4. `shared/finance/amortization.ts`: `buildSchedule` por partes, espelhando o banco.
5. `financing.model.ts`: saldo com procedência, composição da parcela e data da observação.
6. Interface: registro de observação na tela de detalhe, e exibição da procedência do saldo.
7. Excel: aba nova e colunas novas, com a decisão de versão de schema resolvida na seção 9.
8. Testes das seções 4, depois `npm run lint`, `npm run build`, `npm test`, `npm run test:db`.
9. `docs/versions/v1.1.md` e `docs/PROJECT_STATUS.md`.

## 9. Decisões bloqueadoras

Resolvidas em 2026-09-08.

1. **Sequência.** A v1.0 é fechada primeiro. A v1.1 só começa depois que as dez verificações em produção estiverem concluídas e a v1.0 estiver `DELIVERED`, mantendo o fluxo da seção 12 da política de documentação.

2. **Versão do schema do Excel.** O workbook sobe para a versão 2, com conversor da versão 1, dentro da v1.1. É a opção mais cara e a única coerente com a regra que a v0.12 estabeleceu.

3. **Empréstimos.** Incluídos no escopo.

4. **Composição da aquisição.** Os números do contrato fecham exatamente:

   | Componente | Valor |
   |---|---|
   | Valor do imóvel (`asset_value`) | R$ 224.000,00 |
   | Recursos próprios | R$ 36.462,42 |
   | FGTS | R$ 8.026,58 |
   | Desconto FGTS/União | R$ 311,00 |
   | Entrada (`down_payment`) | R$ 44.800,00 |
   | Financiado (`financed_amount`, gerado) | R$ 179.200,00 |

   A entrada precisa ser R$ 44.800,00 para o valor financiado sair correto, mas só R$ 36.462,42 saíram de conta corrente: FGTS e subsídio não são saída de caixa. Lançar a entrada inteira como despesa inflaria o mês da aquisição em R$ 8.337,58.

   `generate_financing_schedule` já aceita `p_with_down_payment`, então o cronograma é gerado sem a despesa de entrada e a saída real de R$ 36.462,42 é registrada como movimentação própria. A v1.1 avalia se a composição merece ser modelada, em vez de resolvida por omissão.

5. **Cadastro do financiamento.** Feito depois da v1.1, para não registrar um contrato com divergência conhecida de R$ 7.587,37 no saldo e R$ 99,05 na parcela, e ter de recadastrá-lo em seguida.
