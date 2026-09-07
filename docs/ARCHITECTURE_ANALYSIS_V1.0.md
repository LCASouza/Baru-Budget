# ANÁLISE ARQUITETURAL — BARU BUDGET v1.0

Data: 2026-09-07. Estado real verificado, não presumido: v0.1 a v0.13 entregues; 32 arquivos pgTAP com 941 asserções e 64 arquivos Vitest com 392 testes; 22 funções `security definer` de 47 no schema `public`; nenhuma chave privada versionada e nenhuma menção a `service_role` no código Angular; **nenhum CI existe** (não há `.github/`), então hoje um push com teste quebrado publica assim mesmo; o `README.md` está parado na v0.10; e **dez versões têm verificação em produção adiada**, da v0.4 à v0.13, cada uma registrada como limitação conhecida. Bundle inicial de 945,31 kB dentro do orçamento de 1 MB.

---

## 1. Objetivo

Fechar a primeira versão estável para uso familiar real. Ao final, a família usa o Baru Budget no dia a dia com três garantias: nada entra em produção sem passar pelos testes, o que está escrito na documentação corresponde ao que o sistema faz, e a segurança foi revisada de ponta a ponta em vez de acreditada.

## 2. Escopo

Incluído:

- **CI**: GitHub Actions rodando lint, build, Vitest e pgTAP em cada push e pull request para `main`. Sem CI, "suíte final de testes" é decoração.
- **Revisão de segurança**: inventário das 22 funções `security definer`, conferência de `search_path` e de quem pode executar cada uma, varredura de segredo versionado, e revisão das chaves publicáveis.
- **Revisão completa de RLS**: a matriz da v0.13 estendida com os cenários que ela ainda não cobre, e um teste que prova que nenhuma view escapa do `security_invoker`.
- **Suíte final**: cobertura conferida contra a lista da seção 60, com o que faltar preenchido.
- **Documentação**: `README.md` atualizado, um `docs/ARCHITECTURE.md` descrevendo o sistema como ele é, e `PROJECT_STATUS.md` refletindo a v1.0.
- **Validação de backup e de import/export**: o ciclo completo executado contra o projeto hospedado, não só localmente.
- **Revisão desktop e mobile**: a verificação manual que a v0.13 deixou pendente, agora executada e registrada.
- **Deploy estável**: `main` protegida pelo CI, versão `1.0.0` e uma nota de release em `docs/versions/v1.0.md`.

Fora do escopo: qualquer item da seção 65 do Prompt Mestre (Open Banking, Pix, investimentos, apps nativos, multi-moeda e o resto); staging; monitoramento e telemetria em produção; testes end-to-end com navegador; migração de dados de terceiros.

## 3. Decisões

### 3.1 CI primeiro, porque tudo depende dele

Hoje um push com teste quebrado publica. A v1.0 pede "suíte final de testes" e "deploy estável", e as duas coisas só significam algo se houver um portão. Então o CI é o primeiro item, não o último.

```
.github/workflows/ci.yml
  push e pull_request em main
  node 24.18.0 (o mesmo do .node-version)
  npm ci
  npm run lint
  npm run build
  npm test
  supabase start + npm run test:db
```

O pgTAP exige a stack local, que roda em Docker no runner do GitHub. É o passo mais lento e é o mais valioso: são as 941 asserções que provam RLS e regra financeira.

O Cloudflare Pages continua publicando a partir de `main` por conta própria; o CI não publica nada. O que ele faz é dar o sinal para a branch. Proteger `main` exigindo o check é ação do administrador no GitHub, então fica declarada como passo manual, não como código.

### 3.2 Revisão de segurança com inventário, não com opinião

Três varreduras, cada uma virando teste ou documento:

| Frente | Como | Resultado |
|---|---|---|
| Funções `security definer` | Listar as 22, conferir `search_path` fixo e quem tem `execute` | Tabela em `docs/SECURITY_REVIEW_V1.0.md` e teste pgTAP que falha se alguma perder o `search_path` |
| Segredo versionado | Varrer histórico e árvore por chave privada, token e `service_role` | Registro do resultado; a chave publicável é pública por design e continua versionada |
| Superfície do cliente | Confirmar que o Angular usa só chave publicável e que nenhuma decisão de acesso vive nele | Registro, mais o teste transversal que já existe |

A revisão não é uma leitura: cada conclusão vira teste onde couber, porque uma leitura envelhece e um teste não.

### 3.3 RLS: fechar o que a matriz ainda não cobre

A matriz da v0.13 cobre os seis papéis da seção 61 sobre todas as tabelas. Faltam três coisas, todas verificáveis:

1. **Views**: `security_invoker` já é checado por um guarda, mas nenhuma prova que uma view não vaza linha de outro dono. Cada view ganha um caso: dois usuários, cada um vê só o seu.
2. **Funções**: as invocadoras (`generate_*`, `create_installment_purchase`, `set_transaction_allocations`) são testadas por feature. Um teste transversal garante que nenhuma delas é executável por `anon`.
3. **Colunas de auditoria**: nenhum teste prova que `created_by` não pode ser forjado no insert. Um caso por tabela com auditoria.

### 3.4 Documentação que descreve o que existe

O `README.md` está parado na v0.10, o que é pior do que não ter README: ele afirma algo falso. A v1.0 corrige e adiciona um `docs/ARCHITECTURE.md` com o que hoje só existe espalhado pelas treze análises:

- O modelo de dados e por que cada decisão estrutural existe (movimentação única para parcela, recorrência, cartão, empréstimo e financiamento; o valor do bem fora do razão; saldo sempre derivado).
- O modelo de acesso: `can_view`/`can_manage`, não transitividade, e por que a planilha nunca é autoridade.
- O contrato do formato Excel v1.
- Como rodar, testar e publicar.

A `DOCUMENTATION_POLICY.md` continua valendo: tudo em Markdown local, nada em ferramenta externa.

### 3.5 Validar backup e import/export contra o projeto hospedado

A v0.12 provou o ciclo completo contra o banco local, com as 153 linhas reais do seed. O que falta é o mesmo ciclo em produção, com os dados de verdade da família: exportar, editar no Excel, reimportar, conferir o preview e o resultado, e reimportar o arquivo intocado esperando zero alterações. É verificação manual e fica registrada com data em `docs/versions/v1.0.md`.

### 3.6 As dez verificações adiadas

Da v0.4 à v0.13, dez versões foram entregues com a verificação em produção adiada. Isso foi decisão sua e está registrado em cada arquivo de versão. A v1.0 é o lugar certo para fechá-las, porque "primeira versão estável para uso real" e "dez comportamentos nunca conferidos em produção" não convivem.

Decisão: `docs/versions/v1.0.md` traz uma lista única com os dez itens, um por linha, para serem percorridos de uma vez. Não é retrabalho: é a primeira passada de ponta a ponta no sistema completo, que só agora existe.

A v1.0 **não** é marcada como entregue enquanto essa lista tiver item aberto. É o único critério desta versão que depende inteiramente de você.

### 3.7 O que a v1.0 não muda

Nenhuma funcionalidade nova, nenhuma migration de schema salvo correção achada na revisão, nenhum redesenho. Se a revisão de segurança encontrar buraco, a correção vira migration própria documentada como bug corrigido, exatamente como a v0.13 previu e não precisou usar.

### 3.8 Estrutura

```
.github/workflows/ci.yml            lint, build, Vitest e pgTAP em cada push
docs/ARCHITECTURE.md                o sistema como ele é
docs/SECURITY_REVIEW_V1.0.md        inventário e conclusões da revisão
docs/versions/v1.0.md               nota de release e a lista das dez verificações
README.md                           atualizado
supabase/tests/security_surface.test.sql   search_path, execute e auditoria
supabase/tests/view_isolation.test.sql     cada view isola donos diferentes
```

Nenhuma pasta nova em `src/`. A v1.0 é sobre garantia, não sobre código de produto.

## 4. Testes

pgTAP:

- `security_surface.test.sql`: toda função `security definer` tem `search_path` fixo; nenhuma é executável por `anon`; as invocadoras de geração não são executáveis por `anon`; `created_by` e `updated_by` não podem ser forjados no insert em nenhuma tabela com auditoria.
- `view_isolation.test.sql`: para cada view de `public`, dois usuários com dados próprios enxergam apenas os seus.
- A matriz da v0.13 continua; estes dois arquivos cobrem o que ela não alcança.

Vitest: nenhum teste novo previsto. A cobertura é conferida contra a lista da seção 60 e, se faltar caso, ele é escrito; a conferência é registrada na revisão.

CI: os quatro comandos rodando em cada push. O primeiro sinal verde é a prova de que o portão funciona.

Manual, registrado com data:

- As dez verificações adiadas da v0.4 à v0.13.
- O ciclo de backup e import/export em produção.
- A revisão desktop e mobile que a v0.13 deixou pendente: leitor de tela, teclado, três larguras e contraste.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Push quebrado chegando em produção | CI rodando lint, build, Vitest e pgTAP antes do merge |
| Função `security definer` sem `search_path` | Teste transversal falhando por função |
| Função privilegiada executável por `anon` | Teste transversal sobre todas as `security definer` e geradoras |
| View vazando linha de outro dono | Um caso de isolamento por view |
| Auditoria forjada no insert | Um caso por tabela com `created_by` |
| Segredo versionado | Varredura de árvore e histórico registrada na revisão |
| Documentação afirmando o que não é verdade | README e arquitetura reescritos a partir do estado real |
| Comportamento nunca conferido em produção | As dez verificações listadas como critério de conclusão |

## 6. Dependências

Nenhuma nova em runtime. O CI usa ações oficiais do GitHub e a CLI do Supabase, que já é dependência de desenvolvimento.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** CI com os quatro comandos; revisão de segurança com inventário e testes; isolamento de views e superfície de funções em pgTAP; README e `ARCHITECTURE.md`; nota de release; as dez verificações adiadas listadas como critério; validação de backup e import/export em produção.

**PREPARAR AGORA:** o CI como lugar onde qualquer verificação futura entra; `SECURITY_REVIEW_V1.0.md` como modelo para revisões periódicas; `ARCHITECTURE.md` como o documento que a v1.1 atualiza em vez de recriar.

**FAZER DEPOIS:** testes end-to-end com navegador; monitoramento e alerta em produção; staging; cobertura de código com meta numérica; release automatizado com tag.

**NÃO NECESSÁRIO:** qualquer item da seção 65; multi-ambiente complexo; painel de métricas; auditoria externa nesta versão.

## 8. Passos de entrega

1. `.github/workflows/ci.yml` e o primeiro sinal verde.
2. Revisão de segurança escrita, com os dois arquivos pgTAP novos.
3. Documentação: README, `ARCHITECTURE.md`, `PROJECT_STATUS.md`.
4. Versão `1.0.0` em `package.json` e `environment.appVersion`.
5. Local: `npm run db:reset`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
6. Push para `main`; Cloudflare Pages publica; CI verde.
7. Validação sua: as dez verificações adiadas, o ciclo de Excel em produção e a revisão desktop e mobile.

Dois passos exigem ação do administrador: proteger `main` exigindo o check do CI no GitHub, e executar a validação do passo 7.

## 9. Decisões bloqueadoras

Nenhuma para começar. Premissas adotadas, reversíveis:

1. CI no GitHub Actions, rodando os quatro comandos, sem publicar nada.
2. Proteger `main` é ação manual sua; o CI não consegue se auto-exigir.
3. A revisão de segurança vira teste onde couber, e documento onde não couber.
4. Nenhuma funcionalidade nova e nenhuma migration, salvo correção achada na revisão.
5. `ARCHITECTURE.md` descreve o sistema real; as treze análises continuam como histórico das decisões.
6. As dez verificações adiadas são critério de conclusão da v1.0, e só você pode fechá-las.
7. A validação de Excel em produção usa os dados reais da família, não um seed.
8. Cobertura é conferida contra a seção 60, sem meta numérica.

A arquitetura da v1.0 do Baru Budget está pronta para implementação após sua aprovação.
