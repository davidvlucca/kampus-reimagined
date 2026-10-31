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
- *"Como testas as rotas?"* — Com Vitest e `app.request()`: cada ficheiro de teste cria uma base PGlite em memória, aplica as migrações e o seed, e faz pedidos reais à app (62 testes).

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
- *"Como garantes que as migrações funcionam no Neon?"* — São geradas pelo drizzle-kit em SQL Postgres standard e aplicadas pelo migrador do Drizzle, que tem uma versão para cada driver. Ainda não corri contra um Neon real (está fora do âmbito desta versão).
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
- *"Que hash usas para as passwords?"* — argon2id (`@node-rs/argon2`), o recomendado pela OWASP. O hash nunca sai da API: os utilizadores passam todos por uma função `toPublicUser()` que lista os campos um a um, e há um teste que procura o hash em todas as respostas.
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

**Porquê.** É o que distingue o Kampus, por isso mantive o formato de 2023 (cenário, guia, caixa de diálogo, "Play audio" e "Next") e corrigi o resto: funciona no telemóvel, tem barra de progresso com as 7 paragens, teclado (← → Enter Esc) e o texto é anunciado a leitores de ecrã. O áudio passou de 7 ficheiros WAV (~10 MB, presos ao texto antigo) para a Web Speech API do browser: zero bytes e lê sempre o texto atual. As imagens de 2023 foram convertidas de JPG (~1,5 MB cada) para WebP (~50–110 KB), com uma versão menor para o telemóvel.

**Pergunta.** *"E se o browser não tiver Web Speech?"* — O botão fica desativado com uma explicação; o texto está sempre visível e acessível.
