# Kampus Reimagined

[![CI](https://github.com/davidvlucca/kampus-reimagined/actions/workflows/ci.yml/badge.svg)](https://github.com/davidvlucca/kampus-reimagined/actions/workflows/ci.yml)

**A campus onboarding app for new students: a visual-novel tour of the campus, tasks with deadlines, notes, a focus timer and the staff contacts. Staff add students, give each cohort its tasks and see how everyone is settling in.**

This is a 2026 remake of **Kampus**, a team project from the Ironhack Web Development bootcamp (2023) that took **1st place**. Same idea and the same blue identity, rebuilt from scratch with real authentication, a responsive layout and the 2023 bugs fixed.

![Logging in as a student: the virtual tour opens on the first login](docs/video/kampus-demo.gif)

- **Live demo: https://kampus-reimagined.vercel.app** (one click on "Try as student" or "Try as staff"; the data resets every day)
- Original 2023 code: [glowinZero/kampus](https://github.com/glowinZero/kampus) (front end) and [glowinZero/project-3-backend](https://github.com/glowinZero/project-3-backend) (back end)
- Short video of both flows (40 s): [`docs/video/kampus-demo.mp4`](docs/video/kampus-demo.mp4)
- Technical decisions (in Portuguese): [`docs/DECISOES.md`](docs/DECISOES.md)

> All data in this project is **fictional**: the campus, cohorts, people, emails, tasks and notes.

## Run it

Needs Node 22.18+ (tested with Node 24). No database, Docker or accounts needed: in development the app uses [PGlite](https://pglite.dev), a real Postgres that runs inside the Node process.

```bash
npm run demo
```

This installs dependencies, creates the database, applies the migrations, loads the demo data and starts the API (http://localhost:3000) and the web app (http://localhost:5173).

| Account | Email | Password |
| --- | --- | --- |
| Staff (Program Manager) | `staff@example.com` | `Kampus123` |
| Student (first login opens the tour) | `student@example.com` | `Kampus123` |

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts API and web app (after a first `npm run demo`) |
| `npm run db:reset` | Wipes the local database and loads the demo data again |
| `npm test` | API tests (auth and authorization) and date tests, with Vitest |
| `npm run e2e` | End-to-end tests in a desktop and a mobile Chromium, with an accessibility check (axe, WCAG 2.1 AA) on every screen (Playwright) |
| `npm run lint` / `npm run typecheck` / `npm run build` | ESLint, TypeScript, production build |
| `npm run prints` | Screenshots of the main screens into `docs/prints/` (Playwright) |
| `npm run video` | Records the demo video into `docs/video/` (Playwright + ffmpeg) |

In production the API reads `DATABASE_URL` (a Postgres such as Neon) instead of PGlite; the schema and migrations are the same. See `.env.example`.

### Deploy (Vercel + Neon)

`npm run build:vercel` writes `.vercel/output` ([Build Output API](https://vercel.com/docs/build-output-api)): the static client, the API bundled into one Vercel Function, the routes and a daily cron. `vercel.json` runs it as the build command.

1. Add a Neon database to the Vercel project (Storage → Neon); it sets `DATABASE_URL`.
2. Set `CRON_SECRET` (any long random string) and `CORS_ORIGIN` (the site URL) in the project's environment variables.
3. Apply the migrations and load the demo data once: `vercel env pull .env.production.local`, then `DATABASE_URL=… npm run db:migrate` and `DATABASE_URL=… node server/src/seed.ts --reset --allow-remote`.
4. `vercel deploy --prod`.
5. Later, when a commit adds a migration (`server/drizzle/`), run `npm run db:migrate` against Neon **before** pushing it: the build doesn't migrate, and the new code expects the new tables.

The public demo resets itself every day at 04:00 UTC (`/api/cron/reset-demo`, protected by `CRON_SECRET`). It also limits failed logins (5 per email and IP in 15 minutes, then `429`), protects the two shared demo accounts from being deleted or having their email or password changed, returns a real `404` for unknown URLs, and is hidden from search engines (`NOINDEX` in `scripts/vercel-routes.ts`).

## Before and after

Screenshots of the 2023 app (rendered from the original code, with fictional data) next to the new version. Desktop at 1440px; more in [`docs/antes/`](docs/antes/) and [`docs/prints/`](docs/prints/), including 390px mobile versions of every screen.

| Screen | 2023 | 2026 |
| --- | --- | --- |
| **Welcome**<br><sub>The 2023 app had a separate splash page (`inicio`) before this one; they are now a single entry.</sub> | <img src="docs/antes/landing-desktop.png" alt="" width="420"> | <img src="docs/prints/landing-desktop.png" alt="" width="420"> |
| **Student login**<br><sub>Was a modal on the landing page.</sub> | <img src="docs/antes/landing-login-aluno-desktop.png" alt="" width="420"> | <img src="docs/prints/landing-login-aluno-desktop.png" alt="" width="420"> |
| **Staff login**<br><sub>Staff sign-up was removed: accounts are created, not self-registered. Photo blurred: the original image had no license.</sub> | <img src="docs/antes/login-staff-desktop.png" alt="" width="420"> | <img src="docs/prints/login-staff-desktop.png" alt="" width="420"> |
| **Virtual tour**<br><sub>Scenery blurred: original images had no license.</sub> | <img src="docs/antes/visita-virtual-desktop.png" alt="" width="420"> | <img src="docs/prints/visita-virtual-desktop.png" alt="" width="420"> |
| **Student dashboard** | <img src="docs/antes/dashboard-aluno-desktop.png" alt="" width="420"> | <img src="docs/prints/dashboard-aluno-desktop.png" alt="" width="420"> |
| **Staff contacts** | <img src="docs/antes/contactos-staff-desktop.png" alt="" width="420"> | <img src="docs/prints/contactos-staff-desktop.png" alt="" width="420"> |
| **Student profile**<br><sub>The 2023 profile showed the password hash in the Password field.</sub> | <img src="docs/antes/perfil-aluno-desktop.png" alt="" width="420"> | <img src="docs/prints/perfil-aluno-desktop.png" alt="" width="420"> |
| **Staff: students**<br><sub>In 2023 the staff dashboard was this list of every user, staff included.</sub> | <img src="docs/antes/dashboard-staff-desktop.png" alt="" width="420"> | <img src="docs/prints/alunos-staff-desktop.png" alt="" width="420"> |
| **Staff profile** | <img src="docs/antes/perfil-staff-desktop.png" alt="" width="420"> | <img src="docs/prints/perfil-staff-desktop.png" alt="" width="420"> |
| **Private page, no session** | <img src="docs/antes/dashboard-sem-sessao-desktop.png" alt="" width="420"> | <img src="docs/prints/dashboard-sem-sessao-desktop.png" alt="" width="420"> |
| **Unknown URL (404)** | <img src="docs/antes/rota-inexistente-desktop.png" alt="" width="420"> | <img src="docs/prints/rota-inexistente-desktop.png" alt="" width="420"> |

New screens with no 2023 equivalent (tasks and notes lived inside the dashboard):

| Tasks | Notes | Staff dashboard | Cohort tasks |
| --- | --- | --- | --- |
| <img src="docs/prints/tarefas-desktop.png" alt="" width="320"> | <img src="docs/prints/notas-desktop.png" alt="" width="320"> | <img src="docs/prints/dashboard-staff-desktop.png" alt="" width="320"> | <img src="docs/prints/tarefas-turma-staff-desktop.png" alt="" width="320"> |

On a phone (390px), where the 2023 screens broke:

| | 2023 | 2026 |
| --- | --- | --- |
| **Student dashboard** | <img src="docs/antes/dashboard-aluno-mobile.png" alt="" width="260"> | <img src="docs/prints/dashboard-aluno-mobile.png" alt="" width="260"> |
| **Virtual tour**<br><sub>Scenery blurred: original images had no license.</sub> | <img src="docs/antes/visita-virtual-mobile.png" alt="" width="260"> | <img src="docs/prints/visita-virtual-mobile.png" alt="" width="260"> |
| **Staff contacts** | <img src="docs/antes/contactos-staff-mobile.png" alt="" width="260"> | <img src="docs/prints/contactos-staff-mobile.png" alt="" width="260"> |

## What changed and why

| 2023 | 2026 | Why |
| --- | --- | --- |
| The API had no authentication: `/auth/users` returned every user **with their password hash**, and anyone could edit or delete tasks, notes and users. | Session cookie (`httpOnly`, `SameSite=Lax`), sessions stored in the database, passwords hashed with argon2id. A student only sees their own data, only staff manage students, and the hash never leaves the API. | It's the first thing a reviewer checks. 40+ tests try to break it: reading another student's notes, a student calling staff routes, looking for the hash in every response. |
| Anyone could sign up as staff. Editing a user saved the password exactly as received. | No public sign-up: staff accounts come from the seed, students are created by staff with a temporary password, and changing a password asks for the current one and logs out other devices. | Fewer ways in, and a real password flow. |
| The task checkbox always started as "To do", so finished tasks looked unfinished. | The checkbox reads the saved state; ticking it is instant (optimistic) and rolls back if the API fails. | The bug from the original report, fixed and tested. |
| Not responsive: every screen broke on a phone. | Mobile-first for students (390px), sidebar on desktop and a bottom bar on mobile, like apps students already use. | New students live on their phones. |
| An unknown URL showed only the background gradient. | A real 404 page with a way home. | Users should never be stuck. |
| Two `cors()` calls; only two hard-coded origins worked. | One CORS config from the `CORS_ORIGIN` environment variable, plus CSRF protection. | Deployable anywhere without code changes. |
| The Pomodoro started at 0/0 minutes and didn't run until you moved the sliders. | 25/5 by default, adjustable, with pause, resume and reset, and a timer that doesn't drift in background tabs. | It now works the moment you see it. |
| Notes could be created and deleted, not edited. | A list and an editor, with "unsaved changes" and Ctrl/Cmd+S. | Notes are meant to grow during the course. |
| The tour was mouse-only, broke on mobile, used 10 MB of pre-recorded audio and images found online with no license. | Keyboard (← → Enter Esc), a progress bar with all 7 stops, screen-reader friendly text, the Web Speech API for "Play audio", and new SVG illustrations for every room and guide (about 10 KB each, instead of 1.5 MB JPGs). Like a visual novel, you can ask each guide questions, and the guides change expression and move their lips while they talk. On top of it, a **3D model of the campus** (React Three Fiber, every desk and sofa built in code): tap a room and the camera flies in, the next room glows, and the 2D tour stays as the fallback. | Accessible, faster, legally clean, and the audio always matches the text. |
| Deadlines were compared with the current time, so "days left" changed during the day. | Deadlines are dates; "Due today", "3 days left" and "Overdue" use the browser's local date, tested in three time zones. | A deadline is a day, not an instant. |

**Cohort tasks**, which the 2023 version didn't have: staff give a task to a whole cohort ("Sign the learning agreement"), students see it in their list as "From Marta Lopes · Program Manager" and can only tick it, and staff see "12 of 20 done" and who hasn't done it yet. One row per cohort task plus one row per completion, so editing the deadline reaches everyone and students who join later see it too.

New, small ideas: a **Week 1 progress** bar on the student dashboard, **Copy email** on staff contacts, and a staff dashboard with students per cohort, who hasn't taken the tour yet and recent activity.

## Stack

- **Client:** Vite, React 19, TypeScript (strict), Tailwind CSS v4, React Router, TanStack Query, Radix (dialogs, toasts), lucide-react, three.js with React Three Fiber (only on the tour page, loaded on demand). Fonts served locally: Poppins (headings), Inter (text), VT323 (the pixel touch, used only in the timer, the tour counter and the 404).
- **Server:** Node, Hono, Drizzle ORM, Postgres (PGlite locally, Neon in production), argon2id (hash-wasm), Zod. Deployed on Vercel.
- **Shared:** Zod schemas and types used by both sides, the tour content and the deadline logic.
- **Quality:** Vitest, ESLint, Playwright (end-to-end tests, screenshots and the video), axe for accessibility. GitHub Actions runs lint, types, unit and end-to-end tests on every push.

```
client/   React app (features/ per area, components/ui for the design system)
server/   Hono API, Drizzle schema, SQL migrations, seed, tests
shared/   Zod schemas, types, tour content, date helpers
e2e/      Playwright end-to-end and accessibility tests
scripts/  Playwright screenshots and video, guide expressions, Vercel build
docs/     Before/after screenshots, video, technical decisions
```

## Credits

**Kampus (2023)** was a team project at Ironhack's Web Development bootcamp and won **1st place**.

- **David Lucca** ([@davidvlucca](https://github.com/davidvlucca)): creative and visual direction, most of the CSS, and product ideas.
- **Bruno Carneiro**: API and back end.
- **Andre Gomes**: authentication and QA.

The 2023 code, with everyone's commits:
- Front end: [glowinZero/kampus](https://github.com/glowinZero/kampus) (my fork: [davidvlucca/kampus](https://github.com/davidvlucca/kampus))
- Back end: [glowinZero/project-3-backend](https://github.com/glowinZero/project-3-backend) (my fork: [davidvlucca/project-3-backend](https://github.com/davidvlucca/project-3-backend)). It started from Ironhack's REST API template, [bernardodemelo/m3-rest-api](https://github.com/bernardodemelo/m3-rest-api).
- Runnable copies used for the "before" screenshots, with a report of the 2023 bugs: [kairoos-studio/kampus-front](https://github.com/kairoos-studio/kampus-front) and [kairoos-studio/kampus-back](https://github.com/kairoos-studio/kampus-back).

**This version (2026)** was rebuilt from scratch by David Lucca with the help of AI (Claude Code), using the 2023 repositories as a reference for the features, the identity and the bugs to fix.

**Images.** The 2023 tour used scenery and guide portraits found on Google Images, with no license. They are not in this repository: the tour scenes and guides are new SVG illustrations made for this version. In the 2023 screenshots in `docs/antes/`, those images and the stock photos of the old login and splash pages are blurred.

## License

[MIT](LICENSE) for the code and the new illustrations. The 2023 screenshots in `docs/antes/` are documentation of the original team project and are not covered by the license.
