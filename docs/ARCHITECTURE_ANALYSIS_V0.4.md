# ANÁLISE ARQUITETURAL — BARU BUDGET v0.4

Data: 2026-09-06. Estado real verificado: v0.3 entregue e validada em produção (movimentações, contas, categorias, perfil, período global). Policies owner-only em `accounts`, `categories` e `transactions` (`(select auth.uid()) = owner_user_id`); `profiles` visível apenas ao próprio usuário. Trigger `validate_transaction_references` garante que categoria e contas pertencem ao dono. View `account_balances` com `security_invoker`. Stores Angular (`AccountsStore`, `CategoriesStore`, `TransactionsStore`) carregam dados pelo usuário autenticado e pelo mês. Seletor de contexto do header ainda mockado (`shell.mock.ts`). Rotas `/households` e `/sharing` em placeholder. Baseline: 107 testes Vitest, 180 asserções pgTAP.

---

## 1. Objetivo

Permitir que finanças sejam compartilhadas de duas formas distintas: grupos (`households`), em que pessoas participam de um conjunto financeiro comum, e concessões pessoais (`financial_access_grants`), em que um usuário dá a outro acesso VIEW ou MANAGE às próprias finanças. Ao final, o usuário cria um grupo, adiciona membros, marca movimentações como do grupo e vê as movimentações do grupo; concede VIEW ou MANAGE a outra pessoa; troca de contexto no header entre "Minhas finanças", cada grupo e cada "Finanças de X"; e toda regra é imposta pelo banco, com não transitividade e separação entre administrar finanças e administrar segurança.

## 2. Escopo

Incluído:

- Banco: `households`, `household_members`, `financial_access_grants`, enums, funções `can_view`, `can_manage`, `is_household_member`, `is_household_admin` e auxiliares; `transactions.household_id`; policies completas substituindo as owner-only em `accounts`, `categories`, `transactions` e `profiles`; busca de usuário por e-mail; guarda do último administrador; seed local com segundo usuário, grupo e concessão.
- Contexto financeiro real no header: pessoal, grupos e finanças compartilhadas comigo; persistido no navegador; stores de contas, categorias e movimentações reagem ao contexto.
- Movimentações: campo "Grupo" no formulário; listagem em contexto de grupo (quem registrou, categoria, sem contas); modo somente leitura para VIEW e para lançamentos de outros membros; "Registrado por" e "Alterado por" quando diferentes do dono.
- Contas e categorias em contexto compartilhado: leitura em VIEW, administração em MANAGE.
- Página Grupos: criar, renomear, adicionar membro por e-mail, alterar papel, remover, sair.
- Página Compartilhamento: conceder VIEW ou MANAGE por e-mail, alterar permissão, revogar; lista do que foi compartilhado comigo com atalho para abrir o contexto.
- Testes pgTAP para cada cenário da seção 61 do MASTER_PROMPT e testes Vitest para contexto, stores, páginas e formulários.
- Migrations aplicadas ao projeto hospedado antes do deploy.

Fora do escopo: dashboard por contexto e gráficos (v0.5), `transaction_allocations` e acertos entre pessoas (v0.9), convites por e-mail com aceite, categorias ou contas pertencentes ao grupo, papéis além de ADMIN e MEMBER, audit log completo, notificações.

## 3. Decisões

### 3.1 Dois mecanismos, duas tabelas

Grupo e concessão pessoal nunca se misturam:

- `household_members` responde "quem participa do grupo" e dá visibilidade apenas aos lançamentos marcados com `household_id` daquele grupo.
- `financial_access_grants` responde "quem pode ver ou administrar as finanças pessoais de um dono" e dá visibilidade a tudo que pertence ao dono (`owner_user_id`), inclusive contas, saldos e categorias.

Participar de um grupo não revela contas, saldos nem lançamentos pessoais dos outros membros.

### 3.2 Households

```sql
create type public.household_role as enum ('ADMIN', 'MEMBER');
create type public.household_member_status as enum ('ACTIVE', 'INACTIVE');

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  updated_by uuid not null default auth.uid() references public.profiles (id)
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.household_role not null default 'MEMBER',
  status       public.household_member_status not null default 'ACTIVE',
  joined_at    timestamptz not null default now(),
  created_at, updated_at, created_by, updated_by,
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id) where status = 'ACTIVE';
```

- Quem cria o grupo vira ADMIN por trigger `after insert` (`security definer`), porque a policy de inserção em `household_members` exige ser administrador e um grupo recém-criado ainda não tem nenhum.
- ADMIN renomeia o grupo, adiciona e remove membros e altera papéis. MEMBER vê o grupo, os membros e os lançamentos do grupo, e pode sair.
- Remover ou sair marca `status = INACTIVE`, preservando o histórico dos lançamentos que a pessoa registrou no grupo. Só membros ACTIVE veem o grupo.
- Trigger `ensure_household_admin` impede rebaixar ou desativar o último ADMIN ativo.
- Sem `household_id` em contas e categorias: o grupo não possui contas nem categorias próprias. Um lançamento do grupo usa a conta e a categoria pessoais de quem o registrou.

### 3.3 Financial access grants

```sql
create type public.access_permission as enum ('VIEW', 'MANAGE');

create table public.financial_access_grants (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.profiles (id) on delete cascade,
  granted_user_id uuid not null references public.profiles (id) on delete cascade,
  permission      public.access_permission not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  created_by, updated_by,
  constraint grants_not_self check (owner_user_id <> granted_user_id)
);
create unique index grants_active_pair_key
  on public.financial_access_grants (owner_user_id, granted_user_id) where revoked_at is null;
create index grants_granted_user_idx on public.financial_access_grants (granted_user_id) where revoked_at is null;
```

- Uma concessão ativa por par; revogar preenche `revoked_at` e mantém o histórico. Mudar de VIEW para MANAGE atualiza a linha.
- Policies apenas para o dono: `select` para dono e beneficiário; `insert`, `update` e `delete` somente com `owner_user_id = auth.uid()`. Quem tem MANAGE não toca em concessões (MANAGE finanças ≠ MANAGE segurança).

### 3.4 Funções de autorização

Todas `stable`, `security definer`, `set search_path = ''`, executáveis apenas por `authenticated`:

```sql
can_view(owner uuid)             owner = auth.uid() ou concessão ativa VIEW/MANAGE de owner para auth.uid()
can_manage(owner uuid)           owner = auth.uid() ou concessão ativa MANAGE de owner para auth.uid()
is_household_member(h uuid)      auth.uid() é membro ACTIVE de h
is_household_admin(h uuid)       auth.uid() é ADMIN ACTIVE de h
is_active_member(h uuid, u uuid) u é membro ACTIVE de h (usada pela trigger de movimentações)
shares_household_with(u uuid)    auth.uid() e u são membros ACTIVE de um mesmo grupo
is_grant_counterpart(u uuid)     existe concessão ativa entre auth.uid() e u, em qualquer direção
category_used_in_my_households(c uuid)  alguma movimentação com category_id = c pertence a um grupo do qual auth.uid() é membro ACTIVE
```

- `security definer` evita recursão de RLS (policy de `household_members` consultando `household_members`) e concentra cada regra em um ponto testável.
- Não transitividade é estrutural: `can_view` e `can_manage` só consideram concessões cujo `granted_user_id` é o próprio `auth.uid()`. Acesso recebido nunca entra no cálculo de acesso concedido.

### 3.5 Policies completas

| Tabela | select | insert | update | delete |
|---|---|---|---|---|
| `accounts` | `can_view(owner)` | `can_manage(owner)` | `can_manage(owner)` | `can_manage(owner)` |
| `categories` | `can_view(owner) or category_used_in_my_households(id)` | `can_manage(owner)` | `can_manage(owner)` | `can_manage(owner)` |
| `transactions` | `can_view(owner) or (household_id is not null and is_household_member(household_id))` | `can_manage(owner)` | `can_manage(owner)` | `can_manage(owner)` |
| `profiles` | `id = auth.uid() or is_grant_counterpart(id) or shares_household_with(id)` | — | próprio | — |
| `households` | `is_household_member(id)` | `authenticated` (criador vira ADMIN por trigger) | `is_household_admin(id)` | `is_household_admin(id)` |
| `household_members` | `is_household_member(household_id)` | `is_household_admin(household_id)` | `is_household_admin(household_id)` ou (`user_id = auth.uid()` para sair: apenas `status`) | `is_household_admin(household_id)` |
| `financial_access_grants` | dono ou beneficiário | dono | dono | dono |

- `with check` de `update` em `accounts`, `categories` e `transactions` continua impedindo troca de `owner_user_id` para alguém que o usuário não administra.
- Membros de grupo enxergam apenas os lançamentos marcados com o grupo; contas e saldos de outros membros permanecem invisíveis (`accounts` não ganha regra de grupo, logo `account_balances` também não). A categoria de um lançamento do grupo fica visível aos membros apenas enquanto usada em algum lançamento do grupo, para que a lista mostre o nome.
- Edição de um lançamento continua exclusiva do dono e de quem tem MANAGE sobre o dono, mesmo em contexto de grupo. Outros membros apenas veem.

### 3.6 Movimentações do grupo

```sql
alter table public.transactions
  add column household_id uuid references public.households (id) on delete set null;
create index transactions_household_idx on public.transactions (household_id) where household_id is not null;
```

- `validate_transaction_references` passa a exigir, quando `household_id` não é nulo, que `owner_user_id` seja membro ACTIVE do grupo (`is_active_member`). Excluir o grupo desmarca os lançamentos (`set null`) sem apagá-los.
- Em contexto de grupo, a lista mostra descrição, categoria, quem registrou (`display_name` do dono), status e valor; o resumo do mês soma o grupo inteiro.

### 3.7 Busca de usuário por e-mail

`public.lookup_user_by_email(email text) returns table (id uuid, display_name text)`, `security definer`, apenas `authenticated`, comparação exata em `lower(email)` sobre `auth.users` e `profiles`, retornando no máximo uma linha. Usada para adicionar membro e conceder acesso. O sistema é privado e as contas são criadas pelo administrador; a exposição se limita a confirmar que um e-mail exato existe e seu nome de exibição.

### 3.8 Contexto financeiro

```ts
type FinancialContext =
  | { kind: 'personal' }
  | { kind: 'shared'; ownerId: string; ownerName: string; permission: 'VIEW' | 'MANAGE' }
  | { kind: 'household'; householdId: string; name: string; role: 'ADMIN' | 'MEMBER' };
```

- `core/context/financial-context.service.ts`: carrega grupos (membro ACTIVE) e concessões recebidas (ativas) com `resource()`, monta as opções do seletor, mantém o contexto selecionado em signal, persiste o identificador em `localStorage` e volta a "Minhas finanças" quando a opção persistida deixa de existir (grupo removido, concessão revogada). Expõe `ownerId` (pessoal: eu; compartilhado: dono; grupo: nulo), `householdId`, `canManage` (pessoal e MANAGE: verdadeiro; VIEW: falso; grupo: verdadeiro para lançamentos próprios).
- Header: seletor real; `shell.mock.ts` removido.
- `AccountsStore` e `CategoriesStore` carregam pelo `ownerId` do contexto (em contexto de grupo, os dados pessoais, usados pelo formulário e por Configurações); em contexto de grupo, `CategoriesStore` carrega também as categorias dos membros que o RLS permitir ver, para resolver nomes na lista.
- `TransactionsStore` filtra por `owner_user_id` (pessoal, compartilhado) ou `household_id` (grupo), sempre dentro do mês.
- Trocar de contexto recarrega os stores (parâmetros dos `resource()` incluem o contexto).

### 3.9 Interface

- Movimentações: campo "Grupo" (Pessoal ou um dos meus grupos) no formulário quando participo de algum grupo; pré-selecionado em contexto de grupo; oculto em contexto compartilhado (o beneficiário não é membro dos grupos do dono; `household_id` é preservado na edição). Em VIEW, "Nova movimentação" (header e FAB) fica desabilitado e as linhas abrem o formulário em modo somente leitura. Em grupo, lançamentos de outros membros abrem somente leitura.
- Formulário em edição mostra "Registrado por Nome em dd/MM/yyyy" e "Alterado por Nome" quando `created_by`/`updated_by` diferem do dono (auditoria básica, seção 13).
- Contas e categorias em contexto compartilhado: VIEW oculta ações; MANAGE administra normalmente. Perfil é sempre o meu.
- Grupos (`/households`): cards dos meus grupos com papel; "Novo grupo"; detalhe com membros, papéis e ações de administrador (adicionar por e-mail com papel, alterar papel, remover) e "Sair do grupo" para membros.
- Compartilhamento (`/sharing`): "Quem acessa minhas finanças" (adicionar por e-mail com VIEW ou MANAGE, alterar permissão, revogar) e "Compartilhadas comigo" (dono, permissão, "Abrir" troca o contexto).
- Dashboard permanece com dados de exemplo até a v0.5 e ignora o contexto.

### 3.10 Estrutura Angular

```text
src/app/
├── core/
│   ├── context/                       NOVO
│   │   ├── financial-context.model.ts  FinancialContext, buildContextOptions, contextKey (puras)
│   │   └── financial-context.service.ts
│   ├── finance/
│   │   ├── access-permission.ts       NOVO: AccessPermission, rótulos
│   │   └── household-role.ts          NOVO: HouseholdRole, rótulos
│   ├── layout/header/                 seletor real; shell.mock.ts removido
│   └── profile/profile.repository.ts  + lookupByEmail, findManyByIds
└── features/
    ├── households/                    NOVO
    │   ├── household.model.ts
    │   ├── household.repository.ts    households com membros e perfis embutidos
    │   ├── households.store.ts
    │   ├── households-page/
    │   ├── household-form-dialog/
    │   └── member-form-dialog/
    ├── sharing/                       NOVO
    │   ├── grant.model.ts
    │   ├── grant.repository.ts
    │   ├── grants.store.ts
    │   ├── sharing-page/
    │   └── grant-form-dialog/
    ├── accounts/, categories/         stores e páginas por contexto; ações condicionadas a canManage
    └── transactions/                  household_id, campo Grupo, modo somente leitura, auditoria no formulário
```

### 3.11 Migrations e seed

| Arquivo | Conteúdo |
|---|---|
| `..._households.sql` | enums, `households`, `household_members`, índices, funções de grupo, trigger do criador, guarda do último ADMIN, RLS e policies |
| `..._financial_access_grants.sql` | enum `access_permission`, tabela, índices, RLS, policies, `can_view`, `can_manage`, `is_grant_counterpart` |
| `..._profiles_visibility.sql` | `shares_household_with`, nova policy de leitura de `profiles`, `lookup_user_by_email` |
| `..._shared_policies.sql` | `transactions.household_id` e índice, `category_used_in_my_households`, `is_active_member`, trigger estendida, substituição das policies de `accounts`, `categories` e `transactions` |

Seed local: segundo usuário `dev2@baru.local` / `baru-dev-123`, grupo "Família" com os dois usuários (dev ADMIN), concessão VIEW de dev2 para dev e dois lançamentos do grupo, para testar contextos sem passos manuais.

### 3.12 Versão

`package.json` e `appVersion` passam a `0.4.0` na entrega.

## 4. Testes

pgTAP:

- `grants.test.sql`: dono lê e edita; VIEW lê contas, categorias, saldos e movimentações do dono e não insere, edita nem exclui; MANAGE lê e edita movimentações, contas e categorias do dono; MANAGE não cria, altera nem revoga concessões do dono; usuário sem relação não lê nada; concessão transitiva (A vê B, A concede a C) não dá a C acesso a B; concessão revogada perde o acesso imediatamente; dono não concede a si mesmo; uma concessão ativa por par; beneficiário não altera a própria permissão.
- `households.test.sql`: criador vira ADMIN; ADMIN adiciona membro, altera papel e remove; MEMBER não adiciona nem remove; membro vê grupo e membros; não membro não vê; último ADMIN não pode ser rebaixado nem desativado; membro pode sair; membro INACTIVE deixa de ver.
- `household_transactions.test.sql`: membro marca lançamento com o grupo usando a própria conta; lançamento com grupo do qual o dono não é membro é rejeitado; membros veem lançamentos do grupo e não veem lançamentos pessoais dos outros; membro não edita nem exclui lançamento de outro membro; membro não vê contas nem saldos dos outros; categoria de lançamento do grupo é visível ao membro; excluir o grupo desmarca os lançamentos.
- `profiles.test.sql` (estendido): perfil visível a contrapartes de concessão e a membros do mesmo grupo; invisível a terceiros; `lookup_user_by_email` encontra e-mail exato, ignora caixa e não é executável por `anon`.
- `schema.test.sql` e `rls_enabled.test.sql` estendidos (tabelas, enums, funções `security definer` com privilégios revogados de `anon`, índices, policies em todas as tabelas, nenhuma policy para `anon`).

Vitest:

- `financial-context.model`: montagem das opções a partir de grupos e concessões; chave persistida; fallback para pessoal.
- `FinancialContextService`: persiste e restaura; volta a pessoal quando a opção some; `ownerId`, `householdId`, `canManage` por contexto.
- `AccountsStore`, `CategoriesStore`, `TransactionsStore`: parâmetros mudam com o contexto (dono, grupo) e recarregam.
- `TransactionFormDialog`: campo Grupo aparece só com grupos; pré-seleção em contexto de grupo; modo somente leitura (VIEW, lançamento de outro membro) desabilita controles e não chama o store; `household_id` enviado.
- `HouseholdsStore`, `GrantsStore`, formulários de grupo, membro e concessão: validação, busca por e-mail, chamadas ao store, mensagens de erro (e-mail não encontrado, concessão duplicada).
- Header: opções do seletor e troca de contexto.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Acesso transitivo (C vê B por meio de A) | Funções consideram apenas concessões diretas para `auth.uid()`; teste pgTAP |
| MANAGE alterando concessões, membros ou perfil do dono | Policies de grants e de `profiles` só para o próprio usuário; membros só por ADMIN; teste pgTAP |
| Recursão de RLS em `household_members` | Funções `security definer` com `search_path = ''` |
| Grupo expondo contas, saldos ou lançamentos pessoais | `accounts` sem regra de grupo; `transactions` só com `household_id` do grupo; teste pgTAP |
| Lançamento marcado com grupo alheio | `is_active_member(household, owner)` na trigger |
| Auto concessão ou concessão duplicada | `grants_not_self` e índice único parcial |
| Concessão revogada ou membro inativo mantendo acesso | Filtros `revoked_at is null` e `status = 'ACTIVE'` em todas as funções |
| Grupo sem administrador | Trigger `ensure_household_admin` |
| Enumeração de e-mails | Função exata, apenas `authenticated`, sistema fechado; registrada como limitação |
| Interface como autoridade (botões ocultos em VIEW) | Somente conveniência; RLS nega a escrita; testes cobrem VIEW |
| Funções `security definer` executáveis por `anon` | `revoke execute from public, anon`; teste transversal em `schema.test.sql` |
| Desempenho das policies com funções | `stable`, índices parciais em `granted_user_id` e `user_id`; volume familiar |

## 6. Dependências

Nenhuma nova.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** tabelas e enums; funções de autorização; policies completas; `household_id`; trigger estendida; visibilidade de perfis; busca por e-mail; contexto real; stores por contexto; páginas Grupos e Compartilhamento; campo Grupo; modo somente leitura; testes.

**PREPARAR AGORA:** `FinancialContext` como entrada única para o dashboard da v0.5; `canManage` exposto pelo contexto; "Registrado por" no formulário; seed com dois usuários; índices parciais.

**FAZER DEPOIS:** dashboard por contexto, gráficos por pessoa e grupo (v0.5); allocations e acertos (v0.9); convites com aceite e recuperação de senha (v0.13); revisão completa de RLS (v1.0).

**NÃO NECESSÁRIO:** categorias ou contas do grupo; papéis adicionais; audit log em tabela; Edge Functions; e-mails transacionais.

## 8. Passos de entrega

1. Implementação local com `npm run db:reset`, `npm run db:types`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
2. `npx supabase db push --yes` aplica as quatro migrations ao projeto hospedado.
3. Verificação no hospedado com a chave publicável: `households`, `household_members` e `financial_access_grants` retornam lista vazia.
4. Push para `main`; Cloudflare Pages publica.
5. Validação em produção com dois usuários: criar grupo, adicionar o segundo usuário, marcar um lançamento como do grupo e vê-lo com o outro usuário; conceder VIEW e confirmar leitura sem edição; trocar para MANAGE e editar; revogar e confirmar a perda de acesso.

Passo que depende do administrador: um segundo usuário em produção (criado no painel do Supabase, como na v0.2), necessário apenas para a validação final.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis por migration ou ajuste de interface:

1. Lançamento do grupo usa conta e categoria pessoais de quem registra; membros veem categoria e quem registrou, nunca conta ou saldo.
2. Edição de lançamento é do dono e de quem tem MANAGE sobre o dono; membros do grupo apenas veem.
3. Papéis ADMIN e MEMBER; criador é ADMIN; saída e remoção marcam INACTIVE; último ADMIN protegido.
4. Uma concessão ativa por par; revogação preenche `revoked_at`; mudança de permissão atualiza a linha.
5. MANAGE administra contas e categorias do dono, além de movimentações; nunca concessões, grupos ou perfil.
6. Busca de usuário por e-mail exato via função `security definer`.
7. Contexto persistido por navegador e validado ao carregar.
8. Campo "Grupo" oculto em contexto compartilhado.
9. Dashboard segue com dados de exemplo e sem contexto até a v0.5.

A arquitetura da v0.4 do Baru Budget está pronta para implementação após sua aprovação.
