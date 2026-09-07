# ANÁLISE ARQUITETURAL — BARU BUDGET v0.12

Data: 2026-09-07. Estado real verificado: v0.11 entregue. O modelo está completo para o formato: `accounts`, `categories`, `credit_cards`, `transactions` (31 colunas, cobrindo cartão, parcelamento, recorrência, contraparte, empréstimo e financiamento), `transaction_allocations`, `fixed_expenses`, `recurring_incomes`, `loans`, `financings`, `households`, `profiles`. Toda escrita passa por RLS com `can_view`/`can_manage`. Baseline: 314 testes Vitest, 883 asserções pgTAP. Nenhuma tela de dados ou backup existe ainda.

---

## 1. Objetivo

Congelar o **Baru Budget Excel Format v1**: um workbook oficial, versionado e legível, que o usuário exporta, edita no Excel e importa de volta sem duplicar nada. Ao final, o usuário baixa `baru-budget-backup-2026-09-07.xlsx`, corrige três valores e uma categoria na planilha, reimporta, vê o preview dizer "3 atualizados, 1 novo, 412 sem alteração, 0 inválidos", confirma, e o banco fica exatamente com o que ele editou. Reimportar o arquivo sem editar nada não muda uma linha sequer.

## 2. Escopo

Incluído:

- Contrato único de ida e volta declarado em um só módulo, consumido por exportação e importação.
- Workbook com aba `Info` (metadados), aba `Legenda` (valores aceitos) e as abas de dados.
- Exportação completa do proprietário do contexto financeiro, com paginação, gerando o arquivo de backup.
- Importação com preview obrigatório: novos, atualizados, sem alteração e inválidos, com detalhamento dos inválidos.
- Identidade estável por UUID: id conhecido atualiza, id ausente cria, id vazio gera novo.
- Ausência nunca apaga.
- Colunas amigáveis e colunas técnicas lado a lado; nome resolve o vínculo quando o id está vazio.
- Tela `Configurações → Dados`, com exportar, importar, preview e resultado.
- Testes Vitest do contrato, da classificação e do ciclo completo escrever/ler.

Fora do escopo: exportação em JSON; agendamento de backup; upload para nuvem; importação de planilhas de terceiros ou da planilha antiga do usuário; exclusão via Excel; importação de permissões, grupos ou perfis; edição de dados de outro usuário sem MANAGE; schema version 2 e conversores.

## 3. Decisões

### 3.1 Tudo roda no navegador, com a sessão do usuário

Exportação e importação usam o mesmo cliente `supabase-js` já autenticado. Cada leitura e cada escrita passa pela RLS, linha a linha. Não existe Edge Function, não existe service role, não existe caminho privilegiado.

É isso que satisfaz a seção 48 do Prompt Mestre de forma estrutural: **a planilha não é fonte de autoridade porque a planilha nunca chega perto de uma decisão de acesso**. Se alguém editar um `owner_user_id` no arquivo, não acontece nada, porque a coluna não existe no formato (3.4). Se alguém inventar um id de outro usuário, o banco recusa, e o preview já avisa antes.

### 3.2 Um contrato só, consumido pelos dois lados

A seção 40 exige que importação e exportação usem o MESMO contrato. Em vez de confiar na disciplina, o contrato vira dado:

```ts
export interface SheetColumn<Row> {
  readonly key: string;          // chave técnica, cabeçalho da coluna
  readonly header: string;       // rótulo legível em português
  readonly type: 'text' | 'number' | 'money' | 'date' | 'boolean' | 'uuid' | 'enum';
  readonly role: 'key' | 'editable' | 'readonly';
  readonly enumValues?: readonly string[];
  readonly read: (row: Row) => unknown;             // banco  → célula
  readonly write?: (cell: unknown, draft: Draft) => void;  // célula → banco
}

export interface SheetSpec<Row> {
  readonly name: string;         // nome da aba
  readonly table: string;
  readonly importable: boolean;
  readonly columns: readonly SheetColumn<Row>[];
}

export const WORKBOOK_V1: readonly SheetSpec<never>[] = [...];
```

Exportar percorre `columns` chamando `read`. Importar percorre `columns` chamando `write`. Uma coluna nova é uma linha nova nessa declaração e aparece nos dois lados no mesmo commit. Um teste percorre o contrato e falha se alguma coluna `editable` não tiver `write`.

### 3.3 As abas, decididas sobre o modelo real

A seção 45 lista nomes candidatos e manda **não fixá-los antes de revisar o modelo real na v0.12**. Revisado, três da lista caem e o motivo é o mesmo nos três casos: aquilo não é uma entidade, é uma movimentação.

| Aba | Tabela | Importável | Por quê |
|---|---|---|---|
| `Info` | — | não | Metadados da seção 46 |
| `Legenda` | — | não | Valores aceitos de cada enum e colunas somente leitura |
| `Contas` | `accounts` | sim | |
| `Categorias` | `categories` | sim | |
| `Cartoes` | `credit_cards` | sim | |
| `Movimentacoes` | `transactions` | sim | Inclui parcelas, instâncias de recorrência, compras de cartão, parcelas de empréstimo e de financiamento e acertos |
| `Divisoes` | `transaction_allocations` | sim | |
| `GastosFixos` | `fixed_expenses` | sim | |
| `ReceitasRecorrentes` | `recurring_incomes` | sim | |
| `Emprestimos` | `loans` | sim | |
| `Financiamentos` | `financings` | sim | |
| `Grupos` | `households` | não | Contexto para leitura; pertencer a um grupo é permissão |
| `Pessoas` | `profiles` | não | Nome de quem aparece em divisões e acertos |

Sem aba `Parcelas`: desde a v0.7 cada parcela é uma movimentação real, e as colunas `installment_group_id`, `installment_number` e `installment_count` viajam em `Movimentacoes`. Sem aba `Acertos`: desde a v0.9 um acerto é uma movimentação de tipo `SETTLEMENT`, com `counterparty_user_id` e `settlement_direction` nas mesmas colunas. Criar abas separadas exigiria reconstruir movimentações a partir de duas fontes na importação, que é exatamente a duplicação que o formato existe para evitar.

`Grupos` e `Pessoas` são exportadas porque sem elas as colunas `grupo` e `pessoa` viram uuid solto e a planilha deixa de ser legível. Não são importáveis: são permissão e identidade, território da seção 48.

### 3.4 O que nunca entra no arquivo

Três grupos de colunas ficam de fora, cada um por um motivo diferente:

| Fora | Motivo |
|---|---|
| `owner_user_id` | A seção 48 proíbe a planilha decidir de quem é o dado. O dono é sempre o proprietário do contexto atual, escrito na aba `Info` |
| `created_at`, `updated_at`, `created_by`, `updated_by` | Auditoria é do sistema; reimportar auditoria antiga seria mentir sobre quem alterou |
| Segredos da seção 49 | Não existem no `public`: nenhuma senha, hash, token, JWT, chave ou grant é exportável porque nenhuma aba os alcança. `financial_access_grants` e `household_members` não têm aba |

`financed_amount`, coluna gerada, é exportada como somente leitura para a planilha fechar as contas na tela, e ignorada na importação.

E-mails não são exportados. `Pessoas` leva id e nome de exibição, o suficiente para ler a planilha e insuficiente para identificar alguém fora do sistema.

### 3.5 Legível e técnica ao mesmo tempo

A seção 47 quer `description`, `amount`, `category`, `account`, `date`, `status` legíveis, preservando `id`, `category_id`, `account_id`. Cada vínculo aparece duas vezes, o nome antes do id:

```
id | descricao | valor | data | status | tipo | conta | account_id | categoria | category_id | ...
```

Regra de resolução, declarada e testada:

1. `account_id` preenchido vence sempre. Se não pertencer ao proprietário, a linha é inválida.
2. `account_id` vazio e `conta` preenchida: resolve pelo nome, se houver **exatamente uma** conta ativa com aquele nome.
3. Nome que não resolve, ou que resolve para duas contas: linha inválida, com o motivo escrito.

A importação **nunca cria conta, categoria ou cartão a partir de um nome digitado**. Criar registros por engano de digitação é pior do que recusar a linha e dizer o porquê. Criar uma conta nova continua possível: basta uma linha nova na aba `Contas`.

Datas viajam como datas do Excel, valores como números com duas casas, ativos como booleanos. Enums viajam com o valor do banco (`EXPENSE`, `PAID`, `SAC`), curtos e legíveis, e a aba `Legenda` lista todos os valores aceitos de cada um. Traduzir enums custaria uma tabela de tradução em dois sentidos que pode divergir; o custo não se paga.

### 3.6 Identidade e merge

A seção 42 define o comportamento e ele vira uma função pura, `classifyRow`:

| Situação | Resultado |
|---|---|
| `id` vazio | **Novo**, com uuid gerado no cliente |
| `id` existe no banco e o conteúdo difere | **Atualizado** |
| `id` existe no banco e o conteúdo é igual | **Sem alteração**, nada é enviado |
| `id` não existe no banco e a linha é válida | **Novo** com aquele id |
| `id` existe, mas é de outro proprietário | **Inválido**, motivo explícito |
| Linha com campo obrigatório ausente ou fora do domínio | **Inválido**, motivo explícito |

"Sem alteração" é comparação de verdade: normaliza a linha da planilha, compara campo a campo com o registro atual e, se for igual, não envia nada. É isso que faz reimportar um export intocado ser um no-op, o teste mais forte do formato.

### 3.7 Ausência nunca apaga

A seção 43 é absoluta: nenhuma linha do código de importação emite `delete`. As linhas do banco ausentes do arquivo aparecem no preview como contagem informativa ("412 registros no banco não estão no arquivo e serão mantidos") e nada mais. A aba `Info` repete a frase, para quem abrir o arquivo meses depois.

### 3.8 Preview obrigatório

A seção 44 exige preview e proíbe importação silenciosa. O fluxo tem duas fases separadas por um clique:

```
arquivo → ler → validar → classificar → PREVIEW → confirmar → aplicar → resultado
```

O preview mostra, por aba, novos, atualizados, sem alteração e inválidos, e permite abrir a lista de inválidos com linha, coluna e motivo. Antes do preview, valida o cabeçalho: `application = Baru Budget` e `schema_version = 1`. Arquivo de outra aplicação ou de outra versão é recusado inteiro, com a mensagem dizendo o que foi encontrado.

Nada é escrito antes da confirmação. O botão de confirmar fica desabilitado quando não há nada a aplicar.

### 3.9 Aplicação: mesma porta que a aplicação usa

A importação escreve pelas mesmas rotas do dia a dia, nunca por atalhos:

- Contas, categorias, cartões, gastos fixos, receitas recorrentes, empréstimos, financiamentos e movimentações: `upsert` na tabela, com a RLS decidindo.
- Divisões: pela função `set_transaction_allocations`, agrupadas por movimentação. A soma das divisões tem invariante com trigger de constraint adiada desde a v0.9; mandar linha solta quebraria. Reaproveitar a função existente respeita o invariante do jeito exato que a aplicação respeita.

Ordem fixa de dependência, declarada no contrato: contas e categorias, cartões, empréstimos e financiamentos, gastos fixos e receitas recorrentes, movimentações, divisões.

**A importação não é uma transação única.** Cada aba é aplicada em lotes e o resultado diz exatamente o que entrou. Uma falha no meio deixa o que já entrou, e isso é seguro por causa da ordem: só sobra registro de referência sem uso, nunca movimentação órfã. Reimportar o mesmo arquivo termina o serviço, porque o merge é idempotente por id. Uma transação única exigiria mover o mapeamento inteiro para PL/pgSQL, duplicando o contrato que a decisão 3.2 acabou de unificar, ou uma RPC genérica que recebe nome de tabela, que é um buraco de autoridade. O preço não compensa.

O banco continua sendo o juiz: a validação do cliente é cortesia para o preview, e linhas recusadas pelas constraints aparecem no resultado com o erro, nunca engolidas.

### 3.10 Exportação completa e paginada

Backup precisa ser completo, então a exportação não usa os stores nem o período selecionado: lê direto do repositório, tabela por tabela, com `range()` até esgotar. A DEBT-002 registra o teto de 1000 linhas do PostgREST; a paginação resolve isso para a exportação e a dívida continua aberta para a tela de movimentações.

Arquivo: `baru-budget-backup-YYYY-MM-DD.xlsx`, conforme a seção 50. A aba `Info` leva `application`, `schema_version`, `exported_at`, `app_version`, `owner_user_id`, `owner_name` e o aviso de que ausência não apaga.

Em contexto compartilhado a exportação funciona e o arquivo é dos dados daquele proprietário, com o nome dele no `Info`, para ninguém confundir com o próprio backup. Com permissão VIEW a importação fica desabilitada, e a RLS recusaria de qualquer forma.

### 3.11 O que a v1 congela

Congelam: nomes das abas, chaves e ordem das colunas, contrato do `Info` e significado de célula vazia (vazio é "não informado", nunca "apague"). A partir daqui, mudar qualquer um desses itens é `schema_version = 2` com conversor, não edição da v1. O teste do contrato guarda isso: uma lista literal de abas e colunas esperadas quebra se alguém mexer sem querer.

### 3.12 Estrutura Angular

```
src/app/features/data-transfer/
  workbook-schema.ts          contrato v1: abas, colunas, ordem, enums
  workbook-info.ts            metadados e validação de compatibilidade
  export.service.ts           leitura paginada e montagem do workbook
  import-parser.ts            arquivo → linhas normalizadas
  import-plan.ts              classificação pura: novo/atualizado/igual/inválido
  import.service.ts           aplicação na ordem de dependência
  data-transfer.store.ts      estado das duas operações
  data-page/                  Configurações → Dados
  import-preview/             preview e confirmação
```

Rota `/settings/data`, quarta aba de Configurações. As bibliotecas de planilha entram por `import()` dinâmico dentro de `export.service.ts` e `import-parser.ts`, então o bundle inicial não cresce: elas só são baixadas quando o usuário abre a tela e clica.

## 4. Testes

Vitest:

- `workbook-schema`: toda aba importável tem coluna `id`; toda coluna `editable` tem `write`; nenhuma coluna proibida (`owner_user_id`, auditoria) aparece; a ordem de dependência é topológica; a lista congelada de abas e colunas da v1 bate exatamente.
- `import-plan`: cada linha da tabela da decisão 3.6, incluindo id de outro proprietário, id desconhecido, id vazio, data ilegível, valor negativo, enum fora do domínio, nome que não resolve e nome ambíguo.
- Resolução por nome: id vence o nome; nome resolve quando único; nome duplicado invalida; nome inexistente invalida e não cria nada.
- `import.service`: ordem de aplicação; divisões agrupadas por movimentação chamando `set_transaction_allocations`; nenhuma chamada de `delete` em nenhum caminho; erro do banco aparece no resultado.
- **Ida e volta completa**, o teste que dá nome à versão: fixtures de todas as tabelas → escrever workbook → ler o arquivo gerado → classificar contra as mesmas fixtures → tudo "sem alteração", zero novos, zero atualizados, zero inválidos.
- `workbook-info`: aplicação errada, versão errada e `Info` ausente recusam o arquivo com mensagem específica.
- `DataTransferStore` e `ImportPreview`: preview antes de aplicar, confirmação obrigatória, VIEW não importa.

pgTAP: nenhuma migration nesta versão, então nada muda no banco. Os testes existentes continuam sendo a garantia de que a importação não escapa da RLS, e um caso novo em `grants.test.sql` fecha o argumento: um usuário com VIEW tentando `upsert` em cada tabela exportável recebe negativa.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Planilha concedendo acesso | Nenhuma aba de grants, membros ou perfis editáveis; `owner_user_id` não existe no formato |
| Escrever no dado de outro usuário | Proprietário vem do contexto, nunca do arquivo; RLS decide cada linha; preview marca id alheio como inválido |
| Segredo vazando no export | Nenhuma coluna de credencial é alcançável pelas abas; teste do contrato recusa coluna fora da lista |
| Importação silenciosa | Preview obrigatório entre ler e aplicar; confirmação explícita |
| Perda de dado por ausência | Nenhum `delete` no código de importação; contagem informativa no preview |
| Duplicação na reimportação | Merge por uuid; "sem alteração" não envia nada; teste de ida e volta |
| Invariante de divisão quebrado | Importação pela função `set_transaction_allocations`, agrupada por movimentação |
| Arquivo incompatível | `application` e `schema_version` validados antes de qualquer classificação |
| Bundle inicial crescendo | Bibliotecas carregadas por `import()` dinâmico na tela de dados |

## 6. Dependências

Duas, ambas com consumidor real e ambas feitas para navegador:

| Pacote | Versão | Consumidor | Peso |
|---|---|---|---|
| `write-excel-file` | 4.1.1 | `export.service.ts` | 1,8 MB descompactado, depende só de `fflate` |
| `read-excel-file` | 9.3.10 | `import-parser.ts` | 2,5 MB descompactado, depende de `fflate`, `saxen`, `unzipper-esm`, `worker-f` |

Descartadas: `exceljs`, que arrasta `archiver`, `unzipper`, `tmp` e `readable-stream`, dependências de Node que exigiriam polyfill no navegador; e `xlsx` no npm, parado na 0.18.5, versão com vulnerabilidade conhecida de prototype pollution.

Ambas entram por importação dinâmica, fora do bundle inicial.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** contrato único declarativo; abas decididas sobre o modelo real; exportação completa paginada com nome de backup; aba `Info` e aba `Legenda`; preview obrigatório com detalhamento dos inválidos; merge por uuid com "sem alteração" real; ausência não apaga; colunas amigáveis com resolução por nome; divisões pela função existente; tela em Configurações; teste de ida e volta.

**PREPARAR AGORA:** `schema_version` já lido e validado, para a v2 ter onde se apoiar; contrato declarativo pronto para gerar documentação da planilha; leitura paginada reaproveitável pela paginação de movimentações da DEBT-002.

**FAZER DEPOIS:** exportação em JSON; exclusão explícita via planilha com coluna de intenção; importação em transação única; backup agendado; importação da planilha antiga do usuário com mapeamento assistido; exportar só o período visível.

**NÃO NECESSÁRIO:** editor de planilha embutido; sincronização contínua com Excel; formato proprietário binário; abas separadas de parcelas e acertos.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. Nenhuma migration: o banco não muda nesta versão e `npx supabase db push` não tem o que aplicar.
3. Verificação local: exportar o seed completo, editar três linhas na planilha, reimportar, conferir o preview e o resultado; reimportar o arquivo intocado e confirmar zero alterações.
4. Push para `main`; Cloudflare Pages publica.
5. Validação: em produção, exportar o backup, abrir no Excel, editar, reimportar e conferir preview, resultado e dados.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. Tudo roda no navegador com a sessão do usuário; sem Edge Function e sem service role.
2. Contrato declarativo único, consumido por exportação e importação.
3. Sem abas `Parcelas` e `Acertos`: parcelas e acertos são movimentações desde a v0.7 e a v0.9.
4. `Grupos` e `Pessoas` são exportadas para leitura e não são importáveis.
5. `owner_user_id` e as colunas de auditoria não existem no formato.
6. Enums viajam com o valor do banco, documentados na aba `Legenda`.
7. Nome só resolve vínculo quando o id está vazio, e nunca cria registro novo.
8. "Sem alteração" é comparação campo a campo e não gera escrita.
9. Nenhum `delete` em nenhum caminho de importação.
10. A importação é aplicada em lotes por aba, em ordem de dependência, e é idempotente em vez de transacional.
11. Divisões são importadas pela função `set_transaction_allocations`.
12. `write-excel-file` e `read-excel-file`, carregadas por importação dinâmica.
13. A v1 congela abas, colunas e o contrato do `Info`; mudanças futuras são `schema_version = 2`.

A arquitetura da v0.12 do Baru Budget está pronta para implementação após sua aprovação.
