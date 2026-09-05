# PROMPT MESTRE DEFINITIVO — BARU BUDGET

Atue como **arquiteto de software e desenvolvedor full-stack sênior**.

Quero desenvolver uma aplicação web privada chamada:

# Baru Budget

O Baru Budget será um sistema de **gestão financeira pessoal e familiar**, acessível por navegador em desktop e celular.

O sistema será utilizado inicialmente por um pequeno grupo familiar, mas sua arquitetura não deve depender de pessoas específicas.

O produto deve permitir:

* gerenciar finanças pessoais;
* gerenciar finanças compartilhadas;
* controlar entradas e saídas;
* controlar contas e benefícios;
* administrar cartões e faturas;
* acompanhar compras parceladas;
* controlar gastos fixos;
* controlar empréstimos;
* controlar financiamentos;
* dividir despesas entre pessoas;
* registrar valores a pagar e receber entre usuários;
* compartilhar finanças pessoais com outros usuários;
* permitir ajuda financeira através de acesso com permissão de edição;
* importar e exportar dados utilizando um formato Excel oficial do Baru Budget.

Prioridades do projeto:

1. Correct
2. Secure
3. Simple
4. Testable
5. Good UX
6. Performant enough
7. Extensible

Evite overengineering.

---

# 1. STACK OFICIAL

## Frontend

Angular.

Preferir:

* versão moderna do Angular;
* Standalone Components;
* TypeScript strict;
* Reactive Forms;
* Signals quando realmente fizerem sentido;
* lazy loading por domínio quando útil;
* estrutura organizada por features.

## Backend / Database

Supabase.

Utilizar:

* PostgreSQL;
* Supabase Auth;
* Row Level Security;
* Supabase JavaScript SDK;
* PostgreSQL Functions quando apropriado;
* Supabase Edge Functions apenas quando lógica server-side privilegiada for realmente necessária.

Não criar backend próprio em:

* ASP.NET;
* Node;
* Nest;
* Java;
* Python;

sem necessidade arquitetural real.

## Hospedagem

Frontend:

Cloudflare Pages.

Deploy desejado:

GitHub
→ push na `main`
→ build do Angular
→ deploy automático no Cloudflare Pages.

O Supabase permanece como backend e banco de dados.

---

# 2. ARQUITETURA GERAL

Fluxo conceitual:

GitHub
↓
Cloudflare Pages
↓
Angular
↓
Supabase Auth / API
↓
PostgreSQL
↓
Row Level Security

O Angular roda no cliente.

O fato de o frontend ser hospedado como conteúdo estático NÃO significa que a aplicação será estática funcionalmente.

Ela continuará podendo:

* autenticar;
* consultar banco;
* cadastrar;
* editar;
* excluir;
* filtrar;
* carregar dashboards;
* importar/exportar dados;
* executar ações permitidas pelo Supabase.

Persistência oficial:

PostgreSQL do Supabase.

---

# 3. REGRA DE SEGURANÇA FUNDAMENTAL

A interface Angular NÃO é autoridade de segurança.

Esconder um botão NÃO significa negar acesso.

Toda autorização relevante deve ser reforçada no banco através de:

* Row Level Security;
* constraints;
* funções seguras;
* policies.

Toda tabela financeira exposta ao frontend deve possuir RLS.

Nenhum usuário autenticado deve automaticamente ter acesso a dados financeiros de outros usuários.

---

# 4. AUTH

Utilizar Supabase Auth.

Método inicial:

* email;
* senha.

O sistema é privado.

Não é necessário inicialmente:

* login social;
* Google Auth;
* Facebook;
* Apple;
* OAuth externo.

Avaliar se cadastro público deve ficar desabilitado.

Para os primeiros usuários pode ser utilizado:

* cadastro controlado;
* criação manual;
* convite posteriormente.

Nunca armazenar senha dentro das tabelas da aplicação.

---

# 5. PROFILES

Criar tabela:

`profiles`

Relacionada ao usuário autenticado do Supabase.

Campos conceituais:

* id;
* display_name;
* avatar_url opcional;
* created_at;
* updated_at.

O `id` deve corresponder ao usuário do Supabase Auth quando apropriado.

Não duplicar:

* senha;
* hash;
* token;
* sessão.

---

# 6. FINANÇAS PESSOAIS

Todo usuário possui suas próprias finanças.

Por padrão:

um usuário somente acessa dados cujo proprietário é ele mesmo.

Utilizar:

`owner_user_id`

quando aplicável.

Exemplo:

owner_user_id = User A

significa:

o registro pertence financeiramente ao User A.

---

# 7. GRUPOS / FAMÍLIAS

Criar conceito:

`households`

Um household representa um grupo financeiro compartilhado.

Exemplo:

Família.

Criar também:

`household_members`

Relacionando:

* household;
* usuário;
* papel/permissão;
* status;
* data de entrada.

Um usuário pode participar de mais de um grupo.

Um lançamento pode ser:

* pessoal;
* pertencente a um grupo.

Dados pessoais não devem automaticamente se tornar dados do grupo.

---

# 8. HOUSEHOLD NÃO É COMPARTILHAMENTO PESSOAL

Não misturar:

membership de grupo

com:

compartilhamento de finanças pessoais.

São conceitos diferentes.

Household significa:

> pessoas participando de um conjunto financeiro compartilhado.

Financial Access Grant significa:

> uma pessoa dando acesso às próprias finanças para outra pessoa.

---

# 9. COMPARTILHAMENTO PESSOAL

Criar tabela conceitual:

`financial_access_grants`

Campos possíveis:

* id;
* owner_user_id;
* granted_user_id;
* permission;
* created_at;
* revoked_at.

Permissões iniciais:

* VIEW
* MANAGE

---

# 10. VIEW

VIEW permite:

* visualizar dashboard;
* visualizar movimentações;
* visualizar entradas;
* visualizar despesas;
* visualizar cartões;
* visualizar faturas;
* visualizar parcelas;
* visualizar gastos fixos;
* visualizar empréstimos;
* visualizar financiamentos;
* visualizar acertos;
* utilizar filtros.

VIEW não permite:

* criar;
* editar;
* excluir;
* registrar pagamento;
* alterar configuração financeira;
* compartilhar dados;
* alterar grants.

---

# 11. MANAGE

MANAGE permite ajudar efetivamente na administração das finanças do proprietário.

Pode:

* criar movimentações;
* editar movimentações;
* excluir movimentações;
* cadastrar entradas;
* cadastrar despesas;
* marcar pagamentos;
* cadastrar cartões;
* editar cartões;
* administrar parcelas;
* administrar gastos fixos;
* administrar empréstimos;
* administrar financiamentos;
* registrar acertos.

Entretanto:

MANAGE finances
≠
MANAGE security.

O usuário com MANAGE NÃO pode:

* compartilhar as finanças do proprietário com terceiros;
* alterar grants;
* revogar outros usuários;
* conceder MANAGE;
* alterar credenciais;
* alterar configuração de segurança;
* delegar acesso.

---

# 12. NÃO TRANSITIVIDADE

Regra obrigatória.

Se:

User A consegue visualizar dados de User B

e:

User A compartilha suas próprias finanças com User C

isso NÃO significa:

User C consegue visualizar dados de User B.

Um grant concede acesso apenas aos dados pertencentes ao proprietário daquele grant.

Nunca propagar acesso recebido.

---

# 13. AUDITORIA BÁSICA

Registros relevantes devem possuir, quando aplicável:

* created_at;
* updated_at;
* created_by;
* updated_by.

Isso é especialmente importante quando outro usuário possui MANAGE.

Exemplo:

Proprietário: User A
Criado por: User B
Última alteração por: User B

Não implementar audit log corporativo completo nesta fase.

---

# 14. MOVIMENTAÇÕES FINANCEIRAS

Criar entidade central:

`transactions`

O sistema NÃO deve ser construído apenas em torno de despesas.

Uma movimentação pode representar:

* entrada;
* saída;
* transferência;
* acerto.

Estrutura conceitual:

transactions
├── id
├── owner_user_id
├── household_id nullable
├── transaction_kind
├── description
├── amount
├── category_id
├── account_id
├── date
├── due_date nullable
├── status
├── notes
├── created_by
├── updated_by
├── created_at
└── updated_at

---

# 15. TIPOS DE MOVIMENTAÇÃO

`transaction_kind` inicialmente:

* INCOME
* EXPENSE
* TRANSFER
* SETTLEMENT

Não utilizar:

* cartão;
* financiamento;
* gasto fixo;
* empréstimo;

como direção financeira.

Essas informações representam contexto/origem.

Exemplo:

EXPENSE
+
CREDIT_CARD

---

# 16. ENTRADAS

O Baru Budget precisa registrar entradas.

Exemplos:

* salário;
* vale alimentação;
* vale refeição;
* trabalho extra;
* freelance;
* presente;
* reembolso;
* rendimento;
* outros.

Permitir categorias personalizadas.

Não fixar todas as categorias permanentemente em enum.

---

# 17. CONTAS

Criar:

`accounts`

Exemplos:

* conta corrente;
* dinheiro;
* poupança;
* carteira digital;
* vale alimentação;
* vale refeição;
* benefício;
* outras.

Tipos possíveis:

* BANK
* CASH
* BENEFIT
* OTHER

---

# 18. BENEFÍCIOS

Vale alimentação, vale refeição e benefícios similares não devem ser tratados automaticamente como dinheiro livre.

Exemplo:

Salário:

* R$ 5.400
  → Conta bancária

Vale alimentação:

* R$ 700
  → Conta Vale Alimentação

Dashboard não deve simplesmente mostrar:

R$ 6.100 disponíveis em dinheiro.

Separar:

* saldo monetário;
* saldo de benefício.

---

# 19. CATEGORIAS

Criar:

`categories`

Permitir categorias de:

* receita;
* despesa.

Exemplos de despesa:

* Moradia
* Alimentação
* Transporte
* Saúde
* Educação
* Lazer
* Assinaturas
* Compras
* Outros

Exemplos de receita:

* Salário
* Benefício
* Trabalho extra
* Presente
* Reembolso
* Rendimentos
* Outros

Permitir customização.

---

# 20. STATUS

Status não deve representar tipo de gasto.

Estados possíveis:

* PENDING
* PAID
* OVERDUE
* CANCELLED

Só utilizar status onde fizer sentido.

---

# 21. QUEM PAGOU ≠ QUEM É RESPONSÁVEL

Separar:

quem pagou

de:

quem é financeiramente responsável.

Criar:

`transaction_allocations`

Uma despesa pode ser dividida entre usuários.

Exemplo:

Mercado
R$ 600

Pago por:
User A

Responsabilidade:
User A → R$ 300
User B → R$ 300

Resultado:

User B deve R$ 300 ao User A.

---

# 22. VALIDAÇÃO DE ALLOCAÇÕES

Quando uma transação possuir allocations:

a soma deve corresponder ao total alocado.

Não aceitar silenciosamente inconsistências.

Exemplo inválido:

Despesa:
R$ 600

Allocations:
R$ 500

Sem tratamento explícito.

Utilizar validação na aplicação e, quando possível, garantir invariantes no backend.

---

# 23. ACERTOS

Criar:

`settlements`

Representa pagamento entre pessoas.

Exemplo:

User B deve User A:
R$ 200

User B envia Pix:

Settlement:
User B → User A
R$ 200

O settlement NÃO exclui nem altera historicamente a despesa que originou a dívida.

Ele apenas registra o acerto.

---

# 24. A RECEBER / A PAGAR

Calcular saldos entre pessoas.

Exemplo:

Pai → Lucas: R$ 420
Esposa → Lucas: R$ 150
Lucas → Mãe: R$ 80

Exibir:

A receber:
R$ 570

A pagar:
R$ 80

Saldo líquido:

* R$ 490

Evitar armazenar saldo derivado se ele puder ser calculado de forma confiável.

---

# 25. CARTÕES

Criar:

`credit_cards`

Campos conceituais:

* id;
* owner_user_id;
* name;
* institution;
* limit_amount;
* closing_day;
* due_day;
* visual_color opcional;
* active;
* created_at;
* updated_at.

---

# 26. COMPRAS NO CARTÃO

Ao cadastrar despesa do tipo cartão:

permitir selecionar o cartão.

Campos relevantes:

* cartão;
* data da compra;
* descrição;
* valor;
* categoria;
* parcelas;
* responsável;
* allocations;
* observação.

---

# 27. FATURAS

Calcular corretamente faturas considerando:

* data da compra;
* dia do fechamento;
* dia do vencimento.

Criar regra explícita para:

* compra antes do fechamento;
* compra no fechamento;
* compra depois do fechamento;
* virada de mês;
* virada de ano.

Não simplesmente agrupar compras pelo mês da data.

---

# 28. NÃO DUPLICAR DESPESA DE CARTÃO

Regra obrigatória.

Compra no cartão:
→ EXPENSE

Pagamento da fatura:
→ TRANSFER / LIQUIDAÇÃO

Não contabilizar o pagamento da fatura como nova despesa.

Exemplo:

Compra:
R$ 1.000

Despesas:
R$ 1.000

Pagamento da fatura:
R$ 1.000

Despesas continuam:
R$ 1.000

---

# 29. PARCELAS

Criar módulo:

`installments`

Exibir:

* descrição;
* valor total;
* total de parcelas;
* parcela atual;
* parcelas restantes;
* valor da parcela;
* próxima parcela;
* origem;
* cartão;
* responsável;
* status.

Exemplo:

Notebook
4/12
R$ 350

---

# 30. CARTÃO PARCELADO

Exemplo:

Compra:
R$ 900
3x R$ 300

Faturas:

Setembro:
R$ 300

Outubro:
R$ 300

Novembro:
R$ 300

Se a compra pertencer a outra pessoa:

o valor devido deve acompanhar a competência das parcelas quando essa for a regra definida.

Não considerar automaticamente que a pessoa deve R$ 900 imediatamente se o comportamento desejado for reembolso mensal.

---

# 31. GASTOS FIXOS

Criar:

`fixed_expenses`

Representam templates recorrentes.

Exemplos:

* casa;
* aluguel;
* água;
* energia;
* internet;
* condomínio;
* telefone;
* assinaturas;
* transporte;
* mensalidade.

Campos:

* description;
* category_id;
* default_amount;
* due_day;
* recurrence;
* owner_user_id;
* household_id;
* account_id;
* active.

Algumas despesas fixas possuem valor variável.

Permitir alterar uma competência mensal sem destruir o template original.

---

# 32. RECEITAS RECORRENTES

Criar:

`recurring_incomes`

Exemplos:

* salário;
* vale alimentação;
* vale refeição;
* benefício recorrente.

Não misturar receitas recorrentes com fixed_expenses.

---

# 33. EMPRÉSTIMOS

Criar:

`loans`

Campos:

* description;
* principal;
* interest_rate;
* interest_period;
* start_date;
* installment_count;
* due_day;
* outstanding_balance;
* owner_user_id;
* household_id nullable.

Suportar explicitamente os modelos que forem implementados.

Possibilidades:

* juros simples;
* juros compostos;
* Price.

Nunca misturar fórmulas silenciosamente.

---

# 34. EMPRÉSTIMO NÃO É RENDA

Dinheiro recebido por empréstimo pode aumentar caixa.

Mas não deve inflar automaticamente:

Receitas do mês.

Distinguir:

cash flow

de:

earned income.

---

# 35. FINANCIAMENTOS

Criar:

`financings`

Campos possíveis:

* description;
* asset_value;
* down_payment;
* financed_amount;
* interest_rate;
* system;
* installment_count;
* installment_amount;
* first_due_date;
* paid_installments;
* remaining_installments;
* outstanding_balance;
* owner_user_id.

Definir regra financeira sem duplicar:

aquisição
+
parcela

como duas despesas do mesmo valor.

---

# 36. DASHBOARD

Criar Home com dashboard financeiro claro.

Cards possíveis:

* receitas do período;
* despesas do período;
* saldo;
* saldo monetário;
* benefícios;
* a receber;
* a pagar;
* cartões;
* faturas;
* gastos fixos;
* parcelas futuras;
* empréstimos;
* financiamentos.

Gráficos úteis:

* receitas × despesas;
* evolução mensal;
* despesas por categoria;
* receitas por origem;
* gastos por cartão;
* gastos por pessoa;
* evolução do saldo.

Não adicionar gráfico só para preencher espaço.

---

# 37. CONTEXTO DO DASHBOARD

Permitir alternar contexto:

* Minhas finanças;
* Grupo/Família;
* Finanças de outro usuário compartilhadas comigo.

Exemplo:

Minhas finanças
Família
Finanças de Pai
Finanças de Esposa

Mostrar apenas opções às quais o usuário realmente possui acesso.

---

# 38. FILTROS

Filtros importantes:

* data inicial;
* data final;
* mês;
* ano;
* vencimento;
* fechamento;
* status;
* categoria;
* tipo;
* cartão;
* conta;
* pessoa;
* grupo;
* entrada;
* saída.

Criar componentes reutilizáveis.

Evitar replicar lógica de datas por várias features.

---

# 39. MENU

Estrutura inicial:

Dashboard
Movimentações
Cartões
Parcelas
Gastos Fixos
Empréstimos
Financiamentos
Acertos
Grupos
Compartilhamento
Configurações

Em Movimentações:

* Todas;
* Entradas;
* Saídas.

---

# 40. EXCEL — REGRA OFICIAL

A planilha Excel atual do usuário NÃO define a estrutura do sistema.

O Baru Budget deve possuir seu próprio formato Excel oficial e versionado.

Nome conceitual:

Baru Budget Excel Format

Versão inicial:

Schema Version 1

A importação e exportação devem utilizar o MESMO contrato.

Objetivo:

PostgreSQL
→ Exportar Excel
→ editar Excel
→ importar novamente
→ PostgreSQL

---

# 41. EXCEL NÃO É BANCO PRINCIPAL

Fonte oficial:

PostgreSQL do Supabase.

Excel serve para:

* backup;
* portabilidade;
* edição manual;
* importação;
* exportação.

Nunca utilizar Excel como banco concorrente ao Supabase.

---

# 42. ROUND-TRIP

O formato Excel precisa permitir:

Export
→ Edit
→ Import

sem duplicar registros.

Todos os registros exportáveis devem possuir IDs estáveis.

Preferir UUID.

Exemplo:

id existente:
→ UPDATE

id inexistente:
→ INSERT se válido

id vazio:
→ novo registro
→ gerar UUID

---

# 43. NÃO EXCLUIR POR AUSÊNCIA

Se um registro existir no banco, mas estiver ausente do Excel importado:

NÃO excluir automaticamente.

Remover uma linha do Excel não significa deletar o dado.

Exclusão via Excel só deve acontecer através de ação explícita futuramente.

---

# 44. PREVIEW DE IMPORTAÇÃO

Antes de importar:

mostrar preview.

Exemplo:

Arquivo válido
Baru Budget Excel v1

Novos:
12

Atualizados:
4

Sem alterações:
37

Inválidos:
2

Permitir visualizar detalhes.

Somente depois:

Confirmar importação.

Nunca importar silenciosamente.

---

# 45. ESTRUTURA DO WORKBOOK

Utilizar múltiplas abas.

Estrutura inicial possível:

Info
Movimentacoes
Contas
Categorias
Cartoes
Parcelas
GastosFixos
ReceitasRecorrentes
Emprestimos
Financiamentos
Grupos
Divisoes
Acertos

Não fixar nomes definitivos antes de revisar o modelo real na v0.12.

Mas manter uma estrutura clara e versionada.

---

# 46. ABA INFO

A workbook deve possuir metadata.

Exemplo:

application = Baru Budget
schema_version = 1
exported_at = timestamp

Isso permite validar rapidamente compatibilidade.

---

# 47. EXCEL EDITÁVEL POR HUMANOS

O Excel deve ser legível.

Utilizar colunas amigáveis como:

* description;
* amount;
* category;
* account;
* date;
* status.

Também preservar colunas técnicas necessárias:

* id;
* category_id;
* account_id.

Não transformar o Excel em dump ilegível de banco.

---

# 48. SEGURANÇA DO EXCEL

O Excel NÃO é fonte de autoridade para:

* autenticação;
* senha;
* tokens;
* sessões;
* grants;
* permissões;
* service role;
* segurança.

Não permitir que alguém altere uma planilha e ganhe acesso a dados de outro usuário.

O RLS continua sendo autoridade.

---

# 49. O QUE NÃO EXPORTAR

Nunca exportar:

* senha;
* password hash;
* session token;
* refresh token;
* JWT;
* service role key;
* API secret;
* credencial privada.

---

# 50. BACKUP

Permitir exportação independente da infraestrutura cloud.

Exemplo:

baru-budget-backup-YYYY-MM-DD.xlsx

Opcionalmente:

JSON estruturado.

O backup precisa conter dados financeiros suficientes para recuperação.

---

# 51. RESPONSIVIDADE

O Baru Budget deve ser usável em:

* desktop;
* notebook;
* smartphone.

Mobile não é uma adaptação futura.

É requisito desde o início.

Evitar tabelas enormes como única interface no celular.

Utilizar quando apropriado:

* cards;
* listas;
* accordions;
* dialogs;
* bottom sheets;
* filtros recolhíveis;
* navegação adaptativa.

---

# 52. UX

Interface:

* moderna;
* limpa;
* clara;
* profissional;
* confortável;
* sem excesso de informação.

Desktop:

sidebar + conteúdo.

Mobile:

navegação adaptada.

Não copiar visual de internet banking complexo.

---

# 53. FORMATAÇÃO

Moeda principal:

BRL.

Exemplo:

R$ 1.234,56

Datas visuais:

dd/MM/yyyy

Banco:

usar tipos apropriados.

Valores financeiros:

numeric/decimal.

Nunca salvar:

"R$ 1.234,56"

como valor monetário no banco.

---

# 54. DATAS E TIMEZONE

Diferenciar:

`date`

de:

`timestamp`.

Exemplo:

vencimento:

date

Evento auditável:

timestamp.

Não transformar toda data financeira em UTC midnight sem necessidade.

Usuários inicialmente estarão no Brasil.

---

# 55. ARQUITETURA ANGULAR

Organizar por domínio.

Exemplo:

src/app/

core/
shared/

features/
├── auth/
├── dashboard/
├── transactions/
├── accounts/
├── categories/
├── cards/
├── installments/
├── fixed-expenses/
├── recurring-incomes/
├── loans/
├── financings/
├── settlements/
├── households/
├── sharing/
├── import-export/
└── settings/

Não criar uma pasta `services/` global contendo todo o sistema.

---

# 56. RESPONSABILIDADES

Component:

UI.

Facade / Application Service:

coordenação de casos de uso e estado.

Repository / Data Service:

acesso ao Supabase.

Domain utilities:

cálculos e regras puras.

Não aplicar Clean Architecture cerimonial apenas por padrão.

Mantenha separações úteis e simples.

---

# 57. SUPABASE

Não espalhar chamadas:

`supabase.from(...)`

por dezenas de componentes.

Centralizar acesso por feature/repository.

Isso melhora:

* testes;
* manutenção;
* segurança;
* consistência.

---

# 58. VALIDAÇÃO

Validar no frontend e backend.

Exemplos:

* amount > 0;
* installment_count > 0;
* IDs válidos;
* datas válidas;
* allocations consistentes;
* usuário autorizado;
* closing_day válido;
* due_day válido;
* FK válida.

Utilizar PostgreSQL constraints quando apropriado.

---

# 59. CÁLCULOS FINANCEIROS

Cálculos importantes devem ficar fora da UI.

Preferir funções puras.

Exemplos:

calculateInvoiceDate(...)
calculateInstallments(...)
calculateInterest(...)
calculateAllocationBalance(...)
calculateSettlements(...)
calculateDashboardSummary(...)

Formato desejado:

input
→ calculation
→ output

Sem dependência direta de componentes Angular.

---

# 60. TESTES

Priorizar testes sobre:

* regras financeiras;
* datas;
* faturas;
* fechamento;
* vencimento;
* parcelas;
* juros;
* allocations;
* settlements;
* recorrências;
* permissões;
* RLS;
* Excel;
* filtros;
* dashboard.

Evitar gastar esforço excessivo testando HTML trivial.

---

# 61. TESTES DE RLS

RLS é parte funcional do sistema.

Testar cenários como:

Owner:
→ SELECT OK
→ UPDATE OK

VIEW:
→ SELECT OK
→ UPDATE DENIED

MANAGE:
→ SELECT OK
→ UPDATE OK

Unrelated user:
→ SELECT DENIED

Grant transitivo:
→ DENIED

Usuário com MANAGE tentando alterar grants:
→ DENIED

---

# 62. SERVICE ROLE

Nunca colocar:

SUPABASE_SERVICE_ROLE_KEY

no Angular.

Nunca colocar segredo administrativo no GitHub.

Frontend só utiliza chaves adequadas para cliente.

Operações privilegiadas devem acontecer em ambiente seguro.

---

# 63. DEPLOY

Cloudflare Pages.

Deploy automático a partir da branch:

`main`

Fluxo:

push
→ build
→ deploy.

Separar pelo menos:

* local development;
* production.

Não criar staging complexo inicialmente.

---

# 64. LOGS

Não registrar:

* senha;
* token;
* informações financeiras completas desnecessariamente;
* dados pessoais sensíveis.

Logs devem conter apenas informação técnica suficiente para diagnóstico.

---

# 65. NÃO IMPLEMENTAR AGORA

Não implementar sem requisito explícito:

* Open Banking;
* integração automática com bancos;
* scraping bancário;
* Pix API;
* emissão de boleto;
* pagamento real;
* investimentos;
* bolsa;
* criptomoedas;
* OCR;
* inteligência artificial;
* app Android;
* app iOS;
* push notifications;
* multi-moeda;
* emissão fiscal;
* contabilidade empresarial;
* integração bancária automática.

---

# 66. ROADMAP OFICIAL

## v0.1 — Foundation

Objetivo:

estabelecer a fundação técnica do Baru Budget.

Incluir:

* criação do Angular;
* estrutura por features;
* configuração inicial;
* Supabase;
* migrations;
* schema base;
* profiles;
* categories;
* accounts;
* tipos financeiros;
* layout inicial;
* identidade Baru Budget;
* testes iniciais.

Não implementar dashboard completo ainda.

---

## v0.2 — Auth, RLS e Deploy

Incluir:

* login;
* logout;
* sessão;
* rotas protegidas;
* Supabase Auth;
* RLS inicial;
* policies;
* Cloudflare Pages;
* deploy automático;
* validação mobile básica.

Ao final:

o aplicativo deve poder ser acessado pelo celular.

---

## v0.3 — Movimentações

Incluir:

* INCOME;
* EXPENSE;
* TRANSFER;
* contas;
* benefícios;
* categorias;
* CRUD;
* filtros básicos;
* saldo;
* status.

---

## v0.4 — Grupos e Compartilhamento

Incluir:

* households;
* household_members;
* financial_access_grants;
* VIEW;
* MANAGE;
* não transitividade;
* created_by;
* updated_by;
* policies completas.

---

## v0.5 — Dashboard

Incluir:

* receitas;
* despesas;
* saldo;
* benefícios;
* períodos;
* pessoa;
* grupo;
* visão compartilhada;
* gráficos;
* cards de resumo.

---

## v0.6 — Cartões e Faturas

Incluir:

* cartões;
* limite;
* fechamento;
* vencimento;
* compras;
* faturas;
* regra de competência;
* prevenção de dupla contabilização.

---

## v0.7 — Parcelas

Incluir:

* compras parceladas;
* geração das parcelas;
* parcela atual;
* parcelas futuras;
* comprometimento;
* filtros.

---

## v0.8 — Recorrências

Incluir:

* gastos fixos;
* receitas recorrentes;
* geração de competências;
* edição de instância mensal;
* templates recorrentes.

---

## v0.9 — Divisão e Acertos

Incluir:

* transaction_allocations;
* quem pagou;
* responsáveis;
* valores devidos;
* settlements;
* Pix/reembolso;
* a receber;
* a pagar.

---

## v0.10 — Empréstimos

Incluir:

* principal;
* juros;
* parcelas;
* saldo devedor;
* cálculos;
* testes matemáticos.

---

## v0.11 — Financiamentos

Incluir:

* valor do bem;
* entrada;
* valor financiado;
* juros;
* parcelas;
* saldo devedor;
* prevenção de dupla contabilização.

---

## v0.12 — Baru Budget Excel Format v1

Somente nesta versão congelar o primeiro formato Excel oficial.

Incluir:

* schema version 1;
* exportação;
* importação;
* workbook padronizado;
* IDs estáveis;
* preview;
* validação;
* merge;
* atualização por UUID;
* criação de novos registros;
* tratamento de erro;
* backup;
* exportação editável.

---

## v0.13 — Mobile UX & Hardening

Incluir:

* revisão mobile completa;
* responsividade;
* empty states;
* loading;
* acessibilidade;
* erros;
* performance;
* revisão de permissões;
* revisão de RLS.

---

## v1.0 — Stable

Objetivo:

primeira versão estável do Baru Budget para uso real familiar.

Incluir:

* revisão de segurança;
* revisão completa do RLS;
* suíte final de testes;
* documentação;
* CI;
* deploy estável;
* backup validado;
* import/export validado;
* revisão desktop/mobile.

---

# 67. PRIMEIRA TAREFA DA IA

NÃO GERE CÓDIGO NA PRIMEIRA RESPOSTA.

Primeiro:

estude integralmente este Prompt Mestre.

Depois produza:

# ANÁLISE ARQUITETURAL — BARU BUDGET v0.1

A análise deve conter:

## 1. Entendimento do produto

Explique o produto e suas regras principais.

## 2. Stack

Confirme:

* Angular;
* Supabase;
* PostgreSQL;
* Supabase Auth;
* RLS;
* Cloudflare Pages.

## 3. Arquitetura geral

Mostre fluxo e responsabilidades.

## 4. Arquitetura Angular

Proponha estrutura inicial.

## 5. Modelo PostgreSQL

Apresente tabelas necessárias agora e tabelas que devem ficar para versões futuras.

Não criar todo o schema futuro na v0.1 sem necessidade.

## 6. Profiles

Defina modelo.

## 7. Categories

Defina modelo.

## 8. Accounts

Defina modelo.

## 9. Tipos financeiros

Defina como representar:

* INCOME;
* EXPENSE;
* TRANSFER;
* SETTLEMENT.

## 10. Supabase

Explique configuração inicial.

## 11. Auth futuro

Mostre como a v0.1 deve preparar v0.2 sem implementar tudo antecipadamente.

## 12. RLS futuro

Defina o mínimo necessário na v0.1.

## 13. UI inicial

Proponha:

* shell;
* sidebar;
* mobile navigation;
* tema;
* página inicial temporária.

## 14. Testes

Liste testes da fundação.

## 15. Migrations

Defina estratégia.

## 16. Environments

Local e production.

## 17. Cloudflare

Somente preparar o necessário para a v0.2.

## 18. Segurança

Liste riscos.

## 19. Dependências

Liste pacotes realmente necessários.

Não adicionar biblioteca sem consumidor real.

## 20. Estrutura de arquivos

Liste pastas e principais arquivos.

## 21. Sugestões classificadas

Use:

* NECESSÁRIO AGORA;
* PREPARAR AGORA;
* FAZER DEPOIS;
* NÃO NECESSÁRIO.

## 22. Decisões bloqueadoras

Pergunte apenas aquilo que realmente impeça a implementação.

Não pergunte novamente decisões já definidas neste Prompt Mestre.

Se não houver decisão bloqueadora, finalize:

"A arquitetura da v0.1 do Baru Budget está pronta para implementação após sua aprovação."

Depois:

aguarde aprovação.

Não implemente código ainda.

---

# 68. REGRAS DE CÓDIGO E COMENTÁRIOS

Código deve ser escrito de forma profissional e natural.

Não adicionar comentários contendo:

* decisões pessoais;
* participação de IA;
* histórico de conversa;
* "as requested";
* "we decided";
* "the user wants";
* raciocínio do assistente;
* justificativas pessoais.

Comentários só devem existir quando tecnicamente necessários.

Comentários técnicos devem estar em inglês.

Não comentar código óbvio.

Não criar TODO/FIXME automaticamente.

Não inserir documentação ou comentários que pareçam registrar o processo de geração por IA.

---

# 69. REGRA FINAL

O Baru Budget deve começar pequeno, seguro e correto.

Não implementar antecipadamente todo o roadmap.

Cada versão deve:

1. estudar o estado real do projeto;
2. implementar apenas seu escopo;
3. manter compatibilidade;
4. possuir testes;
5. preservar segurança;
6. evitar abstrações sem consumidor real.

Sempre prefira:

uma solução simples e correta

a

uma arquitetura sofisticada sem necessidade.
