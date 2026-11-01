# Decisões técnicas (para defender numa entrevista)

Cada decisão tem: o que escolhi, porquê, o que ficou de fora, e 2 ou 3 perguntas que me podem fazer com uma resposta curta. Escrito para eu conseguir explicar tudo por palavras minhas.

---

## 1. Um só repositório com npm workspaces (`client/`, `server/`, `shared/`)

**O que é.** Um repositório com três pacotes. O `shared/` tem as regras de validação (Zod), os tipos e o conteúdo da visita, e é usado pelo client e pelo server.

**Porquê.** Em 2023 o front e o back eram dois repositórios e cada um tinha a sua ideia do que era um "User" (o front até reenviava o hash da password no PUT). Com o `shared/`, a regra "a password tem pelo menos 8 caracteres" ou "o prazo é YYYY-MM-DD" existe num sítio só: o formulário valida com o mesmo esquema que a API. Se mudo um tipo, o TypeScript avisa nos dois lados.

**Ficou de fora.** Turborepo/Nx: para três pacotes, os workspaces do npm chegam e não há nada para aprender a mais.

**Perguntas.**
- *"Não é mais difícil fazer deploy de um monorepo?"* — Não muito: o client é um build estático e o server é um processo Node. Cada um faz deploy da sua pasta; o `shared/` vai junto porque é código TypeScript importado.
- *"Validas no cliente E no servidor? Não é duplicado?"* — É o mesmo esquema, escrito uma vez. No cliente é para dar erros rápidos; no servidor é a validação que conta, porque o cliente pode ser contornado.

---

## 2. Hono no servidor (em vez de Express)

**O que é.** Um framework web pequeno, feito em TypeScript, baseado nas APIs standard da web (`Request`/`Response`).

**Porquê.** Tipos de origem (o `c.req.valid("json")` já vem tipado pelo esquema Zod), middlewares de segurança incluídos (`cors`, `csrf`, `secureHeaders`, cookies) e testes fáceis: chamo `app.request("/api/tasks")` sem abrir nenhuma porta. O original usava Express com dois `cors()` em conflito e rotas duplicadas; com Hono a app inteira cabe num ficheiro (`server/src/app.ts`) que se lê de cima a baixo.

**Ficou de fora.** Express 5 também servia. Escolhi Hono pelos tipos e por correr igual em Node, Bun ou edge, se um dia for preciso.

**Perguntas.**
- *"Porque não Express, que toda a gente conhece?"* — Express funcionava. Hono deu-me tipos de ponta a ponta e testes sem servidor a correr; para um projeto novo em TypeScript foi menos código para o mesmo resultado.
- *"Como testas as rotas?"* — Com Vitest e `app.request()`: cada ficheiro de teste cria uma base PGlite em memória, aplica as migrações e o seed, e faz pedidos reais à app (86 testes no servidor).

---

## 3. Drizzle ORM + Postgres

**O que é.** Um ORM "fino": o esquema é escrito em TypeScript, as consultas parecem SQL e as migrações são ficheiros `.sql` gerados (`server/drizzle/`).

**Porquê.** Em 2023 usávamos MongoDB sem esquema, e os dados eram inconsistentes (`Task.user` era texto, `Note.user` era ObjectId). Aqui os dados são relacionais (um aluno tem tarefas, notas e uma turma), por isso Postgres com chaves estrangeiras e `ON DELETE CASCADE`: apagar um aluno apaga as tarefas, notas e sessões dele na própria base de dados. As migrações são SQL que posso ler e rever.

**Ficou de fora.** Prisma (gera um cliente pesado e tem o seu próprio motor de consultas) e SQL à mão (sem tipos).

**Perguntas.**
- *"Porque Postgres e não MongoDB como no original?"* — Os dados têm relações e regras (um email único, tarefas que pertencem a um aluno). Uma base relacional garante isso sozinha; no original isso dependia do código e falhava.
- *"Como evitas que um aluno veja as tarefas de outro?"* — Todas as consultas de tarefas e notas filtram por `user_id = utilizador da sessão`, incluindo o UPDATE e o DELETE. Há testes que tentam ler, editar e apagar tarefas e notas de outro aluno.

---

## 4. PGlite em desenvolvimento, Neon em produção

**O que é.** O PGlite é o Postgres compilado para WebAssembly, a correr dentro do processo Node. O Neon é Postgres "serverless" alojado. O código escolhe pelo `DATABASE_URL`: vazio → PGlite numa pasta local; preenchido → Neon via `node-postgres`.

**Porquê.** `npm run demo` funciona sem instalar Docker nem criar contas: quem abrir o repositório tem a app a correr em segundos. E como o PGlite é Postgres a sério (não SQLite), o esquema e as migrações são exatamente os mesmos em produção. Os testes também usam PGlite em memória, por isso são rápidos e não precisam de serviços.

**Ficou de fora.** SQLite em dev (diferenças de SQL entre dev e produção) e Docker (mais um requisito para quem só quer ver a demo).

**Perguntas.**
- *"O PGlite aguenta produção?"* — Não é para isso: é single-connection e vive no processo. Em produção o `DATABASE_URL` aponta para o Neon. O que interessa é que o SQL é o mesmo.
- *"Como garantes que as migrações funcionam no Neon?"* — São geradas pelo drizzle-kit em SQL Postgres standard e aplicadas pelo migrador do Drizzle, que tem uma versão para cada driver. As mesmas migrações correm no Neon de produção, aplicadas com `npm run db:migrate` e `DATABASE_URL` antes de cada publicação que as traz.
- *"E o seed? Não apaga a produção por engano?"* — O seed recusa correr se houver `DATABASE_URL`, a não ser com `--allow-remote` (há um teste para isso).

---

## 5. Sessões em cookie httpOnly (em vez de JWT)

**O que é.** No login crio uma sessão numa tabela `sessions` e mando ao browser um token aleatório num cookie `httpOnly`, `SameSite=Lax` (e `Secure` em produção). Na base guardo só o SHA-256 do token.

**Porquê sessões em vez de JWT, se o original usava JWT?** No original o JWT ficava no `localStorage` (qualquer script na página o podia ler) e, pior, as rotas nem o verificavam. Para uma app com um só servidor, as sessões são mais simples e mais seguras:
- o cookie `httpOnly` não é acessível por JavaScript, por isso um XSS não rouba a sessão;
- logout é real: apago a linha e o cookie deixa de servir (com JWT, o token continua válido até expirar);
- mudar a password termina as sessões noutros dispositivos;
- apagar um aluno apaga as sessões dele em cascata.

O custo é uma consulta à base por pedido, que aqui é irrelevante.

**Ficou de fora.** JWT (faz sentido quando vários serviços precisam de validar o token sem falar com a base) e bibliotecas de auth pagas ou externas.

**Perguntas.**
- *"Porque guardas o hash do token e não o token?"* — Se alguém tiver acesso à base (um backup, por exemplo), não consegue usar as sessões, tal como acontece com as passwords.
- *"Que hash usas para as passwords?"* — argon2id com os parâmetros mínimos da OWASP (19 MiB, 2 iterações), pela biblioteca `hash-wasm` (argon2 em WebAssembly). Comecei com `@node-rs/argon2`, que é um binário nativo; troquei para o deploy na Vercel não depender da plataforma onde o bundle é feito. O hash nunca sai da API: os utilizadores passam todos por uma função `toPublicUser()` que lista os campos um a um, e há um teste que procura o hash em todas as respostas.
- *"O login diz se o email existe?"* — Não. Email inexistente e password errada dão a mesma resposta 401, e quando o email não existe verifico a password contra um hash falso para o tempo de resposta ser parecido. Só depois de a password estar certa é que digo "esta conta é de aluno, entra pelo login de aluno" (403). Há um teste que compara as duas respostas.

---

## 6. TanStack Query no client e o `csrf()` do Hono

**TanStack Query.** Gere os pedidos à API: cache, estados a carregar e erro, e voltar a pedir depois de uma alteração. Em 2023 cada página fazia `axios` dentro de `useEffect` e voltava a pedir tudo à mão depois de cada ação (e daí os 9 avisos de hooks no lint). Agora todos os pedidos estão em `client/src/api/hooks.ts`; um ecrã só faz `useTasks()` e recebe `data`, `isPending` e `isError`. Concluir uma tarefa é "otimista": a caixa muda logo e volta atrás se a API falhar.

**`csrf()` do Hono.** Com cookies há o risco de CSRF: outro site fazer o browser enviar um pedido com o cookie do utilizador. Tenho três camadas:
1. o cookie é `SameSite=Lax`, por isso o browser não o envia em POSTs vindos de outros sites;
2. o middleware `csrf()` do Hono recusa (403) formulários cujo `Origin` não está na lista `CORS_ORIGIN`;
3. as rotas que mudam dados só aceitam JSON, e um pedido JSON de outro site obriga a um preflight de CORS, que só passa para as origens configuradas.

**Perguntas.**
- *"Porque não Redux ou só useEffect?"* — O estado que tenho é quase todo "dados do servidor". O TanStack Query trata disso (cache, recarregar, erros) sem eu escrever esse código. Estado local de formulários fica em `useState`.
- *"Se tens SameSite=Lax, para que precisas do csrf()?"* — Defesa em profundidade: browsers antigos e subdomínios podem contornar o SameSite. É uma linha de código e está testado.
- *"Como configuras o CORS?"* — Pela variável `CORS_ORIGIN` (lista separada por vírgulas). Em dev o Vite faz proxy de `/api`, por isso o browser fala com uma só origem. No original havia dois `cors()` e o `ORIGIN` só funcionava para pedidos simples.

---

## 7. Respostas 404 (e não 403) para dados de outro aluno

**Porquê.** Se o aluno A pede a nota do aluno B e recebe 403, fica a saber que essa nota existe. Com 404, para A a nota simplesmente não existe. Já um aluno numa rota de staff recebe 403: aí não há nada a esconder, a rota é pública no código.

**Pergunta.** *"Como sabes que não há uma rota esquecida sem verificação?"* — Os routers de aluno e de staff aplicam `requireUser` e `requireRole` no topo, não rota a rota. E os testes percorrem todas as rotas de staff com uma sessão de aluno (403) e sem sessão (401).

---

## 8. Prazos calculados com a data local do browser

**O que é.** O prazo de uma tarefa é uma `date` (sem hora). O "3 days left", "Due today" e "Overdue" calculam-se no browser comparando com a data LOCAL de hoje (`shared/src/dates.ts`).

**Porquê.** Se usasse UTC, quem está em Nova Iorque às 21:00 já está no "dia seguinte" em UTC, e a tarefa de hoje aparecia como "Overdue" antes do tempo; em Lisboa, à 00:30 no verão, em UTC ainda é ontem e as contagens ficavam com um dia a mais. Os testes correm em três fusos (o da máquina, Los Angeles e Auckland) e testam o limite do dia: prazo hoje é "Due today", não "Overdue".

**Pergunta.** *"Porque não guardas um timestamp?"* — Porque um prazo de entrega é um dia, não um instante. Um timestamp obrigava a escolher um fuso para "fim do dia", e esse é exatamente o bug que quis evitar.

---

## 9. O server corre TypeScript diretamente no Node (sem passo de build)

**O que é.** O Node 22.18+ e 24 executam ficheiros `.ts` removendo os tipos ("type stripping"). O server corre com `node src/index.ts`; o `npm run build` do server só verifica os tipos.

**Porquê.** Menos uma ferramenta (sem `tsx`, `tsup` ou `dist/`) e os erros apontam para as linhas do código original. A regra é usar só TypeScript "apagável" (sem `enum`, sem parameter properties), e o `tsconfig` obriga a isso com `erasableSyntaxOnly`.

**Pergunta.** *"Isso é estável para produção?"* — Está ativo por omissão desde o Node 22.18 e no Node 24 (LTS). Se fosse preciso, um `tsc` para `dist/` resolvia, sem mudar o código.

---

## 10. Interface: Tailwind v4, componentes próprios e Radix

**O que é.** Os tokens da identidade (os cinco azuis de 2023, o gradiente `#0E6BA8 → #0A2472`, Poppins, Inter e VT323) estão num só ficheiro CSS (`client/src/styles/index.css`). Os componentes (botões, campos, cartões, toasts, dialogs) são meus, em `client/src/components/ui/`. Para dialogs e toasts uso Radix, que trata do foco, do Esc e do ARIA.

**Porquê.** Em 2023 usámos NextUI e lutámos contra ele (estilos inline, `!important`, modais por cima de modais). Componentes próprios dão-me controlo do design; o Radix dá-me a parte difícil de acessibilidade sem impor aspeto. As fontes são servidas pela própria app (`@fontsource`), sem pedidos ao Google.

**Perguntas.**
- *"O que fizeste para acessibilidade?"* — Contraste AA nos tokens, foco visível global, labels em todos os campos, botões só com ícone sempre com `aria-label` (o componente obriga), dialogs com foco preso (Radix), `prefers-reduced-motion`, e a visita navegável por teclado com o texto disponível a leitores de ecrã.
- *"Porque VT323 só em três sítios?"* — O original importava Poppins e VT323 para um toque "gamificado" mas não as usava. Usei a pixel font só onde é um jogo (timer, contador da visita, 404); em texto corrido cansava e baixava a legibilidade.

---

## 11. A visita: visual novel fiel, com Web Speech API

**Porquê.** É o que distingue o Kampus, por isso mantive o formato de 2023 (cenário, guia, caixa de diálogo, "Play audio" e "Next") e corrigi o resto: funciona no telemóvel, tem barra de progresso com as 7 paragens, teclado (← → Enter Esc) e o texto é anunciado a leitores de ecrã. O áudio passou de 7 ficheiros WAV (~10 MB, presos ao texto antigo) para a Web Speech API do browser: zero bytes e lê sempre o texto atual. As imagens de 2023 (cenários e retratos) tinham sido tiradas do Google, sem licença, por isso saíram do projeto e da história do git. Os cenários e os guias são agora ilustrações SVG feitas para esta versão: cerca de 10 KB cada (os JPG tinham ~1,5 MB), nítidos em qualquer ecrã e na paleta da marca.

**Pergunta.** *"Porque não usaste as imagens originais?"* — Porque não eram nossas: vieram do Google Images em 2023, sem autor nem licença. Num portfólio público isso é um risco e um mau sinal. Os prints de 2023 em `docs/antes/` mostram-nas desfocadas.

**Pergunta.** *"E se o browser não tiver Web Speech?"* — O botão fica desativado com uma explicação; o texto está sempre visível e acessível.

---

## 12. Deploy na Vercel com Neon

**O que é.** O client é publicado como ficheiros estáticos e a API é uma Vercel Function em Node. O `scripts/build-vercel.ts` gera a pasta `.vercel/output` (o formato "Build Output API" da Vercel): o build do Vite, a API num só ficheiro feito com esbuild e as rotas (`/api/*` vai para a função, o resto para o React Router). A base de dados é Postgres no Neon, ligado pelo `DATABASE_URL`.

**Porquê assim.** Com um bundle meu sei exatamente o que vai para produção: o PGlite fica de fora (só serve para dev e testes) e o bundle não depende de binários nativos. As rotas e o cron ficam no mesmo script, versionados com o código.

**A demo pública.** As contas de demo estão no README e qualquer visitante pode apagar alunos, por isso um Vercel Cron chama `/api/cron/reset-demo` todos os dias às 04:00 UTC. A rota só existe com `CRON_SECRET` definido e compara o segredo em tempo constante.

**Perguntas.**
- *"PGlite em dev e Neon em produção não dá surpresas?"* — O SQL e as migrações são os mesmos (Postgres nos dois). A diferença é só o driver, e os dois estão num ficheiro cada (`db/client.ts` e `db/postgres.ts`).
- *"Porque não um servidor sempre ligado?"* — Para uma demo de portfólio com pouco tráfego, funções serverless custam zero e não há nada para manter. O custo é o arranque a frio (a primeira chamada demora mais) e menos ligações à base por instância, por isso o pool tem no máximo 3.
- *"Como protegeste a demo pública?"* — Quatro coisas: (1) limite de 5 logins falhados por email+IP em 15 minutos, depois 429 com `Retry-After`; (2) as contas partilhadas (`staff@example.com` e `student@example.com`) não podem ser apagadas nem mudar de email ou password (403); (3) reposição diária dos dados; (4) `noindex`, para o site não aparecer em pesquisas.

---

## 13. Limite de logins guardado em Postgres

**O que é.** Cada login falhado grava uma linha em `login_attempts` com o sha256 de "email|IP". Antes de verificar a password, a API conta as falhas dos últimos 15 minutos para esse par; a partir de 5 responde 429 com `Retry-After` (os segundos até a falha mais antiga sair da janela), mesmo que a password esteja certa. Um login certo apaga as falhas desse par.

**Porquê em Postgres e não em memória.** Na Vercel cada pedido pode cair numa instância diferente da função, e as instâncias morrem quando querem. Um contador em memória deixava passar quase tudo. A base já existe e é partilhada por todas as instâncias.

**Porquê email+IP.** Só por IP, uma turma inteira atrás do mesmo Wi-Fi bloqueava-se. Só por email, qualquer pessoa podia bloquear a conta de outra. Com o par, um atacante bloqueia-se a si próprio.

**Perguntas.**
- *"De onde vem o IP?"* — Na Vercel, do `x-forwarded-for`, que a Vercel reescreve com o IP real (o cliente não o consegue falsificar). Fora da Vercel, do socket: confiar nesse header sem um proxy à frente deixava qualquer um inventar IPs.
- *"Porque guardas um hash e não o email?"* — Para não guardar dados pessoais que não fazem falta: só preciso de saber se é o mesmo par.

---

## 14. 404 a sério numa SPA alojada na Vercel

**O problema.** Numa SPA, o servidor devolve o `index.html` para qualquer caminho e é o React Router que decide o que mostrar. Por isso `/qualquer-coisa` mostrava a página 404, mas com status 200, e os motores de busca e outras ferramentas viam uma página válida.

**A solução.** Em `scripts/vercel-routes.ts` há a lista das rotas que a app conhece (as mesmas de `client/src/router.tsx`). Essas recebem o `index.html` com 200; tudo o resto recebe o mesmo `index.html` com **404**, e o React Router mostra a página "This page took a wrong turn".

**O custo.** A lista tem de acompanhar o `router.tsx`: uma rota nova esquecida na lista daria 404 no primeiro carregamento (a app aparece, mas com o status errado). Um teste (`scripts/vercel-routes.test.ts`) tem um exemplo de cada rota da app e falha se a lista não os aceitar.

**Pergunta.** *"Não era mais simples usar SSR?"* — Era mais pesado: um servidor a renderizar React só para acertar o status. Para 14 rotas fixas, uma lista testada chega.

---

## 15. `noindex`

Uma demo com contas públicas não deve aparecer no Google. O `NOINDEX = true` em `scripts/vercel-routes.ts` põe o header `X-Robots-Tag: noindex` em todas as respostas (páginas, ficheiros e API) e a meta `robots` no `index.html`. Para deixar indexar, muda-se essa constante e volta-se a publicar.

---

## 16. Entrar na demo com um clique

**Porquê.** Quem abre um portfólio dá poucos minutos a cada projeto. Antes, ver a visita pedia três passos: escolher o perfil, carregar em "Use demo account" e depois em "Log in". Agora o Welcome tem "Try as student" e "Try as staff", que entram logo na conta demo, e no ecrã de login o botão do cartão "Demo account" entra diretamente (respeitando a página pedida, se a pessoa veio de um link privado).

**O custo.** Nenhum para a segurança: as contas demo já eram públicas (email e password estão no ecrã) e estão protegidas: ninguém as pode apagar nem mudar o email ou a password. Os logins pelo botão contam para o mesmo limite de tentativas falhadas.

---

## 17. Testes de ponta a ponta com Playwright e axe, no GitHub Actions

**O que correm.** `npm run e2e` arranca uma cópia isolada da app (a mesma de `scripts/stack.ts`, com PGlite) e testa num Chromium de desktop e noutro de telemóvel:
- o clique em "Try as student" abre a visita, que se percorre até ao fim (com teclado e botões);
- marcar uma tarefa como feita sobrevive a um reload (o bug de 2023);
- um aluno que abre `/staff/...` volta para a sua área e a API responde 403;
- sem sessão, uma página privada manda para o login;
- o staff cria e apaga um aluno;
- a 404;
- o axe (regras WCAG 2.1 A e AA) em todos os ecrãs principais, incluindo o dialog de criar aluno.

**Cada teste começa com a demo reposta.** A API local passou a aceitar `CRON_SECRET` como na Vercel, e os testes chamam `/api/cron/reset-demo` antes de cada um. Correm um de cada vez porque partilham a base; são 20 testes em cerca de 25 segundos.

**O que já apanharam.** No telemóvel, o link do avatar tinha `aria-label="Your profile"` mas mostrava as iniciais: o nome acessível não incluía o texto visível (WCAG 2.5.3, quem usa controlo por voz diz o que vê). Passou a ter o nome em texto `sr-only`.

**CI.** `.github/workflows/ci.yml` corre em cada push e pull request: lint, tipos, Vitest e build num job, e os testes E2E noutro, em paralelo. Não precisa de segredos (tudo corre com PGlite). Se os E2E falharem, o relatório e os traces do Playwright ficam como artefacto durante 7 dias.

**Pergunta.** *"Porque não testar no Safari, se fizeste QA no iPhone?"* — O WebKit do Playwright não é o Safari do iOS; o QA no simulador apanhou coisas (zoom nos campos, o campo de data) que nenhum browser de CI apanharia. Os E2E protegem os fluxos contra regressões; o QA em dispositivo continua a ser à mão.

---

## 18. Tarefas da turma: uma tabela própria, não cópias

**O que é.** O staff dá uma tarefa a uma turma inteira (por exemplo "Sign the learning agreement"). Cada aluno vê-a na sua lista com "From Marta Lopes · Program Manager" e só a pode marcar como feita ou não; o staff vê "4 of 6 done" e, ao abrir "See who", quem ainda não a fez. Em 2023 o staff não tinha forma de chegar às tarefas dos alunos.

**O modelo.** Duas tabelas: `assignments` (uma linha por tarefa da turma) e `assignment_completions` (uma linha por aluno que a marcou; desmarcar apaga a linha). A alternativa era copiar a tarefa para `tasks` de cada aluno. Com cópias, editar o prazo obrigava a atualizar N linhas, um aluno que entrasse depois na turma não a recebia, e o progresso dependia de as cópias estarem certas. Com uma fonte só, o prazo muda num sítio e quem entra na turma vê logo as tarefas dela.

**O custo.** O `GET /api/tasks` junta duas origens (tarefas pessoais e da turma) e ordena-as em JS. O aluno usa a mesma rota `PATCH /api/tasks/:id` para as duas, e a API decide pelo id: na tarefa da turma só aceita `done`, e título, prazo ou apagar dão **403** com uma mensagem clara. A tarefa de outra turma dá **404**, como a de outro aluno (ver 7).

**Casos de fronteira testados.** Se o staff apagar a tarefa no instante em que um aluno a marca, a resposta é 404 e não um erro 500 (a violação de chave estrangeira é apanhada). A lista ordena-se sempre da mesma forma (o id desempata). Um aluno que muda de turma deixa de ver as tarefas da antiga (as conclusões ficam guardadas e voltam se ele regressar). Se a pessoa do staff que a criou deixar de existir, a tarefa fica, "From staff". Os totais do staff contam só quem está hoje na turma. Apagar um aluno apaga as conclusões dele, mas não as tarefas da turma.

**Pergunta.** *"Porque não deixar o aluno apagar a tarefa da turma da sua lista?"* — Porque o staff deixava de saber se ela foi feita ou ignorada. Se for preciso, o passo seguinte é um "Not relevant for me" que o staff também vê, não um apagar silencioso.

---

## 19. A visita mais visual novel: perguntas e expressões

**Perguntas ao guia.** Em cada sala há duas perguntas que o aluno pode fazer ("What time do classes start?", "Is the coffee really free?"). A resposta substitui a fala, escreve-se letra a letra e o guia muda de expressão; voltar a carregar na mesma pergunta regressa à fala da sala, e as já feitas ficam com um visto. Os botões são um grupo com `aria-pressed`, e o texto para leitores de ecrã anuncia "Marta Lopes · Program Manager answers: …".

**Porque só aparecem no fim da fala.** É como nos visual novels: primeiro lê-se, depois escolhe-se. O espaço fica reservado (invisível) para a caixa não saltar, e também se reserva a altura da resposta mais longa da sala. Depois de aparecerem, ficam visíveis até se mudar de sala: na primeira versão voltavam a esconder-se enquanto a resposta se escrevia, e quem estava no teclado perdia o foco (o botão que o tinha desaparecia). Um teste E2E com as animações ligadas prova que o foco fica.

**Porque não há atalhos 1 e 2.** A primeira versão tinha-os, como nos jogos. A revisão lembrou o critério WCAG 2.1.4 (nível A): atalhos de uma só tecla têm de se poder desligar ou só funcionar com o foco no componente, porque quem dita por voz pode carregá-los sem querer. Tirei-os: Tab e Enter chegam às perguntas, e as setas e o Enter da visita não são de uma só letra ou número. O Enter também deixou de repetir quando fica carregado (saltava salas).

**Expressões.** Cada guia tem quatro caras: sorriso, piscar de olho, curiosa e a falar. As três novas não foram desenhadas à mão: `scripts/guide-moods.ts` gera-as a partir do SVG base, trocando a boca, o olho direito ou a sobrancelha. Um teste confirma que os ficheiros publicados batem com o que o script gera, para não ficarem desatualizados se alguém mudar uma ilustração. Enquanto o texto se escreve, a boca alterna entre a expressão e "a falar" a cada 140 ms; com `prefers-reduced-motion` o texto aparece de uma vez e a boca não mexe. As quatro imagens ficam empilhadas e só uma é visível, porque trocar o `src` de uma só imagem fazia piscar.

**O que ficou de fora.** As perguntas feitas não são guardadas na base de dados: servem para a visita, não para o staff. O perfil já mostrava "Campus tour · Completed" com a data, por isso não acrescentei um selo novo.

---

## 20. A visita em 3D: React Three Fiber, um canvas acessível e um fallback a sério

**O que é.** Por cima da visita visual novel há uma maqueta 3D do campus, sem teto, vista de cima. Clicar numa sala (ou num botão das paragens) leva a câmara até ela e abre o diálogo do guia que já existia. O Next segue a ordem e a sala seguinte fica acesa (chão azul-céu, pino e etiqueta branca); "Back to map" volta à vista geral. A planta é uma volta: Entrance → Web Dev → UX/UI → Data → Kitchen → Lounge → Entrance, sempre para a sala ao lado. Os móveis são caixas, cilindros e planos feitos em código: nada descarregado, nenhum modelo nem textura.

**Porquê React Three Fiber (e não three.js à mão).** A visita já é React e o estado vive todo na `TourPage` (paragem, perguntas, voz, teclado). Com o R3F, a cena 3D é só mais um componente que recebe a paragem e chama o `goTo` que já existia: não há um segundo estado da visita para manter em sincronia. three.js à mão obrigava a uma ponte imperativa entre os dois mundos. O drei ficou de fora: usei-o para as etiquetas e o `Html` dele cria uma raiz React por etiqueta, que com o React 19 se desmontava a meio de uma renderização e fazia desaparecer a etiqueta da sala acesa. As etiquetas passaram a ser DOM normal por cima do canvas, posicionadas a cada frame a partir da câmara, e o chunk ficou mais leve.

**Orçamento e desempenho.**
- O arranque da app não muda: o three.js vem num chunk à parte (`React.lazy`), que só se pede quando o 3D vai mesmo aparecer. Quem tem reduced motion, não tem WebGL ou escolheu 2D nunca o descarrega (há um teste E2E que verifica que esse pedido não acontece).
- Medido no build: arranque 187,3 KB gz no main e 187,8 KB gz no ramo (+0,5 KB, a divisão em chunks mudou); o chunk 3D tem 244 KB gz com `gzip -9` (o Vite mostra 248 KB), abaixo do orçamento de 250 KB mas com pouca margem: o próximo passo, se crescer, é importar só as partes do three que se usam.
- `frameloop="demand"`: o canvas só desenha durante um voo de câmara, o pulso do pino ou um hover. Parado, não gasta bateria.
- DPR limitado a 2, uma luz hemisférica e uma direcional, sem shadow maps (as sombras são planos escuros semitransparentes), geometrias e materiais partilhados, menos de 35 peças por sala.

**Acessibilidade de um canvas.** Um canvas WebGL não tem nada para um leitor de ecrã, por isso o 3D é decoração (`aria-hidden`) e tudo o que se faz nele também se faz com HTML:
- as salas são os botões reais da barra de paragens ("Go to stop 3: UX/UI room"), que já existiam;
- o aria-live anuncia "Campus map. Next: Web Dev room." na vista geral e a fala do guia dentro das salas;
- quando o elemento com o foco desaparece (o cartão do diálogo, o do mapa ou o botão "Back to map"), o foco passa para o cartão novo, e um clique no 3D leva-o ao diálogo;
- Esc numa sala volta ao mapa; no mapa, sai da visita sem a marcar como saltada;
- nenhum atalho de uma só tecla (WCAG 2.1.4).

**Fallback.** A visita SVG de antes fica intacta e é usada quando não há WebGL, quando o WebGL falha a meio (error boundary à volta do canvas e o evento `webglcontextlost`, com um aviso "Showing the 2D tour") e com `prefers-reduced-motion` (sem aviso: é uma escolha, não uma falha). Há um botão "2D/3D" no topo, guardado no browser; quem tem reduced motion e escolhe o 3D à mão tem cortes secos, sem voos nem pulso.

**O que a revisão apanhou.** Um subagente revisor mediu e reproduziu quatro problemas, já corrigidos:
- ao sair da visita ou passar a 2D, o R3F liberta o contexto WebGL e isso disparava o aviso "Showing the 2D tour" (e escondia o botão 2D/3D); agora o aviso só aparece se o contexto se perder com o 3D ainda montado;
- a página volta a renderizar a cada letra da fala, e o canvas redesenhava com ela (~20 frames por segundo); com `memo` e callbacks de identidade fixa, só desenha durante os voos e o pulso do pino (medido: 0 frames parado);
- a introdução podia tirar o foco de quem já estava no botão "Start at the Entrance";
- o cursor do rato perdia a mãozinha ao passar diretamente de uma sala para outra.

**Telemóvel.** Ao alto a planta roda 90°, para a grelha 3×2 caber como 2×3 (a orientação vem do ecrã e não do canvas, para não rodar a meio da visita). A câmara mede o que o diálogo e o topo tapam e enquadra a sala no espaço que sobra; deitado, o diálogo passa para a direita e a sala fica à esquerda.

**Testes.** Os E2E da visita 2D continuam iguais. Um projeto Playwright próprio corre o 3D no Chromium com SwiftShader (WebGL no CPU, porque o CI não tem GPU): o canvas aparece, o botão de uma sala abre o diálogo dela, o Next acende a seguinte, "Back to map" volta, o foco e o Esc, sem WebGL, com o contexto perdido e com reduced motion.

**Perguntas.**
- *"Como é que um utilizador de leitor de ecrã faz a visita 3D?"* — Exatamente como a 2D: os botões das paragens, o diálogo e o aria-live são os mesmos. O canvas está escondido porque não acrescenta informação que não esteja no texto.
- *"E num telemóvel fraco?"* — O 3D só é descarregado quando vai ser usado, desenha só quando algo se mexe e tem um botão para passar a 2D. Se o WebGL cair, a visita continua em 2D no mesmo sítio.
- *"Porque não usaste modelos 3D prontos?"* — Licenças (o projeto de 2023 tinha imagens sem licença) e peso: caixas e cilindros em código pesam quase nada e ficam na paleta do Kampus.

