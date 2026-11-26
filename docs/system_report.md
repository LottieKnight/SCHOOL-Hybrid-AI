# SA Education Platform — System Report

**Generated:** March 6, 2025  
**Scope:** Full workspace analysis of the South African R–12 Education Platform monorepo.

**Note:** *school_analysis_1.jsx* was not found in the workspace. This report and recommended next steps are derived from the current project tree, `docs/RESTRUCTURE_PLAN.md`, and `docs/MVP_OPERATIONS.md`.

---

## 1. Folder Structure

### Current project tree (sa-edu-platform root)

```
apps/          content/    data/    docs/    infra/    node_modules/   packages/
scripts/       tools/      .env*   docker-compose.yml   package.json   README.md
tsconfig.base.json   CHANGELOG_RESTRUCTURE.md   (tmp-*.log, etc.)
```

```
AI LAB/
├── systems.md, ideas.md, projects.md, prompts.md, ai_context.md
└── projects/
    └── TDBS/
        └── sa-edu-platform/          # Main monorepo root
            ├── .env, .env.example, .env.local
            ├── package.json          # Workspace root (openai, concurrently, prisma, tsx)
            ├── package-lock.json
            ├── docker-compose.yml     # postgres, redis, api, web
            ├── tsconfig.base.json
            ├── .nvmrc, .gitignore, .semgrepignore
            ├── apps/
            │   ├── api/               # Fastify backend
            │   │   ├── src/           # db/, lib/, middleware/, queue/, routes/
            │   │   ├── migrations/   # 001_init.sql … 046_pricing_experiments.sql
            │   │   ├── test/
            │   │   ├── Dockerfile, package.json, tsconfig.json
            │   │   └── uploads/
            │   └── web/               # Next.js frontend
            │       ├── app/           # App Router: admin, learn, bookstore, messages, etc.
            │       ├── components/, lib/, styles/, stories/, test/
            │       ├── prisma/        # Past Papers schema (SQLite)
            │       ├── public/, data/
            │       ├── Dockerfile, package.json, next.config.mjs, tsconfig.json
            │       └── .next/
            ├── packages/
            │   └── shared/            # @saedu/shared
            │       ├── src/           # curriculum, lessons, RAG, gen, rag_v1, v2
            │       ├── scripts/       # ingest, RAG index/generate, seed, gen-lesson/gen-term
            │       ├── content/       # course_outline.json, caps_scaffold.json
            │       └── test/
            ├── content/               # lessons, pdf, rag, reports, sources, mappings
            ├── data/                  # past-papers, oer_catalog_seed.*
            ├── docs/                  # MVP_OPERATIONS.md, RESTRUCTURE_PLAN.md, etc.
            ├── infra/                 # README (Docker/CDN)
            ├── scripts/               # ingest-dbe, debug, doctor, backfill, warm
            └── tools/                 # check-env.mjs, prisma-generate-safe.mjs, security
```

---

## 2. Architecture Summary

The **SA Education Platform** is a production-oriented **monorepo** for a South African R–12 curriculum platform with:

- **Web:** Next.js 16 (App Router), SSR/SSG, glassmorphic UI.
- **API:** Fastify, PostgreSQL, Redis, BullMQ.
- **Shared:** TypeScript + Zod schemas, curriculum and lesson logic, RAG and AI lesson generation.

**Design highlights:**

- **MVP loop:** Learn → Past Papers → Marking/Feedback → Progress → Wallet.
- **Two data backends:**  
  - **PostgreSQL** (API): auth, users, tutors, messaging, bookstore, wallet, analytics, migrations in `apps/api/migrations/`.  
  - **SQLite (Prisma)** in `apps/web`: DBE Past Papers catalog and attempts; schema in `apps/web/prisma/schema.prisma`.
- **Content:** File-based lesson JSON under `content/lessons` and `content/generated_lessons/v1`; canonical outline in `packages/shared/content/course_outline.json`.
- **Lesson generation:** RAG v1 (file-based) is canonical; DB-first “generated content v2” and Lesson v2 are retired (410 Gone).
- **Deployment:** Docker Compose for Postgres, Redis, API, Web; optional S3 for media and past-papers storage.

---

## 3. Backend, Frontend, Database, and AI Modules

### Backend (`apps/api`)

| Layer | Technology | Location |
|-------|------------|----------|
| Runtime | Node 18/20, ESM | `apps/api` |
| Framework | Fastify 5 | `src/server.ts`, `src/index.ts` |
| DB access | Raw SQL + `pg` | `src/db/*.ts` (pool, users, tutors, wallet, bookstore, etc.) |
| Migrations | SQL files | `migrations/001_init.sql` … `046_*.sql` |
| Auth | JWT + signed cookie, `@fastify/jwt` | `src/middleware/auth.ts`, `src/routes/auth.ts` |
| Queue | BullMQ + Redis | `src/queue/index.ts` |
| Observability | Sentry, prom-client | `src/lib/observability.ts`, config |
| Routes | Auth, billing, catalog, bookstore, curriculum, health, lessons (quiz), messages, profile, schools, signups, tutors, admin, analytics, wallet | `src/routes/*.ts` |

**Note:** The API does **not** depend on `@saedu/shared`. Admin lesson generation is done by spawning `tsx` to run scripts in `packages/shared` (e.g. RAG v1 generate).

### Frontend (`apps/web`)

| Layer | Technology | Location |
|-------|------------|----------|
| Framework | Next.js 16 (App Router) | `app/`, `next.config.mjs` |
| UI | React 18, CSS modules | `app/**/*.tsx`, `components/`, `styles/` |
| Shared code | `@saedu/shared` | Transpiled via `transpilePackages` in next.config |
| Past Papers | Prisma Client (SQLite) | `lib/prisma.ts`, `lib/pastPapers/*`, `app/api/past-papers/` |
| Key routes | `/learn`, `/admin/*`, `/bookstore`, `/messages`, `/classes/[classId]/past-papers`, `/cart`, `/checkout`, `/store/equipment`, `/dashboard`, `/tutors`, `/wallet` | `app/` |
| Testing | Vitest, Storybook, Playwright | `test/`, `stories/`, vitest.config.ts |

### Databases

| System | Role | Location / Connection |
|--------|------|------------------------|
| **PostgreSQL** | Main app DB (users, auth, tutors, messaging, bookstore, wallet, analytics) | `DATABASE_URL`; migrations in `apps/api/migrations/` |
| **Redis** | Sessions, rate limit, BullMQ | `REDIS_URL` |
| **SQLite (Prisma)** | DBE Past Papers (sources, papers, questions, attempts) | `PAST_PAPERS_DATABASE_URL`; schema in `apps/web/prisma/schema.prisma` |

### AI Modules

| Module | Purpose | Location | API |
|--------|---------|----------|-----|
| **RAG v1** | File-based lesson generation from RAG index (BM25/keyword) | `packages/shared/src/rag_v1/` (generator, retrieval) | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_BASE`; uses `fetch()` to OpenAI chat/completions |
| **Legacy RAG** | Older RAG index + generate (superseded by v1) | `packages/shared/src/rag/` | Same env vars; fetch-based |
| **Gen (DB-first)** | Retired DB-first lesson/term generator | `packages/shared/src/gen/lessonGenerator.ts` | Same env vars; fetch-based |
| **V2 generate** | Retired Lesson v2 generation | `packages/shared/src/v2/generateLesson.ts` | Same env vars; fetch-based |
| **Quiz generator** | Local (no LLM) fill-in-blank style quiz | `packages/shared/src/quiz-generator.ts` | N/A |

**OpenAI usage:** All current AI call paths use **native `fetch()`** to the OpenAI-compatible `/chat/completions` endpoint. The root `package.json` lists the `openai` npm package, but application and shared code do not import it; it may be for future use or optional tooling.

---

## 4. Missing Components and Broken Dependencies

### Missing or Optional Components

- **OPENAI_API_KEY:** Required for RAG v1 and admin “Generate lesson” flows. Documented in `.env.example` and README; not set by default.
- **Stripe (Bookstore):** Optional. `BOOKSTORE_PAYMENT_PROVIDER=stripe` plus `STRIPE_SECRET_KEY` (and webhook secret if used); default is `stub`.
- **S3 (Past Papers / media):** Optional. `PAST_PAPERS_STORAGE=s3` and S3_* env vars for production; local uses SQLite + local files.
- **Sentry:** Optional. `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` for API and web.

### Potential Issues

1. **Stale or broken `.next` paths (Windows):**  
   Grep reported “The system cannot find the path specified” for some symlinked paths under `apps/web/.next/dev/node_modules/` and `apps/web/.next/node_modules/`. These are typically build/cache artifacts. **Recommendation:** Run `npm run build -w apps/web` from repo root or delete `apps/web/.next` and rebuild.

2. **README vs root scripts:**  
   README says “Run migrations: `npm run migrate -w apps/api`”. The correct root script is `npm run db:migrate` (which runs `npm run migrate -w apps/api`). Consider aligning README to `npm run db:migrate`.

3. **Past Papers predev:**  
   `predev` runs `db:past-papers:generate` (Prisma generate for Past Papers schema). Requires `PAST_PAPERS_DATABASE_URL` (e.g. `file:./past-papers.db`). If missing, `tools/check-env.mjs` fails; `.env.example` documents it.

4. **Node version:**  
   Repo targets Node 18/20; Node 22+ may warn or fail in some deps. `.nvmrc` and engines in package.json enforce this.

### Dependency Summary

- **Root:** `openai`, `concurrently`, `prisma`, `tsx`, `typescript` (dev). Workspaces: `apps/*`, `packages/*`.
- **apps/api:** Fastify stack, `pg`, `ioredis`, `bullmq`, `bcryptjs`, `zod`, `@sentry/node`, etc. No `@saedu/shared`.
- **apps/web:** Next.js, React, `@saedu/shared`, `@prisma/client`, `marked`, `pdf-parse`, `sanitize-html`, etc.
- **packages/shared:** `pg`, `pdf-parse`, `zod`; no direct `openai` dependency; uses env-based fetch for LLM.

No missing or obviously broken npm dependencies were identified in package.json files; the only operational issues noted are the `.next` path errors (fixable by rebuild) and README migration command wording.

---

## 5. Summary

| Area | Status |
|------|--------|
| **Folder structure** | Monorepo with `apps/api`, `apps/web`, `packages/shared`, `content`, `data`, `docs`, `scripts`, `tools` |
| **Backend** | Fastify API with Postgres, Redis, BullMQ; 46 SQL migrations; no direct use of `@saedu/shared` |
| **Frontend** | Next.js 16 App Router; consumes `@saedu/shared`; Prisma for Past Papers (SQLite) |
| **Databases** | Postgres (main), Redis (cache/queue), SQLite/Prisma (Past Papers) |
| **AI** | RAG v1 (canonical), legacy RAG/gen/v2 (retired or fetch-based); all use OpenAI-compatible fetch |
| **Missing/broken** | Optional: OPENAI_API_KEY, Stripe, S3, Sentry. Fix: rebuild web (`.next` path noise); align README to `npm run db:migrate` |

The platform is coherently structured with clear separation between API, web, and shared packages, and with documentation in `docs/` (e.g. `RESTRUCTURE_PLAN.md`, `MVP_OPERATIONS.md`) describing the target MVP and operations.
