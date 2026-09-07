# ANÁLISE ARQUITETURAL — BARU BUDGET v0.13

Data: 2026-09-07. Estado real verificado no código, não presumido: 43 arquivos SCSS, dos quais **21 não têm nenhuma media query**; três telas usam `<table>` como interface única (detalhe de empréstimo, detalhe de financiamento e o preview de importação); 15 telas usam `app-empty-state` e 16 usam `mat-progress-bar`, mas **três telas de detalhe não têm ramo de erro nenhum**; 29 `aria-label` e apenas um `role` de conteúdo; duas tabelas têm linha clicável só com `(click)`, sem teclado; o dashboard injeta **sete stores**, cada um com seu `resource()`, então abrir a Home dispara cerca de nove consultas em paralelo; `transactions` ainda carrega com `limit(1000)` fixo (DEBT-002). Baseline: 368 testes Vitest, 890 asserções pgTAP, bundle inicial de 944,90 kB.

---

## 1. Objetivo

Deixar o Baru Budget pronto para uso diário no celular e resistente a erro, sem adicionar funcionalidade. Ao final, o usuário abre o app no telefone e consegue fazer tudo o que faz no desktop, com a mesma clareza; toda tela responde às três perguntas (carregando, deu erro, está vazio); o app é navegável por teclado e legível por leitor de tela; a Home abre com menos consultas; e a matriz de permissões está provada por teste em todas as tabelas, não só nas antigas.

## 2. Escopo

Incluído:

- Auditoria escrita das 20 telas, com a lista do que muda e o porquê, antes de qualquer alteração.
- Responsividade: as três tabelas ganham forma de lista no celular; as 21 folhas sem media query são revistas; nenhuma tela rola na horizontal.
- Estados: um contrato único de carregando, erro e vazio, aplicado em todas as telas, inclusive nas três de detalhe que hoje não tratam erro.
- Acessibilidade: navegação por teclado em tudo que é clicável, foco visível e gerenciado nos diálogos, rótulos e regiões vivas, contraste conferido, movimento reduzido respeitado.
- Erros: vocabulário único de mensagem, sem código cru na tela e sem erro silencioso.
- Performance: a Home deixa de disparar nove consultas ao abrir; a DEBT-002 é resolvida com paginação real; o bundle inicial é medido e mantido dentro do orçamento.
- Permissões e RLS: revisão transversal com uma matriz de teste que cobre **todas** as tabelas, não apenas as das primeiras versões.
- Sem migration de schema; se a revisão de RLS encontrar buraco, a correção vira migration própria e documentada.

Fora do escopo: redesenho visual; funcionalidade nova; tema claro/escuro alternável; internacionalização; PWA e offline; notificações; testes end-to-end com navegador real; CI, que é da v1.0.

## 3. Decisões

### 3.1 Auditoria primeiro, mudança depois

A seção 66 do Prompt Mestre pede análise antes de código, e aqui isso vale duas vezes: "revisão mobile completa" não é uma tarefa, é um resultado. Sem uma lista fechada, a versão vira retoque infinito.

A implementação começa por `docs/UX_AUDIT_V0.13.md`, uma tabela com uma linha por tela e cinco colunas: mobile, estados, acessibilidade, erro, performance. Cada célula é OK ou um item de trabalho. Essa tabela é o escopo real da versão, e o que não estiver nela fica de fora. Ela é entregue no mesmo commit da primeira correção, não depois.

### 3.2 Responsividade: a tabela some no celular

A seção 51 é explícita: evitar tabelas enormes como interface única no celular. Hoje três telas quebram isso.

| Tela | Hoje | Decisão |
|---|---|---|
| Detalhe de empréstimo | Tabela de amortização com 6 colunas | Abaixo de 768 px vira lista de cartões: número e vencimento no topo, parcela em destaque, juros/amortização/saldo em linha secundária |
| Detalhe de financiamento | Mesma tabela | Mesma forma, mesmo componente |
| Preview de importação | Tabela por aba com 5 colunas | Vira lista de cartões por aba, com os quatro contadores em linha |

O componente nasce compartilhado, `shared/components/data-rows/`, porque as três precisam da mesma coisa: cabeçalho de coluna vira rótulo dentro do cartão. Uma tabela em `overflow-x: auto` continua existindo no desktop; o que muda é o celular deixar de rolar lateralmente.

As 21 folhas sem media query são revistas uma a uma. A maioria é de diálogo e de componente pequeno, onde a ausência é correta; a auditoria registra "OK" nesses casos em vez de inventar breakpoint. `ViewportService` já existe com três tamanhos e é a única fonte de verdade para decisão em TypeScript; CSS continua decidindo em CSS.

### 3.3 Um contrato para as três perguntas

Toda tela responde: está carregando? deu erro? está vazio? Hoje 16 telas mostram barra de progresso, 15 mostram vazio e três de detalhe não tratam erro. O padrão existe mas é copiado à mão, e onde não foi copiado, falta.

Decisão: um componente `shared/components/async-state/` que recebe `loading`, `error` e `empty` e projeta o conteúdo quando nada disso vale. A tela declara o que quer dizer em cada caso; a ordem e a aparência ficam no componente. As três telas de detalhe passam a tratar erro pelo simples fato de usarem o componente.

Carregamento continua sendo barra indeterminada, não esqueleto: o app carrega por mês e as respostas são rápidas; esqueleto aqui seria enfeite. A decisão fica registrada para não ser rediscutida.

### 3.4 Acessibilidade com alvo declarado

Alvo: WCAG 2.1 nível AA no que o app controla. Itens concretos encontrados:

- **Teclado**: as linhas clicáveis das duas tabelas de amortização não são alcançáveis por teclado. Viram elemento focável com `role="button"`, `tabindex="0"` e ativação por Enter e Espaço. Regra geral: nada é clicável sem ser focável.
- **Foco**: `mat-dialog` já devolve o foco; o que falta é foco visível consistente, hoje herdado do tema. Um `:focus-visible` próprio com contraste suficiente entra no `styles.scss`.
- **Leitura**: gráficos têm `role="img"` em um caso só. Todos ganham `role="img"` e um resumo textual em `aria-label`, porque um gráfico sem texto é invisível para leitor de tela.
- **Regiões vivas**: snackbar do Material já anuncia; o que falta é `aria-live` nos contadores que mudam sem navegação, como o preview de importação.
- **Movimento**: nenhuma regra `prefers-reduced-motion` existe. Entra uma global desligando transição e animação para quem pediu menos movimento.
- **Contraste**: os tokens `--bb-chart-income` e `--bb-chart-expense` são conferidos contra o fundo; se algum ficar abaixo de 4.5:1 em texto, o token muda, não o significado.
- `lang="pt-BR"`, `viewport-fit=cover` e `theme-color` já estão corretos no `index.html`.

Verificação automatizada onde ela é honesta: teste de componente que garante `tabindex` e `role` nas linhas clicáveis e `aria-label` nos gráficos. Contraste e leitura real de tela são conferência manual registrada na auditoria; fingir que um teste unitário cobre isso seria pior do que assumir.

### 3.5 Erros com vocabulário único

`describeDataError` já existe e é usado em 69 pontos. O que falta é regra: nenhuma tela mostra código do PostgreSQL, nenhuma promessa fica sem `catch`, e toda falha de escrita vira snackbar com ação. As três telas de detalhe que hoje não têm ramo de erro passam a ter pelo 3.3.

Um teste transversal percorre os stores e falha se algum método público de escrita não propagar erro tratável. É barato e pega regressão.

### 3.6 Performance: medir, depois cortar

Duas coisas medidas e resolvidas, nada de otimização sem número.

**A Home dispara nove consultas.** `DashboardStore` injeta sete stores, cada um com `resource()` próprio, e todos carregam ao abrir. Decisão: os cartões de compromisso (empréstimos, financiamentos, parcelas, acertos) passam a ser carregados sob demanda quando a Home realmente os exibe, e fora de contexto de grupo eles nem existem. Os stores continuam donos do seu estado; o que muda é quem dispara a carga. A meta é medida antes e depois e registrada na auditoria.

**DEBT-002.** `transactions` carrega com `limit(1000)` e um mês acima disso é truncado em silêncio, o que é o pior tipo de bug: o número na tela fica errado sem avisar. Decisão: paginação por `range()` até esgotar, exatamente como a exportação da v0.12 já faz. A dívida é fechada e o helper de paginação é promovido para uso comum.

Bundle: 944,90 kB inicial, dentro do orçamento de 1 MB. Continua medido a cada build; nenhuma ação necessária hoje.

### 3.7 Permissões e RLS: matriz completa

A seção 61 define a matriz: proprietário, VIEW, MANAGE, usuário sem relação, grant transitivo e MANAGE tentando alterar grants. Ela está testada, mas por tabela e ao longo de nove versões, então a cobertura é desigual: `financings` e `loans` ganharam teste próprio, enquanto tabelas antigas herdaram cobertura parcial.

Decisão: um único `rls_matrix.test.sql` gerado por laço sobre a lista de tabelas, aplicando os seis papéis a cada uma. Uma tabela nova sem política aparece como falha imediata. Isso substitui a esperança de que alguém lembre de escrever o teste.

Se a matriz encontrar buraco, a correção é uma migration própria, com seu registro em `PROJECT_STATUS.md` como bug corrigido. Não há migration planejada; se houver, é achado, não plano.

### 3.8 O que esta versão não faz

Registrado para não haver dúvida na revisão: nenhuma tela muda de identidade visual, nenhuma funcionalidade nova entra, nenhum campo novo aparece. Se durante a auditoria surgir vontade de funcionalidade, ela vira item de backlog na v1.0, não escopo aqui.

### 3.9 Estrutura

```
docs/UX_AUDIT_V0.13.md                      a auditoria, que é o escopo
src/app/shared/components/async-state/      carregando, erro e vazio em um contrato
src/app/shared/components/data-rows/        tabela no desktop, lista no celular
src/app/shared/supabase/paginate.ts         leitura paginada compartilhada
src/styles.scss                             foco visível, movimento reduzido
supabase/tests/rls_matrix.test.sql          a matriz da seção 61 em todas as tabelas
```

Nenhuma pasta de feature nova. Mudança é onde já existe.

## 4. Testes

Vitest:

- `AsyncState`: mostra carregando, erro e vazio na ordem certa e projeta o conteúdo quando nenhum vale; o botão de tentar novamente chama o que recebeu.
- `DataRows`: renderiza tabela no desktop e lista no celular a partir do `ViewportService`; cada célula da lista carrega o rótulo da coluna.
- Linhas clicáveis: têm `tabindex`, `role` e respondem a Enter e Espaço com a mesma ação do clique.
- Gráficos: cada um expõe `role="img"` e um `aria-label` que descreve o dado, não o desenho.
- `paginate`: junta páginas, para na página incompleta e propaga erro; o repositório de movimentações deixa de truncar em mil linhas.
- `DashboardStore`: os cartões de compromisso só disparam carga quando são exibidos; contexto de grupo não carrega o que não mostra.
- Transversal de erro: todo método público de escrita dos stores propaga `DataError`.

pgTAP:

- `rls_matrix.test.sql`: para cada tabela de `public`, os seis papéis da seção 61. Uma tabela sem política falha o arquivo.
- Os arquivos existentes continuam; a matriz não os substitui, cobre o que eles não cobrem.

Manual, registrado na auditoria com data: leitura de tela em uma tela de lista e uma de formulário, navegação inteira por teclado, e conferência das 20 telas em 360 px, 768 px e 1280 px.

## 5. Segurança

| Risco | Mitigação |
|---|---|
| Tabela nova sem política passando despercebida | Matriz gerada por laço sobre as tabelas; falha imediata |
| Cobertura de RLS desigual entre versões | Os seis papéis aplicados a todas as tabelas, não só às novas |
| Mês truncado em mil linhas mostrando saldo errado | Paginação real; a dívida DEBT-002 é fechada |
| Erro engolido escondendo falha de escrita | Teste transversal de propagação; nenhuma escrita sem `catch` |
| Código de banco vazando para a tela | Vocabulário único de mensagem por `describeDataError` |
| Ação alcançável só pelo mouse | Nada clicável sem ser focável, verificado por teste |

## 6. Dependências

Nenhuma nova. `@angular/cdk` já está no projeto e traz `a11y` e `layout`, que é tudo o que a versão precisa.

## 7. Sugestões classificadas

**NECESSÁRIO AGORA:** auditoria escrita das 20 telas; tabelas viram lista no celular; contrato único de carregando/erro/vazio; teclado no que é clicável; movimento reduzido e foco visível; rótulo textual nos gráficos; paginação fechando a DEBT-002; Home deixando de disparar nove consultas; matriz de RLS em todas as tabelas.

**PREPARAR AGORA:** `paginate` compartilhado pronto para qualquer lista futura; `async-state` como lugar único para futuras variações de carregamento; auditoria em formato de tabela reaproveitável na revisão da v1.0.

**FAZER DEPOIS:** PWA e uso offline; testes end-to-end com navegador real; tema claro/escuro alternável; virtualização de listas longas; internacionalização.

**NÃO NECESSÁRIO:** redesenho visual; esqueleto de carregamento; biblioteca de acessibilidade além do CDK; monitoramento de performance em produção nesta versão.

## 8. Passos de entrega

1. `docs/UX_AUDIT_V0.13.md` com as 20 telas auditadas, entregue junto da primeira correção.
2. Implementação local com `npm run db:reset`, `npm run test:db`, `npm test`, `npm run lint`, `npm run build`.
3. Nenhuma migration prevista; se a matriz de RLS achar buraco, a correção vira migration e `npx supabase db push --yes`.
4. Push para `main`; Cloudflare Pages publica.
5. Validação: percorrer as 20 telas em 360 px, 768 px e 1280 px; navegar o app inteiro só pelo teclado; abrir um mês com muitas movimentações e conferir que nada é truncado.

Nenhum passo exige ação do administrador.

## 9. Decisões bloqueadoras

Nenhuma. Premissas adotadas, reversíveis:

1. A auditoria escrita é o escopo da versão; o que não estiver nela fica de fora.
2. Nenhuma funcionalidade nova e nenhum redesenho.
3. Alvo de acessibilidade é WCAG 2.1 AA no que o app controla; contraste e leitor de tela são conferência manual registrada.
4. Carregamento continua barra indeterminada, sem esqueleto.
5. Tabela vira lista abaixo de 768 px, pelo mesmo componente nas três telas.
6. Os cartões de compromisso da Home carregam sob demanda.
7. A DEBT-002 é fechada com paginação igual à da exportação.
8. A matriz de RLS é gerada por laço sobre as tabelas e passa a ser a rede de segurança de toda tabela futura.
9. Nenhuma migration planejada; qualquer uma será achado da revisão, documentada como bug corrigido.

A arquitetura da v0.13 do Baru Budget está pronta para implementação após sua aprovação.
