# Canonical Route Inventory — SCHOOL (1996-09-20)

Compiled from `apps/web/app/**` source + live probes. Auth = production behaviour observed for unauthenticated visitors. Status taxonomy: LIVE / PARTIAL / EXPERIMENTAL / COMING SOON / UNUSED / DEPRECATED / **BROKEN** (production defect).

## Primary destinations (shell nav)

| Route | Auth | Purpose / primary action | Data deps | States | Live status |
|---|---|---|---|---|---|
| `/` | Public | Marketing landing — go to register/learn/dashboard | static | skeleton n/a | LIVE |
| `/dashboard` | Session-dep | **Home**: next action, progress, campus | analytics, memory, quests, mentor-match, leaderboard APIs | ⚠️ guest fires authed calls → Empty/Error boundary; hydration #418; `TypeError 'length'` | **BROKEN** (guest) |
| `/learn` | Public | Learn hub (CAPS phases, university, prof quals) | curriculum | skeleton/layouts | LIVE |
| `/past-papers` | Public | Search papers — dominant search + filters | Prisma past-papers (SQLite, Vercel) | loading/empty/error | LIVE |
| `/community` | Public | Campus feed + Q&A | community (backend) + web social routes | loading/error | LIVE (feed degrades w/ backend down) |
| `/profile` | Auth | Redirect → `/profile/learning` | auth | n/a | LIVE |
| `/assistant` | Session-dep | **AI Tutor**: explain/quiz/mixed, multilingual | AI endpoints (web) | streaming/error/offline | PARTIAL (guest mode limited) |
| `/notifications` | Auth | Notifications center | notifications | empty | LIVE |
| `/settings` | Auth | Account/security/theme/DSAR | profile, security | n/a | LIVE |
| `/messages` | Auth | DMs + channel workspaces | messages (backend) | n/a | PARTIAL (backend down) |

## Learn

| Route | Auth | Purpose | Status |
|---|---|---|---|
| `/learn/[phase]/[grade]/[subject]/…` | Public | Roadmap → week lessons / practice / exam / flashcards | LIVE |
| `/university/learning` | Auth | University learner hub | PARTIAL (auth redirect when signed out is correct) |
| `/university/modules/[moduleCode]` | Auth | Module detail (notes, past papers) | PARTIAL |
| `/learn/ekrp211`,`/learn/wves312` | Public | Sample module readers | LIVE |
| `/learn/re1`,`/learn/re5`,`/learn/professional` | Public | Professional qualification prep | LIVE |
| `/study`, `/study/new` | Session-dep | Study chat assistant | PARTIAL |
| `/textbooks`, `/resources`, `/library` | Public/Auth | Book shelves / resource library | LIVE |
| `/phase/*` | Public | Legacy → redirect `/learn` | DEPRECATED |

## Practice

| Route | Auth | Purpose | Status |
|---|---|---|---|
| `/past-papers/[id]`, `…/attempt`, `/past-papers/viewer` | Session-dep | Paper detail, attempt, viewer | LIVE |
| `/daily-quiz` | Public | Daily CAPS quiz + streak | LIVE |
| `/classes/*` | Public | Legacy class-scoped papers → redirect `/past-papers` | DEPRECATED (`/classes` root **404**) |
| `/community/games/exam-dash` | Public | Exam Dash game | LIVE |

## Community

| Route | Auth | Purpose | Status |
|---|---|---|---|
| `/community/questions` | Public | Q&A board | LIVE |
| `/community/rooms/[moduleCode]` | Auth | Module rooms | PARTIAL |
| `/community/circles` | Session-dep | Study circles (401s for guests) | PARTIAL |
| `/community/leaderboard` | Public | Weekly leaderboard | **BROKEN** (SSR 500 — DB/Redis down) |
| `/community/games` + 15 games | Public | Games Center | LIVE (some games EXPERIMENTAL/flag-gated) |
| `/community/music` | Session-dep | Music profiles | PARTIAL |
| `/community/saved` | Auth | Saved posts | LIVE |
| `/tutors/*` | Public/Auth | Find-a-tutor, dashboard, sessions, onboarding | PARTIAL (backend down) |

## Services / More

| Route | Auth | Purpose | Status |
|---|---|---|---|
| `/planner` | Session-dep | Student planner calendar | **BROKEN** (SSR 500) |
| `/bursary` | Public | Bursary finder + APS calc | LIVE |
| `/credits` | Auth | Scholar Credits ledger | PARTIAL (backend down) |
| `/wallet` | Auth | Top-ups / spend | PARTIAL (Supabase paused) |
| `/marketplace`, `/bookstore`, `/store/*`, `/sellers`, `/cart`, `/checkout`, `/orders` | Public/Auth | Commerce | LIVE (commerce paths on SQLite/local) — verify PayFast (Supabase paused) |
| `/press`, `/press/[slug]`, `/press/new` | Public/Auth | SCHOOL Press | LIVE |
| `/feedback` | Public | Feature roadmap voting | LIVE |

## Profile / Account / Legal / Utility

| Route | Auth | Purpose | Status |
|---|---|---|---|
| `/profile/learning` | Auth | Journey (learning progress) | LIVE |
| `/profile/[username]` etc. | Public | Public profile | LIVE |
| `/auth`, `/login`, `/signup` | Public | Auth entry | **BROKEN** (submits → 404 via dead backend) |
| `/forgot-password` … `/verify-phone`, `/confirm-email-change`, `/onboarding` | Public | Recovery/onboarding | PARTIAL (backend down) |
| `/onboarding/university` | Session-dep | University onboarding | **BROKEN** (SSR 500) |
| `/guide` | Public | Static user guide | LIVE |
| `/features` | Public | Features + changelog | LIVE |
| `/legal/*` (privacy, terms, cookies, aup, paia, research-consent) | Public | Legal | LIVE |
| `/offline` | Public | PWA offline fallback | LIVE |
| `/health` | Public | Railway liveness | LIVE (route exists) |
| `/admin/*` | Admin | Admin console (32 sections; feature-flags included) | LIVE (guard: verify server-side, not just UI) |
| `/prototype/*` | Public | Design prototype area (no shell) | EXPERIMENTAL — do not surface |
| `/test/themes` | Public | Theme test | EXPERIMENTAL — do not surface |

## Key production states to fix before release
1. **BROKEN:** `/auth` flow, `/planner`, `/onboarding/university`, `/community/leaderboard`, `/dashboard` (guest), `/classes` (404).
2. **PARTIAL-while-backend-down:** credits, wallet, messages, tutors, circles, notifications IDs, proxied `/api/*`.
3. Singular `/total` claims (paper counts, etc.) must be re-sourced or removed (see sitemap domain error as an example of stale claims).