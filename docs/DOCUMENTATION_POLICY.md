# BARU BUDGET — GOVERNANÇA DE DOCUMENTAÇÃO E ACOMPANHAMENTO

A partir deste momento, além das regras do `docs/MASTER_PROMPT.md`, mantenha permanentemente atualizada a documentação de desenvolvimento do **Baru Budget**.

## REGRA OBRIGATÓRIA DE ARMAZENAMENTO

Toda documentação de acompanhamento criada por esta política deve existir:

* **somente localmente dentro do repositório do projeto**;
* exclusivamente em arquivos **Markdown (`.md`)**;
* preferencialmente dentro da pasta:

```text
docs/
```

Não criar ou manter esses documentos em:

* Google Docs;
* Notion;
* OneDrive;
* Dropbox;
* sistemas externos de documentação;
* banco de dados;
* ferramentas SaaS;
* issues externas apenas para substituir os arquivos locais;
* arquivos `.txt`, `.docx`, `.pdf`, `.html`, `.json` ou outros formatos como fonte principal da documentação.

A fonte oficial da documentação de desenvolvimento será sempre formada pelos arquivos `.md` locais do repositório.

Não sincronizar ou publicar automaticamente esses documentos em serviços externos.

---

# 1. DOCUMENTOS OBRIGATÓRIOS

Manter localmente:

```text
docs/
├── MASTER_PROMPT.md
├── DOCUMENTATION_POLICY.md
├── PROJECT_STATUS.md
└── versions/
```

A pasta:

```text
docs/versions/
```

deve conter apenas arquivos Markdown das versões efetivamente trabalhadas.

Exemplo:

```text
docs/versions/
├── v0.1.md
├── v0.2.md
├── v0.3.md
└── ...
```

Não criar versões equivalentes em outros formatos.

---

# 2. FONTE OFICIAL

Os arquivos `.md` locais são a fonte operacional oficial para:

* roadmap;
* status;
* bugs;
* features;
* versões;
* critérios de conclusão;
* limitações;
* histórico objetivo de entrega.

Se existir informação divergente em outro lugar, os documentos Markdown locais devem ser atualizados para refletir o estado real do código.

---

# 3. NÃO EXTERNALIZAR DOCUMENTAÇÃO

Não utilizar automaticamente ferramentas externas para manter:

* roadmap;
* bugs;
* checklist;
* histórico de versão;
* documentação de progresso.

Exemplos que NÃO devem substituir os arquivos locais:

```text
GitHub Issues
GitHub Projects
Notion
Trello
Jira
Google Docs
Confluence
```

Essas ferramentas só podem ser utilizadas futuramente se houver uma decisão explícita para isso.

Até lá:

```text
docs/*.md
```

é o único sistema de acompanhamento do projeto.

---

# 4. PROJECT_STATUS.md

Criar e manter localmente:

```text
docs/PROJECT_STATUS.md
```

Esse documento será o painel central do projeto.

Deve conter pelo menos:

```markdown
# Baru Budget — Project Status

## Current Version

## Roadmap

## Current Work

## Features

## Bugs

## Technical Debt

## Excluded Items

## Last Update
```

---

# 5. STATUS PADRONIZADOS

Para roadmap, tarefas e features:

```text
PENDING
IN_PROGRESS
DELIVERED
BLOCKED
EXCLUDED
```

Para bugs:

```text
OPEN
IN_PROGRESS
FIXED
BLOCKED
WONT_FIX
```

Não criar sinônimos desnecessários.

---

# 6. DOCUMENTAÇÃO DE VERSÃO

Ao iniciar uma versão, criar localmente:

```text
docs/versions/vX.Y.md
```

Exemplo:

```text
docs/versions/v0.1.md
```

Estrutura:

```markdown
# Baru Budget v0.1 — Foundation

## Status

## Objective

## Scope

## Delivered

## Technical Behavior

## Database Changes

## Security Changes

## Tests

## Bugs Found

## Bugs Fixed

## Known Limitations

## Out of Scope

## Completion Criteria
```

Não criar versão equivalente em PDF, Word ou outro formato.

---

# 7. FEATURES

Manter no `PROJECT_STATUS.md`:

```markdown
## Features

| ID | Feature | Version | Status | Notes |
|---|---|---|---|---|
| FEAT-001 | User authentication | v0.2 | PENDING | Email and password authentication |
```

IDs:

```text
FEAT-001
FEAT-002
FEAT-003
```

Não reutilizar IDs.

---

# 8. BUGS

Todo bug real deve ser registrado localmente em Markdown.

Formato:

```markdown
## Bugs

| ID | Description | Found In | Status | Fixed In | Notes |
|---|---|---|---|---|---|
| BUG-001 | Session is lost after page refresh | v0.2 | OPEN | — | Reproducible after browser refresh |
```

IDs:

```text
BUG-001
BUG-002
BUG-003
```

Não depender de GitHub Issues como fonte principal.

Se um bug também for registrado em outra ferramenta futuramente, o arquivo `.md` local continua sendo a referência obrigatória.

---

# 9. TECHNICAL DEBT

Manter também em Markdown:

```markdown
## Technical Debt

| ID | Description | Version | Status | Notes |
|---|---|---|---|---|
| DEBT-001 | ... | v0.3 | PENDING | ... |
```

---

# 10. DOCUMENTAÇÃO IMPESSOAL

Toda documentação deve ser técnica e impessoal.

Não escrever:

```text
We chose...
I decided...
The user requested...
The AI suggested...
After discussing...
We preferred...
```

Descrever sempre:

* o comportamento atual;
* a regra técnica;
* o motivo funcional ou técnico objetivo.

Exemplo correto:

```markdown
Invoice payments are represented as transfers to prevent credit-card purchases from being counted twice as expenses.
```

Exemplo incorreto:

```markdown
We decided to use transfers because this approach seemed better.
```

---

# 11. COMENTÁRIOS NO CÓDIGO

Comentários técnicos devem:

* ser em inglês;
* ser impessoais;
* explicar apenas comportamento não óbvio;
* não registrar escolhas pessoais;
* não mencionar IA, prompts ou conversa.

Exemplo correto:

```typescript
// Prevents delegated access from being propagated to third-party users.
```

---

# 12. FLUXO OBRIGATÓRIO

Antes de iniciar uma nova versão:

1. ler `docs/MASTER_PROMPT.md`;
2. ler `docs/DOCUMENTATION_POLICY.md`;
3. ler `docs/PROJECT_STATUS.md`;
4. ler `docs/versions/vX.Y.md` se existir;
5. verificar o código real;
6. confirmar o estado do projeto.

Durante a implementação:

* atualizar os `.md` locais quando o status mudar;
* registrar bugs reais;
* registrar features entregues;
* registrar bloqueios;
* manter consistência entre código e documentação.

Ao finalizar uma versão:

1. executar build;
2. executar testes;
3. revisar migrations;
4. revisar segurança;
5. atualizar bugs;
6. atualizar features;
7. atualizar checklist;
8. atualizar `docs/versions/vX.Y.md`;
9. atualizar `docs/PROJECT_STATUS.md`;
10. marcar a versão como `DELIVERED` apenas se os critérios forem cumpridos.

---

# 13. REGRA FINAL

A documentação do Baru Budget deve existir apenas como:

```text
arquivos Markdown locais
dentro do repositório
```

Principalmente:

```text
docs/*.md
docs/versions/*.md
```

Não criar automaticamente documentação equivalente fora do projeto.

Não utilizar formatos adicionais como fonte oficial.

O objetivo é manter:

```text
código
+
documentação
+
histórico técnico objetivo
```

no mesmo repositório e sempre sincronizados.
