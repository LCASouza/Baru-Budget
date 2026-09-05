# ANÁLISE ARQUITETURAL — BARU BUDGET v0.1

Data: 2026-09-05. Estado real verificado: repositório com protótipo visual aprovado (Angular 22.1, Angular Material 22.1, dados mockados), sem Supabase, sem migrations, sem autenticação. Docker 29 e Supabase CLI 2.116 disponíveis na máquina de desenvolvimento.

---

## 1. Entendimento do produto

O Baru Budget é uma aplicação web privada de gestão financeira pessoal e familiar, usada por um pequeno grupo, acessível por navegador em desktop e celular. A arquitetura não depende de pessoas específicas.

Regras estruturais que orientam todas as versões:

- **Propriedade financeira.** Cada registro financeiro pertence a um usuário (`owner_user_id`). Por padrão, um usuário só acessa dados próprios.
- **Dois mecanismos de compartilhamento distintos.** `households` agrupam pessoas em um conjunto financeiro compartilhado; `financial_access_grants` dão a outra pessoa acesso VIEW ou MANAGE às finanças pessoais do proprietário. Nunca se misturam.
- **MANAGE finanças ≠ MANAGE segurança.** Quem tem MANAGE opera lançamentos, mas não altera grants, credenciais ou configurações de segurança.
- **Não transitividade.** Acesso recebido nunca se propaga a terceiros.
- **Movimentação como entidade central.** `transactions` com `transaction_kind` em INCOME, EXPENSE, TRANSFER e SETTLEMENT. Cartão, parcela, gasto fixo, empréstimo e financiamento são contexto de origem, nunca direção financeira.
- **Quem pagou ≠ quem é responsável.** `transaction_allocations` dividem responsabilidade; `settlements` registram acertos sem alterar a despesa original.
- **Sem dupla contabilização.** Compra no cartão é EXPENSE; pagamento de fatura é TRANSFER. Empréstimo aumenta caixa, não renda. Financiamento não registra aquisição e parcela como duas despesas.
- **Benefícios separados de dinheiro livre.** Contas do tipo BENEFIT compõem um saldo próprio.
- **Excel oficial e versionado.** Formato próprio, round-trip por UUID, preview antes de importar, nunca exclusão por ausência. Congelado apenas na v0.12.
- **Segurança no banco.** A interface não é autoridade. Toda tabela financeira tem RLS; policies, constraints e funções seguras reforçam cada regra.
- **Mobile desde o início.** Requisito, não adaptação futura.

A v0.1 estabelece a fundação técnica: banco, migrations, schema base (profiles, categories, accounts), tipos financeiros, cliente Supabase, ambientes e testes iniciais. Não implementa dashboard real nem autenticação.

---

## 2. Stack

Confirmada sem alterações:

| Camada | Tecnologia | Versão / observação |
|---|---|---|
| Frontend | Angular | 22.1, standalone components, zoneless, TypeScript strict, Reactive Forms, Signals |
| UI | Angular Material | 22.1, tema Material 3 já aprovado no protótipo |
| Backend / API | Supabase | Projeto local via CLI 2.116 (Docker); projeto hospedado a partir da v0.2 |
| Banco | PostgreSQL | Versão fornecida pelo Supabase (17) |
| Identidade | Supabase Auth | E-mail e senha (v0.2) |
| Autorização | Row Level Security | Habilitado desde a criação de cada tabela |
| SDK | @supabase/supabase-js | 2.115 |
| Hospedagem | Cloudflare Pages | Deploy automático a partir de `main` (v0.2) |
| Runtime de build | Node.js | 24 |

Nenhum backend próprio. Edge Functions só quando houver lógica privilegiada real (nenhuma prevista até a v0.12).

---

## 3. Arquitetura geral

```text
GitHub (main)
  └─ push ──▶ Cloudflare Pages (build Angular, hospedagem estática)
                 └─ navegador ──▶ Angular (UI, casos de uso, validação de cliente)
                                     └─ supabase-js ──▶ Supabase Auth (identidade, JWT)
                                                     ──▶ PostgREST (API tipada)
                                                            └─ PostgreSQL (dados, constraints, funções, triggers)
                                                                   └─ RLS (autorização por linha, usando auth.uid())
```

Responsabilidades:

- **Angular** renderiza, coordena casos de uso, valida entrada e formata (BRL, dd/MM/yyyy). Nunca decide acesso.
- **Supabase Auth** autentica e emite o JWT que o PostgREST repassa ao banco.
- **PostgreSQL** garante invariantes com constraints, triggers e funções. Cálculos que precisam ser confiáveis fora da UI podem ser expostos como funções SQL quando fizer sentido.
- **RLS** é a única autoridade de autorização. Policies comparam `owner_user_id` (e, a partir da v0.4, grants e memberships) com `auth.uid()`.
- **Chaves.** O frontend usa apenas a chave pública (anon/publishable). A chave de service role nunca entra no Angular nem no repositório.

---

## 4. Arquitetura Angular

Estrutura já existente no protótipo, mantida, com as adições da v0.1:

```text
src/app/
├── core/
│   ├── layout/            shell, sidebar, header, bottom-nav, more-menu-sheet, viewport.service
│   ├── navigation/        nav-items, navigation.service, app-title.strategy
│   ├── supabase/          NOVO: supabase-client.ts (token + provider), database.types.ts (gerado)
│   └── finance/           NOVO: transaction-kind.ts, account-type.ts, category-kind.ts
├── shared/components/     summary-card, period-filter, feature-placeholder
└── features/
    ├── dashboard/         página com mocks (até v0.3–v0.5)
    ├── transactions/      transaction-form-dialog com mocks (até v0.3)
    └── ...                placeholders
src/environments/          NOVO: environment.ts, environment.development.ts
```

Camadas e responsabilidades, aplicadas à medida que cada uma ganha consumidor real:

| Camada | Responsabilidade | Aparece em |
|---|---|---|
| Component | UI, eventos, binding | protótipo |
| Facade / application service | coordena casos de uso e estado da feature (signals) | v0.3 |
| Repository | único ponto que chama `supabase.from(...)`, tipado pelo `Database` gerado | v0.2 (profile), v0.3 (categories, accounts, transactions) |
| Domain utilities | funções puras: faturas, parcelas, juros, allocations, dashboard | v0.6 em diante |
| Supabase client | `SupabaseClient<Database>` criado uma vez a partir do environment e injetado por token | v0.1 |

Regras: nenhuma chamada `supabase.from` fora de repositories; nenhuma pasta `services/` global; sem Clean Architecture cerimonial. Tipos financeiros vivem em `core/finance` porque são vocabulário transversal, não uma feature.

---

## 5. Modelo PostgreSQL

Convenções válidas para todas as tabelas:

- Schema `public`, nomes em `snake_case`, chave primária `uuid` com `gen_random_uuid()`.
- Valores monetários em `numeric(14,2)`. Datas financeiras em `date`; eventos auditáveis em `timestamptz`.
- Auditoria: `created_at`, `updated_at` (trigger `set_updated_at`), `created_by`, `updated_by` (default `auth.uid()`).
- `owner_user_id uuid not null references public.profiles(id) on delete cascade`.
- RLS habilitado na mesma migration que cria a tabela.
- Conjuntos fechados como `enum` do PostgreSQL (ver seção 9).

Tabelas por versão:

| Tabela | Versão | Situação na v0.1 |
|---|---|---|
| `profiles` | v0.1 | criar |
| `categories` | v0.1 | criar |
| `accounts` | v0.1 | criar |
| `transactions` | v0.3 | não criar; apenas o enum `transaction_kind` |
| `households`, `household_members` | v0.4 | não criar |
| `financial_access_grants` | v0.4 | não criar |
| `credit_cards` | v0.6 | não criar |
| `installments` | v0.7 | não criar |
| `fixed_expenses`, `recurring_incomes` | v0.8 | não criar |
| `transaction_allocations`, `settlements` | v0.9 | não criar |
| `loans` | v0.10 | não criar |
| `financings` | v0.11 | não criar |

Não há `household_id` em categories e accounts na v0.1: contas e categorias são pessoais; o compartilhamento em grupo é definido na v0.4 sem exigir alteração dessas tabelas (a v0.4 decide se o grupo terá categorias próprias).

---

## 6. Profiles

```sql
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

- `id` é o mesmo do usuário em `auth.users`. Nenhuma senha, hash, token ou sessão é armazenada.
- Trigger `after insert on auth.users` executa `public.handle_new_user()` (`security definer`, `set search_path = ''`), que cria o profile com `display_name` vindo de `raw_user_meta_data->>'display_name'` ou do prefixo do e-mail, e em seguida semeia as categorias padrão (seção 7).
- RLS: `select` e `update` apenas do próprio registro (`id = auth.uid()`). Não há policy de `insert` nem `delete` para clientes; a criação é feita pelo trigger e a exclusão acompanha `auth.users`.
- `created_by`/`updated_by` não se aplicam: o profile é sempre do próprio usuário.

---

## 7. Categories

```sql
create type public.category_kind as enum ('INCOME', 'EXPENSE');

create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  kind          public.category_kind not null,
  name          text not null check (char_length(name) between 1 and 60),
  icon          text,
  color         text check (color ~ '^#[0-9a-fA-F]{6}$'),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid not null default auth.uid() references public.profiles (id),
  updated_by    uuid not null default auth.uid() references public.profiles (id)
);

create unique index categories_owner_kind_name_key
  on public.categories (owner_user_id, kind, lower(name));
```

- Categorias são personalizáveis e por usuário. Nenhuma categoria fica fixa em enum; apenas o `kind` é fechado.
- Categorias padrão são semeadas por usuário na criação do profile, pela função `public.seed_default_categories(profile_id uuid)`: receitas (Salário, Benefício, Trabalho extra, Presente, Reembolso, Rendimentos, Outros) e despesas (Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Assinaturas, Compras, Outros). Depois de semeadas, são registros comuns do usuário, editáveis.
- `active = false` desativa sem excluir, preservando histórico futuro de transações.
- RLS: `select`, `insert`, `update`, `delete` com `owner_user_id = auth.uid()` (`with check` em insert e update).

---

## 8. Accounts

```sql
create type public.account_type as enum ('BANK', 'CASH', 'BENEFIT', 'OTHER');

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.profiles (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 60),
  type            public.account_type not null,
  institution     text,
  opening_balance numeric(14,2) not null default 0,
  color           text check (color ~ '^#[0-9a-fA-F]{6}$'),
  active          boolean not null default true,
  created_at, updated_at, created_by, updated_by   -- mesmo padrão de categories
);

create unique index accounts_owner_name_key on public.accounts (owner_user_id, lower(name));
```

- `type = BENEFIT` identifica vale alimentação, vale refeição e similares. O saldo monetário (BANK + CASH) e o saldo de benefícios são calculados separadamente a partir da v0.3/v0.5.
- `opening_balance` é dado de entrada (saldo inicial informado pelo usuário), não saldo derivado. O saldo atual será sempre calculado: `opening_balance + entradas − saídas ± transferências`. Nenhum saldo corrente é armazenado.
- Não há contas padrão semeadas: o usuário cadastra as suas (v0.3).
- RLS igual a categories.

---

## 9. Tipos financeiros

```sql
create type public.transaction_kind as enum ('INCOME', 'EXPENSE', 'TRANSFER', 'SETTLEMENT');
```

- Criado na v0.1 como vocabulário oficial; usado pela tabela `transactions` na v0.3.
- Origem/contexto (À vista, Cartão, Gasto fixo, Empréstimo, Financiamento) não entra no enum. Na v0.3+ será representado por colunas de referência (`credit_card_id`, `fixed_expense_id`, `loan_id`, `financing_id`) adicionadas na versão que cria cada tabela, com constraint garantindo no máximo uma origem por movimentação.
- `transaction_status` (PENDING, PAID, OVERDUE, CANCELLED) é criado apenas na v0.3, junto da tabela que o usa.
- Decisão: enums do PostgreSQL para conjuntos fechados (`category_kind`, `account_type`, `transaction_kind`). Motivos: tipos TypeScript gerados automaticamente como uniões literais; conjuntos realmente fechados; inclusão de valor via `alter type ... add value` em migration dedicada. A alternativa `text + check` fica registrada como possível se a manutenção de enums se mostrar custosa.
- No Angular, `core/finance/` define as uniões (`TransactionKind`, `AccountType`, `CategoryKind`) e os rótulos em pt-BR usados pela UI. Os tipos gerados do banco são a fonte; as uniões manuais são verificadas contra eles por tipagem.

---

## 10. Supabase

Configuração inicial (local):

1. `npx supabase init` cria `supabase/config.toml`, `supabase/migrations/` e `supabase/seed.sql`.
2. `npx supabase start` sobe PostgreSQL, Auth, PostgREST e Studio em Docker (API em `http://127.0.0.1:54321`, Studio em `54323`).
3. `npx supabase db reset` recria o banco aplicando todas as migrations e o seed.
4. `npx supabase gen types typescript --local > src/app/core/supabase/database.types.ts` gera os tipos; o arquivo é versionado.
5. `npx supabase test db` executa os testes pgTAP em `supabase/tests/`.

Scripts npm correspondentes: `db:start`, `db:stop`, `db:reset`, `db:types`, `test:db`.

Projeto hospedado: criado no painel do Supabase antes da v0.2 (região São Paulo), vinculado com `npx supabase link` e atualizado com `npx supabase db push` a partir da máquina de desenvolvimento, após revisão. Cadastro público será desabilitado no painel e em `config.toml` na v0.2, quando o fluxo de criação controlada de usuários for definido.

---

## 11. Auth futuro

A v0.1 prepara a v0.2 sem implementá-la:

- Profile criado automaticamente por trigger no cadastro, com categorias padrão.
- Policies baseadas em `auth.uid()` desde a v0.1: quando o login existir, o acesso funciona sem alterar o schema.
- Cliente Supabase configurado com persistência de sessão padrão do SDK (localStorage) e renovação automática de token.
- Ambientes com URL e chave pública prontos.
- O usuário mockado no header (`shell.mock.ts`) permanece até a v0.2 substituí-lo pelo profile real via `AuthService` e `ProfileRepository`.
- Rotas: a v0.2 adiciona `/login` fora do `Shell` e um guard funcional na rota do `Shell`. A estrutura atual de rotas já comporta isso sem refatoração.

Nada de login, sessão ou guard é implementado na v0.1.

---

## 12. RLS futuro

Mínimo necessário na v0.1:

- `enable row level security` em `profiles`, `categories` e `accounts`, na migration que cria cada tabela.
- Policies owner-only descritas nas seções 6 a 8. Sem policy para `anon`: usuários não autenticados não leem nada.
- Nenhuma policy de grants ou households ainda. Na v0.4, as policies owner-only de categories e accounts são substituídas por funções `stable security definer` do tipo `public.can_view(owner uuid)` e `public.can_manage(owner uuid)`, que encapsulam proprietário, grants VIEW/MANAGE e memberships, garantindo não transitividade em um único ponto testável.
- Teste pgTAP transversal: toda tabela do schema `public` deve ter RLS habilitado. Esse teste impede que uma tabela futura seja criada sem proteção.

---

## 13. UI inicial

Entregue e aprovada no protótipo: shell com sidebar (desktop), trilho (tablet) e bottom navigation com bottom sheet (mobile); header com título, período, contexto e usuário; tema Material 3 com Inter; dashboard com mocks; formulário de nova movimentação; placeholders por feature.

Na v0.1 a UI não muda funcionalmente. Ajustes previstos:

- Rodapé da sidebar passa a exibir a versão da aplicação (`v0.1.0`, a partir de uma constante de ambiente) no lugar de "Protótipo visual".
- Página inicial temporária continua sendo o dashboard mockado até a v0.3 (saldo e movimentações reais) e a v0.5 (dashboard completo).

---

## 14. Testes

pgTAP (`supabase/tests/*.sql`, executados com `supabase test db`):

- Schema: existência de tabelas, colunas, enums, índices únicos e constraints (tamanho de nome, formato de cor, `opening_balance` numérico).
- Triggers: inserir em `auth.users` cria profile e categorias padrão; `updated_at` muda em update.
- RLS: para cada tabela, proprietário faz `select`/`insert`/`update`/`delete`; outro usuário autenticado não lê nem altera; `anon` não lê nada; cliente não insere nem exclui profile.
- Transversal: toda tabela em `public` tem RLS habilitado.

Os testes simulam usuários inserindo linhas mínimas em `auth.users` e alternando `role` e `request.jwt.claims` dentro da transação, sem dependências externas.

Vitest (`ng test`):

- Smoke da aplicação (existente).
- `ViewportService`: mapeamento de breakpoints.
- `NavigationService`: resolução de título da rota.
- `PeriodFilter`: rótulo do mês em pt-BR.
- `IncomeExpenseChart`: escala, ticks e geometria das barras (funções puras).
- Provider do cliente Supabase: criação a partir do environment.

Não há testes de HTML trivial.

---

## 15. Migrations

- Ferramenta: Supabase CLI, arquivos `supabase/migrations/YYYYMMDDHHMMSS_nome.sql`, aplicados em ordem.
- Forward-only: uma migration aplicada em produção nunca é editada; correções entram como nova migration.
- Cada migration é coesa: helpers, tipos, uma tabela com suas policies, etc.

Migrations da v0.1:

| Arquivo | Conteúdo |
|---|---|
| `..._helpers.sql` | função `public.set_updated_at()` |
| `..._types.sql` | enums `category_kind`, `account_type`, `transaction_kind` |
| `..._profiles.sql` | tabela, RLS, policies, `handle_new_user`, trigger em `auth.users` |
| `..._categories.sql` | tabela, índice único, RLS, policies, trigger `updated_at`, `seed_default_categories` |
| `..._accounts.sql` | tabela, índice único, RLS, policies, trigger `updated_at` |

`supabase/seed.sql` fica vazio na v0.1 (usuários locais serão criados pelo fluxo de auth na v0.2; os testes criam os próprios). Após cada migration, `database.types.ts` é regenerado e versionado no mesmo commit.

---

## 16. Environments

| Ambiente | Arquivo | Supabase |
|---|---|---|
| local development | `src/environments/environment.development.ts` | `http://127.0.0.1:54321` + chave anon local padrão do CLI (pública e determinística) |
| production | `src/environments/environment.ts` | URL e chave pública do projeto hospedado (preenchidas na v0.2) |

- `angular.json` recebe `fileReplacements` na configuração `development`; `ng serve` já usa essa configuração.
- Conteúdo dos environments: `production`, `appVersion`, `supabaseUrl`, `supabaseAnonKey`. Nenhum segredo.
- A chave anon/publishable é pública por definição e pode ser versionada; a segurança está no RLS. A chave de service role é usada apenas pelo CLI local e nunca é versionada.
- Sem staging.

---

## 17. Cloudflare

Somente preparação para a v0.2:

- `public/_redirects` com `/* /index.html 200` para fallback de SPA.
- `.node-version` com `24` para o build do Pages.
- Build: `npm ci && npm run build`; diretório de saída `dist/baru-budget/browser`.
- A conexão do repositório GitHub ao Cloudflare Pages, variáveis e domínio ficam para a v0.2.

---

## 18. Segurança

| Risco | Mitigação na v0.1 |
|---|---|
| Vazamento da service role key | Nunca no Angular nem no repositório; CLI usa login próprio; `.env` ignorado |
| Tabela criada sem RLS | Convenção "RLS na migration de criação" + teste pgTAP transversal |
| Função `security definer` com `search_path` mutável | `set search_path = ''` e nomes qualificados em todas as funções |
| Trigger em `auth.users` falhando e bloqueando cadastro | Trigger simples, coberto por teste |
| Cadastro público aberto por padrão no Supabase | Ambiente apenas local na v0.1; desabilitar no hospedado na v0.2 |
| Validação apenas no cliente | Constraints e `with check` nas policies |
| Chave pública versionada | Aceitável por definição; RLS é a fronteira; rotação possível no painel |
| Fontes e ícones do Google Fonts | Dependência externa; avaliar auto-hospedagem na v0.13 |
| Logs com dados sensíveis | Nenhum log de dados financeiros ou pessoais; erros técnicos apenas |
| Cadeia de dependências | `package-lock.json` versionado; `npm ci` no build |

---

## 19. Dependências

Adicionar:

| Pacote | Tipo | Consumidor |
|---|---|---|
| `@supabase/supabase-js` ^2.115 | runtime | `core/supabase/supabase-client.ts` |
| `supabase` ^2.116 | dev | scripts `db:*`, `test:db`, geração de tipos |

Opcional recomendado: `angular-eslint` (dev), via `ng add`, para lint padronizado desde a fundação.

Não adicionar: biblioteca de estado, biblioteca de gráficos, biblioteca de datas (Intl e `formatDate` bastam até a v0.6), SSR, i18n em runtime.

---

## 20. Estrutura de arquivos

Após a v0.1:

```text
.
├── .node-version
├── angular.json                 (+ fileReplacements)
├── package.json                 (+ scripts db:*, test:db)
├── public/
│   ├── favicon.ico
│   └── _redirects
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/
│   │   ├── ..._helpers.sql
│   │   ├── ..._types.sql
│   │   ├── ..._profiles.sql
│   │   ├── ..._categories.sql
│   │   └── ..._accounts.sql
│   └── tests/
│       ├── schema.test.sql
│       ├── rls_enabled.test.sql
│       ├── profiles.test.sql
│       ├── categories.test.sql
│       └── accounts.test.sql
├── src/
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.development.ts
│   └── app/
│       ├── core/
│       │   ├── finance/
│       │   │   ├── transaction-kind.ts
│       │   │   ├── account-type.ts
│       │   │   └── category-kind.ts
│       │   ├── supabase/
│       │   │   ├── supabase-client.ts
│       │   │   └── database.types.ts
│       │   ├── layout/ ...
│       │   └── navigation/ ...
│       ├── shared/ ...
│       └── features/ ...
└── docs/
    ├── MASTER_PROMPT.md
    ├── DOCUMENTATION_POLICY.md
    ├── PROJECT_STATUS.md
    ├── VISUAL_PROTOTYPE.md
    ├── ARCHITECTURE_ANALYSIS_V0.1.md
    └── versions/
        └── v0.1.md
```

---

## 21. Sugestões classificadas

**NECESSÁRIO AGORA**

- Supabase CLI como devDependency e projeto local inicializado.
- Migrations de helpers, tipos, profiles, categories e accounts, com RLS e policies owner-only.
- Trigger de criação de profile e semeadura de categorias padrão.
- Tipos do banco gerados e versionados.
- Cliente Supabase injetável e environments local/produção.
- Testes pgTAP (schema, triggers, RLS, RLS transversal) e testes Vitest listados.
- Scripts npm para banco e testes.
- `docs/versions/v0.1.md` e `PROJECT_STATUS.md` atualizados ao longo da versão.

**PREPARAR AGORA**

- Enum `transaction_kind` (usado na v0.3).
- `opening_balance` em accounts (usado no cálculo de saldo da v0.3).
- `public/_redirects` e `.node-version` para o Cloudflare Pages.
- Versão da aplicação no rodapé da sidebar.
- `angular-eslint`.

**FAZER DEPOIS**

- Login, sessão, guards e substituição do usuário mockado (v0.2).
- Repositories e facades (v0.2 profile; v0.3 categories, accounts, transactions).
- `transactions` e `transaction_status` (v0.3).
- Funções `can_view`/`can_manage`, households e grants (v0.4).
- Dashboard com dados reais (v0.5).
- CI com build, testes e `supabase test db` (roadmap: v1.0; pode ser antecipado quando o projeto hospedado existir).
- Cabeçalhos de segurança (`public/_headers`), auto-hospedagem de fontes, tema escuro (v0.13).

**NÃO NECESSÁRIO**

- Backend próprio, Edge Functions, SSR.
- Biblioteca de estado global.
- Soft delete e tabela de audit log.
- Staging.
- Categorias globais compartilhadas entre usuários (as padrão são semeadas por usuário).

---

## 22. Decisões bloqueadoras

Nenhuma. Premissas adotadas, todas reversíveis por migration ou configuração:

1. Enums do PostgreSQL para `category_kind`, `account_type` e `transaction_kind`.
2. `opening_balance` como dado de entrada em `accounts`; saldo corrente sempre calculado.
3. Categorias padrão semeadas por usuário no trigger de criação do profile.
4. Chave pública do Supabase versionada nos environments; service role nunca versionada.
5. A v0.1 não entrega telas de cadastro de contas e categorias; o CRUD pertence à v0.3, conforme o roadmap.
6. O projeto Supabase hospedado será criado antes da v0.2; a v0.1 trabalha apenas com o ambiente local em Docker.

A arquitetura da v0.1 do Baru Budget está pronta para implementação após sua aprovação.
