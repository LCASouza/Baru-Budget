# ANÁLISE ARQUITETURAL — BARU BUDGET v0.2

Data: 2026-09-05. Estado real verificado: v0.1 entregue (schema local com RLS, 99 asserções pgTAP, cliente Supabase injetável, environments). Projeto Supabase hospedado criado em São Paulo (`uvzlswkeishisajbaajy`), respondendo à chave publicável, ainda sem migrations aplicadas e com cadastro público aberto. Nenhum projeto Cloudflare Pages ainda.

---

## 1. Objetivo

Tornar o Baru Budget acessível pela internet, inclusive pelo celular, com login por e-mail e senha, sessão persistente, rotas protegidas e o schema da v0.1 aplicado no projeto hospedado. Ao final, o usuário abre a URL pública no celular, faz login e vê o dashboard (ainda com dados mockados).

## 2. Escopo

- Autenticação: login, logout, sessão persistente, rotas protegidas, página de login responsiva.
- Perfil do usuário autenticado exibido no header no lugar do usuário mockado.
- Supabase hospedado: vínculo pelo CLI, migrations aplicadas, cadastro público desabilitado, URLs de redirecionamento configuradas.
- Cloudflare Pages: projeto conectado ao GitHub, build do Angular, deploy automático a partir de `main`, cabeçalhos de segurança básicos.
- Validação mobile básica na URL pública.
- Testes unitários de auth, guards, login e perfil.

Fora do escopo: cadastro público, convite de usuários, recuperação de senha pela aplicação, edição de perfil, CRUD de contas e categorias, movimentações, households, grants.

## 3. Decisões

### 3.1 Modelo de acesso

- Sistema privado: cadastro público desabilitado no projeto hospedado e no `config.toml` local (`enable_signup = false`).
- Usuários iniciais criados pelo administrador no painel do Supabase (Authentication → Users → Add user, com confirmação automática). O trigger da v0.1 cria o profile e as categorias padrão; o `display_name` inicial é o prefixo do e-mail.
- Senha esquecida: redefinida pelo administrador no painel nesta fase. Fluxo de recuperação pela aplicação fica para a v0.13.
- Senha mínima de 8 caracteres (painel e `config.toml`).

### 3.2 Sessão e proteção de rotas

- Sessão gerenciada pelo SDK (`persistSession` em localStorage, `autoRefreshToken`). A sessão sobrevive ao refresh do navegador.
- `AuthService` (`core/auth`) expõe signals `session`, `user`, `isAuthenticated` e a promise `ready`, resolvida após `getSession()` inicial; `onAuthStateChange` mantém o estado.
- `authGuard` (funcional) aguarda `ready` antes de decidir, evitando redirecionar para o login durante a restauração da sessão; redireciona para `/login?returnUrl=...`.
- `guestGuard` na rota de login redireciona usuários autenticados para o dashboard.
- Rota `/login` fora do `Shell`; o `Shell` recebe `canActivate: [authGuard]`, protegendo todas as rotas filhas de uma vez.

### 3.3 Estrutura Angular

```text
src/app/
├── core/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.guard.ts          authGuard, guestGuard
│   │   └── auth.service.spec.ts, auth.guard.spec.ts
│   ├── profile/
│   │   ├── profile.model.ts       Profile = Tables<'profiles'>
│   │   ├── profile.repository.ts  única chamada supabase.from('profiles')
│   │   ├── current-profile.service.ts   resource() carregado a partir de user()
│   │   └── specs
│   └── layout/header/             substitui MOCK_USER por CurrentProfileService + AuthService
└── features/
    └── auth/
        └── login-page/            formulário reativo, erros, estado de carregamento
```

- `ProfileRepository` é o primeiro repository do projeto: acesso tipado via `Database`, sem lógica de UI.
- `CurrentProfileService` usa `resource()` com `params` derivado do usuário autenticado; recarrega ao trocar de sessão e limpa no logout.
- Header: nome, e-mail e iniciais vêm do perfil real; "Sair" chama `signOut()` e navega para `/login`. O seletor de contexto continua mockado até a v0.4.
- `shell.mock.ts` perde `MOCK_USER` e mantém `MOCK_CONTEXTS`.

### 3.4 Página de login

- Card centralizado com identidade Baru Budget, campos e-mail e senha (Material outline), botão "Entrar", mensagem inline para credenciais inválidas e estado de carregamento.
- Mobile: largura total com padding, teclado não cobre o botão (scroll natural), `autocomplete` correto (`email`, `current-password`).
- Sem link de cadastro. Sem "esqueci minha senha" nesta versão.

### 3.5 Supabase hospedado

- Vínculo: `npx supabase link --project-ref uvzlswkeishisajbaajy` (requer login no CLI e a senha do banco, informados pelo administrador).
- Migrations: `npx supabase db push` aplica as seis migrations da v0.1 após revisão. `seed.sql` não é aplicado em produção.
- Configuração de auth no painel: cadastro público desabilitado; Site URL = URL do Cloudflare Pages; Redirect URLs = URL pública e `http://localhost:4200`; senha mínima 8.
- Verificação pós-aplicação: `GET /rest/v1/profiles` com a chave publicável retorna lista vazia (RLS), e o teste de login com um usuário real retorna o próprio profile.

### 3.6 Cloudflare Pages

- Projeto criado no painel do Cloudflare conectado a `LCASouza/Baru-Budget`, branch de produção `main`.
- Build: `npm run build`; diretório de saída `dist/baru-budget/browser`; Node 24 via `.node-version`. Sem variáveis de ambiente (valores públicos já estão em `environment.ts`).
- `public/_redirects` (já existe) para fallback de SPA.
- `public/_headers` com `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`. CSP fica para a v0.13, após inventário das origens (Google Fonts, Supabase).
- `public/robots.txt` bloqueando indexação.
- URL resultante `https://baru-budget.pages.dev` (ou domínio próprio, opcional).

### 3.7 Ambiente local

- `config.toml`: `enable_signup = false`, `minimum_password_length = 8`.
- `supabase/seed.sql` passa a criar um usuário de desenvolvimento local (`dev@baru.local`) com senha conhecida, apenas para o banco local, permitindo testar o login após `db reset` sem passos manuais. O seed nunca é executado no projeto hospedado.

### 3.8 RLS

Nenhuma policy nova. A v0.2 aplica em produção as policies da v0.1 e as valida com usuário real. `rls_enabled.test.sql` continua como guarda.

## 4. Testes

- `AuthService`: restaura sessão inicial, reage a `onAuthStateChange`, `signIn` retorna erro do SDK sem lançar, `signOut` limpa a sessão (cliente Supabase substituído por um dublê via `SUPABASE_CLIENT`).
- Guards: não autenticado redireciona para `/login` com `returnUrl`; autenticado passa; `guestGuard` redireciona autenticado para `/dashboard`; ambos aguardam `ready`.
- `LoginPage`: validação de campos, chamada de `signIn`, exibição de erro, navegação para `returnUrl`.
- `CurrentProfileService`: carrega perfil quando há usuário e limpa quando não há (repository substituído por dublê).
- Header: exibe nome e iniciais do perfil.
- pgTAP: sem mudanças; continua passando.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Cadastro público aberto no projeto hospedado (estado atual) | Desabilitar antes do primeiro deploy público |
| Senha do banco e token do CLI | Informados pelo administrador diretamente no terminal; nunca versionados nem repassados |
| Sessão em localStorage exposta a XSS | Sem CSP nesta versão; sem HTML dinâmico; CSP na v0.13 |
| Usuário de desenvolvimento no seed | Apenas local; `db push` não executa seed |
| Rota protegida decidindo antes da sessão restaurar | Guard aguarda `ready` |
| Deploy automático de `main` sem CI | Build local, testes e lint antes de cada push; CI na v1.0 |

## 6. Dependências

Nenhuma nova. `@supabase/supabase-js` já cobre auth.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** AuthService, guards, LoginPage, ProfileRepository, CurrentProfileService, header com perfil real e logout, link e `db push`, cadastro desabilitado, Cloudflare Pages, testes.

**PREPARAR AGORA:** `_headers`, `robots.txt`, usuário de desenvolvimento no seed, `minimum_password_length = 8` local.

**FAZER DEPOIS:** recuperação de senha pela aplicação e convite de usuários (v0.13), edição de perfil (v0.3, em Configurações), CSP (v0.13), `supabase config push` como configuração-como-código do projeto hospedado (avaliar quando houver mais configurações), CI (v1.0).

**NÃO NECESSÁRIO:** login social, MFA, Edge Functions, domínio próprio nesta versão.

## 8. Passos que dependem do administrador

1. Login no CLI do Supabase: `npx supabase login` (abre o navegador). Executar no terminal desta sessão.
2. Vínculo do projeto: `npx supabase link --project-ref uvzlswkeishisajbaajy`, informando a senha do banco quando solicitada.
3. Projeto no Cloudflare Pages conectado ao repositório (build `npm run build`, saída `dist/baru-budget/browser`, branch `main`).
4. No painel do Supabase: desabilitar cadastro público, definir Site URL e Redirect URLs, criar o primeiro usuário.

Os passos 1 e 2 são pré-requisitos para aplicar as migrations; 3 e 4 podem acontecer em paralelo ao desenvolvimento do login.

## 9. Decisões bloqueadoras

Nenhuma decisão de arquitetura pendente. A execução depende apenas dos passos da seção 8.

A arquitetura da v0.2 do Baru Budget está pronta para implementação após sua aprovação.
