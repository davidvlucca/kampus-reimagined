# Registo de decisões técnicas

Uma entrada por decisão, no formato Contexto / Decisão / Alternativas consideradas / Consequências.
Há um resumo em inglês no README ("Key engineering decisions").

---

## 1. Um só repositório com npm workspaces (`client/`, `server/`, `shared/`)

**Contexto.** Em 2023 o front e o back eram dois repositórios e cada um tinha a sua ideia do que era um "User" (o front até reenviava o hash da password no PUT).

**Decisão.** Um repositório com três pacotes. O `shared/` tem as regras de validação (Zod), os tipos e o conteúdo da visita, e é usado pelo client e pelo server. A regra "a password tem pelo menos 8 caracteres" ou "o prazo é YYYY-MM-DD" existe assim num sítio só: o formulário valida com o mesmo esquema que a API. Se mudo um tipo, o TypeScript avisa nos dois lados.

**Alternativas consideradas.** Turborepo/Nx: para três pacotes, os workspaces do npm chegam e não há nada para aprender a mais.

**Consequências.**
- O deploy de um monorepo não é muito mais difícil: o client é um build estático e o server é um processo Node. Cada um faz deploy da sua pasta; o `shared/` vai junto porque é código TypeScript importado.
- Validar no cliente e no servidor não é duplicação, é o mesmo esquema escrito uma vez. No cliente serve para dar erros rápidos; no servidor é a validação que conta, porque o cliente pode ser contornado.

---

## 2. Hono no servidor (em vez de Express)

**Contexto.** O original usava Express com dois `cors()` em conflito e rotas duplicadas.

**Decisão.** Hono, um framework web pequeno, feito em TypeScript e baseado nas APIs standard da web (`Request`/`Response`). Dá tipos de origem (o `c.req.valid("json")` já vem tipado pelo esquema Zod), middlewares de segurança incluídos (`cors`, `csrf`, `secureHeaders`, cookies) e testes fáceis: chamo `app.request("/api/tasks")` sem abrir nenhuma porta. A app inteira cabe num ficheiro (`server/src/app.ts`) que se lê de cima a baixo.

**Alternativas consideradas.** Express 5 também servia e funcionava. Escolhi Hono pelos tipos de ponta a ponta, por permitir testes sem servidor a correr e por correr igual em Node, Bun ou edge, se um dia for preciso. Para um projeto novo em TypeScript foi menos código para o mesmo resultado.

**Consequências.** As rotas testam-se com Vitest e `app.request()`: cada ficheiro de teste cria uma base PGlite em memória, aplica as migrações e o seed, e faz pedidos reais à app (123 testes no servidor, 214 no total do Vitest).

---

## 3. Drizzle ORM + Postgres

**Contexto.** Em 2023 usávamos MongoDB sem esquema, e os dados eram inconsistentes (`Task.user` era texto, `Note.user` era ObjectId). Os dados são relacionais (um aluno tem tarefas, notas e uma turma, com um email único). No original essas regras dependiam do código e falhavam.

**Decisão.** Postgres com Drizzle, um ORM "fino": o esquema é escrito em TypeScript, as consultas parecem SQL e as migrações são ficheiros `.sql` gerados (`server/drizzle/`), que posso ler e rever. Há chaves estrangeiras e `ON DELETE CASCADE`: apagar um aluno apaga as tarefas, notas e sessões dele na própria base de dados.

**Alternativas consideradas.** Prisma (gera um cliente pesado e tem o seu próprio motor de consultas) e SQL à mão (sem tipos).

**Consequências.** A base relacional garante sozinha as relações e a unicidade. O isolamento entre alunos faz-se na camada de consultas: todas as consultas de tarefas e notas filtram por `user_id = utilizador da sessão`, incluindo o UPDATE e o DELETE. Há testes que tentam ler, editar e apagar tarefas e notas de outro aluno.

---

## 4. PGlite em desenvolvimento, Neon em produção

**Contexto.** Quero que quem abra o repositório tenha a app a correr em segundos, sem Docker nem contas. O PGlite é o Postgres compilado para WebAssembly, a correr dentro do processo Node. O Neon é Postgres "serverless" alojado.

**Decisão.** O código escolhe pelo `DATABASE_URL`: vazio → PGlite numa pasta local; preenchido → Neon via `node-postgres`. Assim `npm run demo` funciona sem instalar nada. Como o PGlite é Postgres a sério (não SQLite), o esquema e as migrações são exatamente os mesmos em produção. Os testes também usam PGlite em memória, por isso são rápidos e não precisam de serviços.

**Alternativas consideradas.** SQLite em dev (diferenças de SQL entre dev e produção) e Docker (mais um requisito para quem só quer ver a demo).

**Consequências.**
- O PGlite não é para produção: é single-connection e vive no processo. Em produção o `DATABASE_URL` aponta para o Neon. O que interessa é que o SQL é o mesmo.
- As migrações são geradas pelo drizzle-kit em SQL Postgres standard e aplicadas pelo migrador do Drizzle, que tem uma versão para cada driver. As mesmas migrações correm no Neon de produção, aplicadas com `npm run db:migrate` e `DATABASE_URL` antes de cada publicação que as traz.
- O seed recusa correr se houver `DATABASE_URL`, a não ser com `--allow-remote`, para não apagar a produção por engano (há um teste para isso).

---

## 5. Sessões em cookie httpOnly (em vez de JWT)

**Contexto.** No original o JWT ficava no `localStorage` (qualquer script na página o podia ler) e, pior, as rotas nem o verificavam.

**Decisão.** No login crio uma sessão numa tabela `sessions` e mando ao browser um token aleatório num cookie `httpOnly`, `SameSite=Lax` (e `Secure` em produção). Na base guardo só o SHA-256 do token. Para uma app com um só servidor, as sessões são mais simples e mais seguras:
- o cookie `httpOnly` não é acessível por JavaScript, por isso um XSS não rouba a sessão;
- logout é real: apago a linha e o cookie deixa de servir (com JWT, o token continua válido até expirar);
- mudar a password termina as sessões noutros dispositivos;
- apagar um aluno apaga as sessões dele em cascata.

Guardar o hash do token e não o token significa que, se alguém tiver acesso à base (um backup, por exemplo), não consegue usar as sessões, tal como acontece com as passwords.

As passwords usam argon2id com os parâmetros mínimos da OWASP (19 MiB, 2 iterações), pela biblioteca `hash-wasm` (argon2 em WebAssembly). Comecei com `@node-rs/argon2`, que é um binário nativo; troquei para o deploy na Vercel não depender da plataforma onde o bundle é feito.

**Alternativas consideradas.** JWT (faz sentido quando vários serviços precisam de validar o token sem falar com a base) e bibliotecas de auth pagas ou externas.

**Consequências.**
- O custo é uma consulta à base por pedido, que aqui é irrelevante.
- O hash da password nunca sai da API: os utilizadores passam todos por uma função `toPublicUser()` que lista os campos um a um, e há um teste que procura o hash em todas as respostas.
- O login não revela se o email existe. Email inexistente e password errada dão a mesma resposta 401, e quando o email não existe verifico a password contra um hash falso para o tempo de resposta ser parecido. Só depois de a password estar certa é que digo "esta conta é de aluno, entra pelo login de aluno" (403). Há um teste que compara as duas respostas.
- Mudar a password não pode perder uma corrida com um login. O argon2 do login demora, e uma mudança ou reposição a meio apagava as sessões antes de o login criar a dele, que nascia válida com a password antiga. Por isso quem mexe nas credenciais (a mudança pelo próprio e a reposição pelo staff) troca o hash e apaga as sessões numa só transação, com a linha do utilizador bloqueada (`select ... for update`), e o login cria a sessão noutra transação que bloqueia a mesma linha e confirma que o hash e o email ainda são os que verificou; se não forem, é um 401 de password errada. O argon2 fica fora das transações, que só duram umas queries. Sem colunas novas: o próprio hash serve de versão.

---

## 6. TanStack Query no client e o `csrf()` do Hono

**Contexto.** Em 2023 cada página fazia `axios` dentro de `useEffect` e voltava a pedir tudo à mão depois de cada ação (e daí os 9 avisos de hooks no lint). Por outro lado, com cookies há o risco de CSRF: outro site fazer o browser enviar um pedido com o cookie do utilizador.

**Decisão.**
- **TanStack Query.** Gere os pedidos à API: cache, estados a carregar e erro, e voltar a pedir depois de uma alteração. Todos os pedidos estão em `client/src/api/hooks.ts`; um ecrã só faz `useTasks()` e recebe `data`, `isPending` e `isError`. Concluir uma tarefa é "otimista": a caixa muda logo e volta atrás se a API falhar.
- **`csrf()` do Hono.** Tenho três camadas:
  1. o cookie é `SameSite=Lax`, por isso o browser não o envia em POSTs vindos de outros sites;
  2. o middleware `csrf()` do Hono recusa (403) formulários cujo `Origin` não está na lista `CORS_ORIGIN`;
  3. as rotas que mudam dados só aceitam JSON, e um pedido JSON de outro site obriga a um preflight de CORS, que só passa para as origens configuradas.
- **CORS.** Configura-se pela variável `CORS_ORIGIN` (lista separada por vírgulas). Em dev o Vite faz proxy de `/api`, por isso o browser fala com uma só origem.

**Alternativas consideradas.** Redux ou só `useEffect`: o estado que tenho é quase todo "dados do servidor", e o TanStack Query trata disso (cache, recarregar, erros) sem eu escrever esse código. O estado local de formulários fica em `useState`.

**Consequências.** O `csrf()` é redundante com o `SameSite=Lax`, de propósito: é defesa em profundidade, porque browsers antigos e subdomínios podem contornar o SameSite. É uma linha de código e está testado. No original havia dois `cors()` e o `ORIGIN` só funcionava para pedidos simples; agora há uma só configuração.

**Notas: a cache não decide o que se apaga.**
- *Contexto.* O "New note" cria logo a nota, e o editor apaga-a ao sair se ficou intocada. Uma revisão de código mostrou que essa decisão vinha da cache do separador: se o separador A criava a nota e o B lhe escrevia e guardava, A ainda a via vazia e apagava o texto de B. Os rascunhos por guardar (no `sessionStorage`) também eram guardados só pelo id da nota: se a sessão de A caía e B entrava no mesmo separador, B via o rascunho de A e podia copiá-lo para a conta dele com "Save as a new note".
- *Decisão.* A limpeza automática usa `DELETE /api/notes/:id?onlyIfEmpty=1`, com a condição no próprio DELETE: só apaga se a nota tiver o título e o corpo do "New note" e nunca tiver sido editada (`updated_at = created_at`). Responde 204 se apagou, 200 `{ deleted: false, note }` se a nota ficou e 404 se não existe ou é de outro aluno. O client só a tira da cache depois do 204 (ou 404); com o 200, mostra a nota que o servidor devolveu. O Delete pedido pelo aluno continua sem condição. Os rascunhos passam a ter o id do utilizador na chave, e o "Log out" apaga os do utilizador que saiu.
- *Consequências.* Uma nota editada e depois esvaziada já não é limpa automaticamente (fica na lista, o aluno apaga-a à mão): é o preço de não haver corrida com outro separador. Os rascunhos com a chave antiga (só o id da nota) são ignorados e desaparecem quando o separador fecha. Há testes no servidor para cada resposta do DELETE condicional e testes da chave dos rascunhos no client.

**Notas: guardar automático.** O botão Save saiu: o editor guarda 800 ms depois da última tecla, ao sair de um campo, ao esconder o separador e antes de mudar de página (o blocker espera pela gravação e só pede para descartar se ela falhar ou faltar o título). Usa o mesmo PATCH com só os campos mudados, e o título compara-se sem espaços à volta, para o guardar não cortar um espaço a meio de escrever. Um rascunho reposto do `sessionStorage` não se guarda sozinho (pode ser mais velho do que o servidor): guarda-se quando o aluno escreve ou carrega em "Keep them". O leitor de ecrã ouve "Note saved" ou o erro uma vez por gravação, não a cada tecla. O Delete passou para um menu "⋯" e continua com confirmação: desfazer pedia uma reposição no servidor, que não existe.

---

## 7. Respostas 404 (e não 403) para dados de outro aluno

**Contexto.** Se o aluno A pede a nota do aluno B e recebe 403, fica a saber que essa nota existe.

**Decisão.** Dados de outro aluno respondem 404: para A a nota simplesmente não existe. Já um aluno numa rota de staff recebe 403: aí não há nada a esconder, a rota é pública no código.

**Consequências.** Para não haver rotas esquecidas sem verificação, os routers de aluno e de staff aplicam `requireUser` e `requireRole` no topo, não rota a rota. E os testes percorrem todas as rotas de staff com uma sessão de aluno (403) e sem sessão (401).

---

## 8. Prazos calculados com a data local do browser

**Contexto.** O prazo de uma tarefa é uma `date` (sem hora). Se usasse UTC, quem está em Nova Iorque às 21:00 já está no "dia seguinte" em UTC, e a tarefa de hoje aparecia como "Overdue" antes do tempo; em Lisboa, à 00:30 no verão, em UTC ainda é ontem e as contagens ficavam com um dia a mais.

**Decisão.** O "3 days left", "Due today" e "Overdue" calculam-se no browser comparando com a data LOCAL de hoje (`shared/src/dates.ts`).

**Alternativas consideradas.** Guardar um timestamp: um prazo de entrega é um dia, não um instante. Um timestamp obrigava a escolher um fuso para "fim do dia", e esse é exatamente o bug que quis evitar.

**Consequências.** Os testes correm em três fusos (o da máquina, Los Angeles e Auckland) e testam o limite do dia: prazo hoje é "Due today", não "Overdue".

---

## 9. O server corre TypeScript diretamente no Node (sem passo de build)

**Contexto.** O Node 22.18+ e 24 executam ficheiros `.ts` removendo os tipos ("type stripping"). Está ativo por omissão desde o Node 22.18 e no Node 24 (LTS).

**Decisão.** O server corre com `node src/index.ts`; o `npm run build` do server só verifica os tipos. Fica menos uma ferramenta (sem `tsx`, `tsup` ou `dist/`) e os erros apontam para as linhas do código original.

**Alternativas consideradas.** Se fosse preciso, um `tsc` para `dist/` resolvia, sem mudar o código.

**Consequências.** A regra é usar só TypeScript "apagável" (sem `enum`, sem parameter properties), e o `tsconfig` obriga a isso com `erasableSyntaxOnly`.

---

## 10. Interface: Tailwind v4, componentes próprios e Radix

**Contexto.** Em 2023 usámos NextUI e lutámos contra ele (estilos inline, `!important`, modais por cima de modais). O original importava Poppins e VT323 para um toque "gamificado" mas não as usava.

**Decisão.** Os tokens da identidade (os cinco azuis de 2023, o gradiente `#0E6BA8 → #0A2472`, Poppins e Inter) estão num só ficheiro CSS (`client/src/styles/index.css`). Os componentes (botões, campos, cartões, toasts, dialogs) são meus, em `client/src/components/ui/`. Para dialogs e toasts uso Radix, que trata do foco, do Esc e do ARIA. As fontes são servidas pela própria app (`@fontsource`), sem pedidos ao Google. A pixel font VT323 chegou a estar no timer, no contador da visita e no 404, mas saiu em novembro de 2026: destoava do resto e pesava mais uma família. Os números usam Poppins com algarismos de largura fixa (`tabular-nums`), para o relógio não tremer.

**Alternativas consideradas.** Uma biblioteca de componentes completa, como o NextUI de 2023, que deu os problemas descritos acima.

**Consequências.** Componentes próprios dão-me controlo do design; o Radix dá-me a parte difícil de acessibilidade sem impor aspeto. Em acessibilidade há: contraste AA nos tokens, foco visível global, labels em todos os campos, botões só com ícone sempre com `aria-label` (o componente obriga), dialogs com foco preso (Radix), `prefers-reduced-motion`, e a visita navegável por teclado com o texto disponível a leitores de ecrã.

---

## 11. A visita: visual novel fiel, com Web Speech API

**Contexto.** A visita é o que distingue o Kampus, por isso mantive o formato de 2023 (cenário, guia, caixa de diálogo, "Play audio" e "Next"). As imagens de 2023 (cenários e retratos) tinham sido tiradas do Google Images, sem autor nem licença, e o áudio eram 7 ficheiros WAV (~10 MB, presos ao texto antigo).

**Decisão.** Corrigi o resto: funciona no telemóvel, tem barra de progresso com as 7 paragens, teclado (← → Enter Esc) e o texto é anunciado a leitores de ecrã. O áudio passou para a Web Speech API do browser: zero bytes e lê sempre o texto atual. As imagens saíram do projeto e da história do git. Os cenários e os guias são agora ilustrações SVG feitas para esta versão: cerca de 10 KB cada (os JPG tinham ~1,5 MB), nítidos em qualquer ecrã e na paleta da marca.

**Alternativas consideradas.** Manter as imagens originais: não eram minhas, e num portfólio público isso é um risco e um mau sinal. Os prints de 2023 em `docs/antes/` mostram-nas desfocadas.

**Consequências.** Se o browser não tiver Web Speech, o botão fica desativado com uma explicação; o texto está sempre visível e acessível.

---

## 12. Deploy na Vercel com Neon

**Contexto.** É uma demo de portfólio com pouco tráfego, e as contas de demo estão no README, por isso qualquer visitante pode apagar alunos.

**Decisão.** O client é publicado como ficheiros estáticos e a API é uma Vercel Function em Node. O `scripts/build-vercel.ts` gera a pasta `.vercel/output` (o formato "Build Output API" da Vercel): o build do Vite, a API num só ficheiro feito com esbuild e as rotas (`/api/*` vai para a função, o resto para o React Router). A base de dados é Postgres no Neon, ligado pelo `DATABASE_URL`. Com um bundle meu sei exatamente o que vai para produção: o PGlite fica de fora (só serve para dev e testes) e o bundle não depende de binários nativos. As rotas e o cron ficam no mesmo script, versionados com o código.

**A demo pública.** Um Vercel Cron chama `/api/cron/reset-demo` todos os dias às 04:00 UTC. A rota só existe com `CRON_SECRET` definido e compara o segredo em tempo constante. A demo está protegida de quatro formas:
1. limite de 5 logins falhados por email+IP e de 30 tentativas por IP em 15 minutos, depois 429 com `Retry-After`;
2. as contas partilhadas (`staff@example.com` e `student@example.com`) não podem ser apagadas nem mudar de email ou password (403);
3. reposição diária dos dados;
4. `noindex`, para o site não aparecer em pesquisas.

**Alternativas consideradas.** Um servidor sempre ligado: para uma demo de portfólio com pouco tráfego, funções serverless custam zero e não há nada para manter.

**Consequências.**
- O custo das funções serverless é o arranque a frio (a primeira chamada demora mais) e menos ligações à base por instância, por isso o pool tem no máximo 3.
- PGlite em dev e Neon em produção não dão surpresas: o SQL e as migrações são os mesmos (Postgres nos dois). A diferença é só o driver, e os dois estão num ficheiro cada (`db/client.ts` e `db/postgres.ts`).

---

## 13. Limite de logins guardado em Postgres

**Contexto.** Na Vercel cada pedido pode cair numa instância diferente da função, e as instâncias morrem quando querem. Um contador em memória deixava passar quase tudo. A base já existe e é partilhada por todas as instâncias.

**Decisão.** Cada login falhado grava uma linha em `login_attempts` com o sha256 de "email|IP". Antes de verificar a password, a API conta as falhas dos últimos 15 minutos para esse par; a partir de 5 responde 429 com `Retry-After` (os segundos até a falha mais antiga sair da janela), mesmo que a password esteja certa. Um login certo apaga as falhas desse par e não conta para o limite por IP (30 em 15 minutos): só as falhas contam, para uma turma ou um escritório inteiro poder entrar na demo pelo mesmo IP. Os logins certos têm um teto próprio e largo (200 por IP em 15 minutos), porque a password da demo é pública e cada login custa um argon2 e uma sessão nova.

**Alternativas consideradas.**
- Contador em memória: descrito acima, não funciona com várias instâncias.
- Só por IP: uma turma inteira atrás do mesmo Wi-Fi bloqueava-se.
- Só por email: qualquer pessoa podia bloquear a conta de outra.

Com o par email+IP, um atacante bloqueia-se a si próprio.

**Consequências.**
- O IP vem, na Vercel, do `x-forwarded-for`, que a Vercel reescreve com o IP real (o cliente não o consegue falsificar). Fora da Vercel vem do socket: confiar nesse header sem um proxy à frente deixava qualquer um inventar IPs.
- Guardo um hash e não o email para não guardar dados pessoais que não fazem falta: só preciso de saber se é o mesmo par.
- Confirmar a password atual (para a mudar) também é um argon2, e com uma sessão roubada dava para testar passwords sem limite. Passa pelo mesmo mecanismo antes do argon2: 5 falhas por conta (chave `reauth:` com o id, seja qual for o IP) e as mesmas 30 falhas por IP do login, com o mesmo 429. Por conta e não por email+IP porque só quem tem sessão nessa conta lá chega, por isso não dá para bloquear a conta de outro. Uma confirmação certa não conta e apaga as falhas, como no login.

---

## 14. 404 a sério numa SPA alojada na Vercel

**Contexto.** Numa SPA, o servidor devolve o `index.html` para qualquer caminho e é o React Router que decide o que mostrar. Por isso `/qualquer-coisa` mostrava a página 404, mas com status 200, e os motores de busca e outras ferramentas viam uma página válida.

**Decisão.** Em `scripts/vercel-routes.ts` há a lista das rotas que a app conhece (as mesmas de `client/src/router.tsx`). Essas recebem o `index.html` com 200; tudo o resto recebe o mesmo `index.html` com **404**, e o React Router mostra a página "This page took a wrong turn".

**Alternativas consideradas.** SSR: era mais pesado, um servidor a renderizar React só para acertar o status. Para 14 rotas fixas, uma lista testada chega.

**Consequências.** A lista tem de acompanhar o `router.tsx`: uma rota nova esquecida na lista daria 404 no primeiro carregamento (a app aparece, mas com o status errado). Um teste (`scripts/vercel-routes.test.ts`) tem um exemplo de cada rota da app e falha se a lista não os aceitar.

---

## 15. `noindex`

**Contexto.** Uma demo com contas públicas não deve aparecer no Google.

**Decisão.** O `NOINDEX = true` em `scripts/vercel-routes.ts` põe o header `X-Robots-Tag: noindex` em todas as respostas (páginas, ficheiros e API) e a meta `robots` no `index.html`.

**Consequências.** Para deixar indexar, muda-se essa constante e volta-se a publicar.

---

## 16. Entrar na demo com um clique

**Contexto.** Quem abre um portfólio dá poucos minutos a cada projeto. Antes, ver a visita pedia três passos: escolher o perfil, carregar em "Use demo account" e depois em "Log in".

**Decisão.** O Welcome tem agora "Explore as a student" e "Explore as staff" como ação principal, que entram logo na conta demo, e no ecrã de login o botão do cartão "Demo account" entra diretamente (respeitando a página pedida, se a pessoa veio de um link privado).

**Consequências.** Não há custo para a segurança: as contas demo já eram públicas (email e password estão no ecrã) e estão protegidas: ninguém as pode apagar nem mudar o email ou a password. Os logins pelo botão passam pelo mesmo limite de tentativas falhadas (ver 13).

---

## 17. Testes de ponta a ponta com Playwright e axe, no GitHub Actions

**Contexto.** Os testes unitários e de API não cobrem os fluxos completos no browser, nem a acessibilidade dos ecrãs.

**Decisão.** `npm run e2e` arranca uma cópia isolada da app (a mesma de `scripts/stack.ts`, com PGlite) e testa num Chromium de desktop e noutro de telemóvel:
- o clique em "Explore as a student" abre a visita, que se percorre até ao fim (com teclado e botões);
- marcar uma tarefa como feita sobrevive a um reload (o bug de 2023);
- um aluno que abre `/staff/...` volta para a sua área e a API responde 403;
- sem sessão, uma página privada manda para o login;
- o staff cria e apaga um aluno;
- a 404;
- o axe (regras WCAG 2.1 A e AA) em todos os ecrãs principais, incluindo o dialog de criar aluno.

Cada teste começa com a demo reposta: a API local passou a aceitar `CRON_SECRET` como na Vercel, e os testes chamam `/api/cron/reset-demo` antes de cada um. Correm um de cada vez porque partilham a base; são 30 testes (15 em cada Chromium), e os 15 da visita 3D correm num projeto à parte (ver 20).

**CI.** `.github/workflows/ci.yml` corre em cada push e pull request: lint, tipos, Vitest, o build da Vercel (`npm run build:vercel`, o mesmo do deploy) e o orçamento do bundle (`scripts/check-bundle.ts`) num job, em Node 22 como a função, e os testes E2E noutro, em paralelo. Não precisa de segredos (tudo corre com PGlite). Se os E2E falharem, o relatório e os traces do Playwright ficam como artefacto durante 7 dias.

**Alternativas consideradas.** Correr também no Safari: o WebKit do Playwright não é o Safari do iOS, e o QA no simulador apanhou coisas (zoom nos campos, o campo de data) que nenhum browser de CI apanharia.

**Consequências.**
- Os E2E protegem os fluxos contra regressões; o QA em dispositivo continua a ser à mão.
- Já apanharam um problema real: no telemóvel, o link do avatar tinha `aria-label="Your profile"` mas mostrava as iniciais, e o nome acessível não incluía o texto visível (WCAG 2.5.3, quem usa controlo por voz diz o que vê). Passou a ter o nome em texto `sr-only`.

---

## 18. Tarefas da turma: uma tabela própria, não cópias

**Contexto.** O staff dá uma tarefa a uma turma inteira (por exemplo "Sign the learning agreement"). Cada aluno vê-a na sua lista com "From Marta Lopes · Program Manager" e só a pode marcar como feita ou não; o staff vê "4 of 6 done" e, ao abrir "See who", quem ainda não a fez. Em 2023 o staff não tinha forma de chegar às tarefas dos alunos.

**Decisão.** Duas tabelas: `assignments` (uma linha por tarefa da turma) e `assignment_completions` (uma linha por aluno que a marcou; desmarcar apaga a linha). Com uma fonte só, o prazo muda num sítio e quem entra na turma vê logo as tarefas dela.

**Alternativas consideradas.**
- Copiar a tarefa para `tasks` de cada aluno. Com cópias, editar o prazo obrigava a atualizar N linhas, um aluno que entrasse depois na turma não a recebia, e o progresso dependia de as cópias estarem certas.
- Deixar o aluno apagar a tarefa da turma da sua lista: o staff deixava de saber se ela foi feita ou ignorada. Se for preciso, o passo seguinte é um "Not relevant for me" que o staff também vê, não um apagar silencioso.

**Consequências.**
- O `GET /api/tasks` junta duas origens (tarefas pessoais e da turma) e ordena-as em JS. O aluno usa a mesma rota `PATCH /api/tasks/:id` para as duas, e a API decide pelo id: na tarefa da turma só aceita `done`, e título, prazo ou apagar dão **403** com uma mensagem clara. A tarefa de outra turma dá **404**, como a de outro aluno (ver 7).
- Casos de fronteira testados:
  - se o staff apagar a tarefa no instante em que um aluno a marca, a resposta é 404 e não um erro 500 (a violação de chave estrangeira é apanhada);
  - a lista ordena-se sempre da mesma forma (o id desempata);
  - um aluno que muda de turma deixa de ver as tarefas da antiga (as conclusões ficam guardadas e voltam se ele regressar);
  - se a pessoa do staff que a criou deixar de existir, a tarefa fica, "From staff";
  - os totais do staff contam só quem está hoje na turma;
  - apagar um aluno apaga as conclusões dele, mas não as tarefas da turma.

**O staff vê quem precisa de um empurrão, sem tabelas novas.**
- *Contexto.* O redesenho do dashboard, dos alunos e das tarefas da turma pede estados por aluno, "tarefas a tempo" e uma linha do tempo a contar do primeiro dia. O preview da Vercel usa a mesma base Neon da produção, por isso não podia haver migrações.
- *Decisão.* Tudo sai das tabelas que já existem, com três acrescentos só de leitura: `GET /api/staff/cohorts` (as turmas com `startsOn`), as conclusões de cada aluno na lista de alunos (`completions`, só as da turma atual, numa consulta para a lista toda) e as tarefas da turma marcadas na atividade recente (`task_completed`, a partir do `completed_at`). Os estados calculam-se no browser, com a data local (ver 8), por esta ordem: **Not signed in** (nunca entrou), **Behind** (pelo menos uma tarefa da turma com o prazo antes de hoje e por fazer), **Ready** (fez todas, e a turma tem pelo menos uma) e **On track** (o resto). "Need a nudge" são os dois primeiros. "Tasks on time" conta as conclusões até ao dia do prazo (data local) entre as tarefas com o prazo antes de hoje, vezes os alunos de hoje na turma. A semana zero são os 14 dias antes do início.
- *Lembretes.* São links `mailto:` montados no browser, para o aluno ou em BCC para vários, com as tarefas em falta e assinados por quem está no staff. O servidor não envia emails nem guarda nada. O "Import CSV" valida as linhas no browser com o mesmo Zod da API e chama o POST de criar aluno uma vez por linha.
- *Consequências.* Um mailto com muitos endereços pode passar o limite do programa de email (perto dos 2000 caracteres em alguns); para uma turma chega. Os prints usam o seed, onde as turmas já começaram, por isso a semana zero só aparece com turmas reais.

---

## 19. A visita mais visual novel: perguntas e expressões

**Contexto.** Quis aproximar a visita de um visual novel: o aluno pode fazer perguntas ao guia e o guia reage com expressões.

**Decisão.**
- **Perguntas ao guia.** Em cada sala há duas perguntas que o aluno pode fazer ("What time do classes start?", "Is the coffee really free?"). A resposta substitui a fala, escreve-se letra a letra e o guia muda de expressão; voltar a carregar na mesma pergunta regressa à fala da sala, e as já feitas ficam com um visto. Os botões são um grupo com `aria-pressed`, e o texto para leitores de ecrã anuncia "Marta Lopes · Program Manager answers: …".
- **Só aparecem no fim da fala.** É como nos visual novels: primeiro lê-se, depois escolhe-se. O espaço fica reservado (invisível) para a caixa não saltar, e também se reserva a altura da resposta mais longa da sala. Depois de aparecerem, ficam visíveis até se mudar de sala.
- **Expressões.** Cada guia tem quatro caras: sorriso, piscar de olho, curiosa e a falar. As três novas não foram desenhadas à mão: `scripts/guide-moods.ts` gera-as a partir do SVG base, trocando a boca, o olho direito ou a sobrancelha. Enquanto o texto se escreve, a boca alterna entre a expressão e "a falar" a cada 140 ms; com `prefers-reduced-motion` o texto aparece de uma vez e a boca não mexe. As quatro imagens ficam empilhadas e só uma é visível, porque trocar o `src` de uma só imagem fazia piscar.

**Alternativas consideradas.**
- Perguntas sempre visíveis: na primeira versão voltavam a esconder-se enquanto a resposta se escrevia, e quem estava no teclado perdia o foco (o botão que o tinha desaparecia). Por isso agora ficam visíveis até se mudar de sala; um teste E2E com as animações ligadas prova que o foco fica.
- Atalhos 1 e 2 para as perguntas: a primeira versão tinha-os, como nos jogos. Uma revisão de código lembrou o critério WCAG 2.1.4 (nível A): atalhos de uma só tecla têm de se poder desligar ou só funcionar com o foco no componente, porque quem dita por voz pode carregá-los sem querer. Tirei-os: Tab e Enter chegam às perguntas, e as setas e o Enter da visita não são de uma só letra ou número. O Enter também deixou de repetir quando fica carregado (saltava salas).
- Guardar as perguntas feitas na base de dados: ficou de fora, porque servem para a visita, não para o staff. O perfil já mostrava "Campus tour · Completed" com a data, por isso não acrescentei um selo novo.

**Consequências.** Um teste confirma que os ficheiros das expressões publicados batem com o que o script gera, para não ficarem desatualizados se alguém mudar uma ilustração.

---

## 20. A visita em 3D: React Three Fiber, um canvas acessível e um fallback a sério

**Contexto.** A visita visual novel já existia, com ilustrações SVG e o estado todo na `TourPage` (paragem, perguntas, voz, teclado). Quis acrescentar uma maqueta 3D do campus sem criar um segundo estado da visita nem pôr em risco o arranque, a acessibilidade e o telemóvel.

**Decisão.**

**O que é.** Por cima da visita visual novel há uma maqueta 3D do campus, sem teto, vista de cima. Clicar numa sala (ou num botão das paragens) leva a câmara até ela e abre o diálogo do guia que já existia. O Next segue a ordem. No mapa, a sala seguinte fica acesa (chão azul-céu, pino e etiqueta branca); dentro de uma sala, acende-se a própria sala e o resto da planta fica apagado (as cores puxadas para o fundo). A primeira versão acendia sempre a seguinte: num portátil a câmara mostra também as salas do lado, e quem testou achou que o clique tinha ido parar à sala errada.

**Entrar na sala.** A câmara não para por cima da sala: desce para dentro dela e, quando para, a ilustração da visita 2D aparece por cima com um fade. O 3D é o mapa e o caminho; a ilustração é o sítio. Isto juntou os dois modos (as ilustrações já existiam) e resolveu o portátil, onde o diálogo tapava metade da sala. O Next sai para a vista geral e volta a mergulhar na sala seguinte (cerca de 2,5 s; escolhi isto em vez de trocar logo a ilustração). Enquanto a ilustração está à vista, tapa o canvas, por isso não há cliques nas outras salas: muda-se pelo Next, pelos botões das paragens ou pelo mapa. "Back to map" volta à vista geral. Os móveis são caixas, cilindros e planos feitos em código: nada descarregado, nenhum modelo nem textura.

**A planta nova (oito paragens).** A primeira planta era uma grelha de seis salas iguais. Passou a ser a planta aprovada, feita a partir de um edifício real do centro de Lisboa (sem o nome da empresa nem o da rua na app): 17 × 28 m, a porta principal na rua pedonal a oeste, o rio a sul e um corredor de 2 m de norte a sul. A oeste ficam UX/UI, Web Dev (a maior, com 28 mesas), a sala de reuniões e a Entrance; a este, Data, o open space com três cabines, o núcleo (escadas, elevador, WC) e a cozinha com o lounge. A reunião e o núcleo não são paragens: não se clicam nem têm etiqueta. A ordem é Entrance → Web Dev → UX/UI → Data → Open space → Kitchen and lounge → Rooftop → despedida na vista geral; um teste prova que cada paragem passa para a seguinte por uma porta, pelo corredor ou pelas escadas, sem atravessar outra sala. As paredes, as portas e as janelas saem de uma lista de linhas e aberturas em `layout.ts`, com as medidas da planta; os móveis usam as mesmas coordenadas. O terraço é um segundo nível: quando a visita chega à paragem 7, a laje desce e assenta no edifício e a câmara sobe com ela (no mapa, a etiqueta e o pino ficam por cima das escadas); ao sair, a laje volta a subir e desaparece. Escolhi isto em vez de uma vista explodida com o terraço sempre a flutuar por cima, porque tapava o rés-do-chão no mapa. As peças repetidas (as 28 mesas, as cadeiras, as floreiras) são `InstancedMesh`, uma chamada à GPU por cor. O chunk 3D passou de 245,8 para 247,7 KB gz e o arranque de 183,6 para 185,4 KB gz (os textos novos são mais longos).

**O guia nos ecrãs grandes.** O retrato do guia crescia com o ecrã (até 520 px, vezes o zoom de 1,5 dos ecrãs de 1440p) e tapava o mapa e o diálogo. Agora tem 360 px de altura no máximo em qualquer ecrã (o tamanho vem dividido pelo zoom) e fica encostado à esquerda do cartão, com o ombro por baixo dele.

**React Three Fiber (e não three.js à mão).** A visita já é React. Com o R3F, a cena 3D é só mais um componente que recebe a paragem e chama o `goTo` que já existia: não há um segundo estado da visita para manter em sincronia. O drei ficou de fora: usei-o para as etiquetas e o `Html` dele cria uma raiz React por etiqueta, que com o React 19 se desmontava a meio de uma renderização e fazia desaparecer a etiqueta da sala acesa. As etiquetas passaram a ser DOM normal por cima do canvas, posicionadas a cada frame a partir da câmara, e o chunk ficou mais leve.

**Orçamento e desempenho.**
- O arranque da app não muda: o three.js vem num chunk à parte (`React.lazy`), que só se pede quando o 3D vai mesmo aparecer. Quem tem reduced motion, não tem WebGL ou escolheu 2D nunca o descarrega (há um teste E2E que verifica que esse pedido não acontece).
- Medido no build (gzip com o nível por omissão do zlib): o chunk 3D tem 245,8 KB gz (o Vite mostra 249 KB), abaixo do orçamento de 250 KB mas com pouca margem: o próximo passo, se crescer, é importar só as partes do three que se usam. O arranque desceu de 190,4 para 180,7 KB gz quando as páginas do aluno passaram também a chunks próprios. A CI falha se o arranque passar de 200 KB ou o chunk 3D de 255 KB.
- `frameloop="demand"`: o canvas só desenha durante um voo de câmara, o pulso do pino ou um hover. Parado, não gasta bateria.
- DPR limitado a 2, uma luz hemisférica e uma direcional, sem shadow maps (as sombras são planos escuros semitransparentes), geometrias e materiais partilhados, poucas peças por sala (as repetidas em instâncias).

**Acessibilidade de um canvas.** Um canvas WebGL não tem nada para um leitor de ecrã, por isso o 3D é decoração (`aria-hidden`) e tudo o que se faz nele também se faz com HTML:
- as salas são os botões reais da barra de paragens ("Go to stop 3: UX/UI room"), que já existiam;
- o aria-live anuncia "Campus map. Next: Web Dev room." na vista geral e a fala do guia dentro das salas;
- quando o elemento com o foco desaparece (o cartão do diálogo, o do mapa ou o botão "Back to map"), o foco passa para o cartão novo, e um clique no 3D leva-o ao diálogo;
- Esc numa sala volta ao mapa; no mapa, sai da visita sem a marcar como saltada;
- nenhum atalho de uma só tecla (WCAG 2.1.4).

Um utilizador de leitor de ecrã faz a visita 3D exatamente como a 2D: os botões das paragens, o diálogo e o aria-live são os mesmos. O canvas está escondido porque não acrescenta informação que não esteja no texto.

**Fallback.** A visita SVG de antes fica intacta e é usada quando não há WebGL, quando o WebGL falha a meio (error boundary à volta do canvas e o evento `webglcontextlost`, com um aviso "Showing the 2D tour") e com `prefers-reduced-motion` (sem aviso: é uma escolha, não uma falha). Há um botão "2D/3D" no topo, guardado no browser; quem tem reduced motion e escolhe o 3D à mão tem cortes secos, sem voos nem pulso. Num telemóvel fraco, o 3D só é descarregado quando vai ser usado, desenha só quando algo se mexe e tem um botão para passar a 2D; se o WebGL cair, a visita continua em 2D no mesmo sítio.

**Telemóvel.** O edifício é comprido de norte a sul: ao alto vê-se de sul, com o rio à frente; deitado (e no portátil) roda 90° e vê-se de oeste, com a rua e a porta principal à frente (a orientação vem do ecrã e não do canvas, para não rodar a meio da visita). A câmara mede o que o diálogo e o topo tapam e enquadra a sala no espaço que sobra; deitado, o diálogo passa para a direita e a sala fica à esquerda.

**Alternativas consideradas.**
- three.js à mão: obrigava a uma ponte imperativa entre o mundo React e o do canvas.
- drei: ver acima, o `Html` dele causava o desaparecimento da etiqueta.
- Modelos 3D prontos: por causa das licenças (o projeto de 2023 tinha imagens sem licença) e do peso; caixas e cilindros em código pesam quase nada e ficam na paleta do Kampus.

**Consequências.**
- O chunk 3D tem pouca margem face ao orçamento (ver acima).
- Uma revisão de código mediu e reproduziu quatro problemas, já corrigidos:
  - ao sair da visita ou passar a 2D, o R3F liberta o contexto WebGL e isso disparava o aviso "Showing the 2D tour" (e escondia o botão 2D/3D); agora o aviso só aparece se o contexto se perder com o 3D ainda montado;
  - a página volta a renderizar a cada letra da fala, e o canvas redesenhava com ela (~20 frames por segundo); com `memo` e callbacks de identidade fixa, só desenha durante os voos e o pulso do pino (medido: 0 frames parado);
  - a introdução podia tirar o foco de quem já estava no botão "Start at the Entrance";
  - o cursor do rato perdia a mãozinha ao passar diretamente de uma sala para outra.
- Testes: os E2E da visita 2D continuam iguais. Um projeto Playwright próprio corre o 3D no Chromium com SwiftShader (WebGL no CPU, porque o CI não tem GPU): o canvas aparece, o botão de uma sala abre o diálogo dela, o Next acende a seguinte, "Back to map" volta, o foco e o Esc, sem WebGL, com o contexto perdido e com reduced motion.

---

## 21. Headers de segurança e CSP

**Contexto.** Sem `frame-ancestors`, qualquer site podia pôr o login ou a página de alunos do staff num iframe invisível (clickjacking). E um portfólio que um revisor passa no securityheaders.com não pode tirar F.

**Decisão.** Todas as páginas e ficheiros (tudo menos `/api`) saem com uma Content-Security-Policy fechada (`script-src 'self'`, sem `unsafe-eval`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e `Cross-Origin-Opener-Policy`. Os headers estão definidos num só sítio (`scripts/vercel-routes.ts`) e o `vite preview` usa os mesmos, por isso os E2E correm debaixo da CSP. A API tem a sua: `default-src 'none'`, HSTS de 2 anos e `Cache-Control: no-store` por omissão, para nenhuma cache guardar dados de um utilizador.

**Consequências.**
- O Zod 4 compila os esquemas com `new Function` (mais rápido), o que uma CSP sem `unsafe-eval` bloqueia. Ficou em modo `jitless`, num chunk próprio para a configuração correr antes de qualquer esquema do shared ser criado; o `check-bundle.ts` falha se essa configuração desaparecer do build.
- O `style-src` precisa de `'unsafe-inline'` por causa do `<style>` que o Radix injeta nos diálogos.
- `/api/auth/me` devolve 200 sem sessão, porque não ter sessão não é um erro numa página pública: com 401, cada visita ao Welcome deixava um erro vermelho na consola. Agora é `200 { user: null }`; os outros endpoints continuam a dar 401, e esse 401 leva ao login.
