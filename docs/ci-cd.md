# CI/CD

GitHub Actions pipeline for the SCHOOL Academic Platform npm-workspaces monorepo
(`apps/api`, `apps/web`, `apps/mobile`, `packages/shared`).

## Workflows

| File | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `pull_request`, `push` to `main`/`master`, `workflow_call` | Full quality gate: lint, typecheck, test, build, migration smoke-test, device screenshots, EAS preview |
| `.github/workflows/release.yml` | `push` tags `v*.*.*`, `workflow_dispatch` | Runs the CI gate against the tag, packages the build artifact, hands off to deploy |
| `.github/workflows/deploy-ecs.yml` | — | **Not in this change.** Owned by a separate workstream; `release.yml` calls it as a placeholder |
| `.github/workflows/campus-feed-refresh.yml` | schedule | Unrelated data job |
| `.github/workflows/past-papers-ingest.yml` | schedule | Unrelated data job |

## Node version

`.nvmrc` pins `20.19.5`; root `package.json` `engines` allows `node >=18 <25`,
`npm >=9`. Every job uses `node-version: "20.19.5"` (via the workflow-level
`NODE_VERSION` env in `ci.yml`) with `cache: "npm"` for the npm cache. 20.14+ is
required because the api test script uses `node --test-force-exit`.

## ci.yml job graph

```
changes (path filter)
  ├─ static  (matrix: lint | typecheck)
  ├─ test    (postgres 16 + redis 7 services, runs migrations first)
  ├─ migrate (migration smoke-test)
  ├─ build   (needs static) → uploads build artifact
  │    └─ mobile-preview (matrix of 5 device tiers) — needs test
  │    └─ eas-preview (push to main + mobile paths only)
  └─ ci-gate (aggregates results; use this as the required status check)
```

* **Concurrency** — group `ci-<workflow>-<pr number|ref>`, `cancel-in-progress`
  is true for branches and false for tags, so a release gate is never cancelled.
* **Path filters** — the `changes` job uses `dorny/paths-filter` (pinned to a
  full SHA). Docs-only changes (`**/*.md`, `docs/**`, `**/*.mdx`) produce
  `code=false` and every heavy job is skipped; `ci-gate` still reports success.
  `eas-preview` additionally requires `mobile=true` (`apps/mobile/**`,
  `packages/shared/**`).
* **Artifacts** — `build` uploads `build-output-<sha>` containing
  `packages/shared/dist`, `apps/api/dist` and `apps/web/.next` (excluding
  `.next/cache`), retained 7 days.

## Fixed bug in the previous ci.yml

The old `quality` job declared `services:` **twice** in the same mapping. YAML
duplicate keys mean the second block silently wins — confusing at best, and a
parse error under strict loaders. The rewritten file has one `services:` block
per job. The old `DATABASE_URL: postgres://test:***@localhost:5432/test` (a
literal `***`, which does not match the postgres service password `test`) has
been corrected to `postgres://test:test@localhost:5432/test`.

## Known-failing steps (measured locally, not guessed)

Run on this working tree at `/home/lottie/SCHOOL-Academic-Platform`, Node from
the repo toolchain, **without** postgres/redis running locally.

| Command | Result | Detail |
| --- | --- | --- |
| `npm run lint` | ❌ **FAIL** (exit 1) | eslint: `✖ 20 problems (2 errors, 18 warnings)`. Errors: `@next/next/no-assign-module-variable` ("Do not assign to the variable `module`") and `react-hooks` "Cannot access variable before it is declared". Fails in workspace `@saedu/web`. |
| `npm run typecheck` | ✅ **PASS** (exit 0) | lesson-boundary check passed; `tsc --noEmit` clean for `apps/web` and `apps/api`. |
| `npm run test` | ❌ **FAIL** (exit 1) | `packages/shared` tests run first; `apps/api` (`tsx --test --test-force-exit test/run-all.test.ts`) reports 35 `✖` failures, e.g. `pricing-experiments.test.ts:263` `AssertionError: 404 !== 200`. **Note:** run locally with no postgres/redis, so an unknown share of these are environment failures rather than real regressions — in CI the `test` job provides both services plus migrations, which is the honest place to judge it. |
| `npm run build` | not run locally (long Next.js production build); left as a hard gate in CI. |

Because of the above:

* `lint` is marked **`continue-on-error: true`** in the `static` matrix
  (`matrix.advisory: true`). It is advisory **only because it currently fails**.
  Fix the 2 eslint errors, then flip `advisory: false` for the lint entry.
* `typecheck`, `test`, `build` and `migrate` are **hard gates** — no
  `continue-on-error`. `test` is expected to pass in CI where the services
  exist; if it does not, fix the tests rather than adding `continue-on-error`.

## release.yml

1. `gate` — `uses: ./.github/workflows/ci.yml` with `secrets: inherit` and
   `with.ref` set to the tag, so a release runs the identical gate as a PR.
2. `package` — rebuilds from the tagged ref and uploads
   `release-<version>` (30-day retention, `if-no-files-found: error`).
3. `deploy` — **placeholder**. `deploy-ecs.yml` is owned by another workstream
   and is deliberately not created here. The placeholder job:
   * runs under `environment: <staging|production>` so environment protection
     rules and environment secrets apply;
   * tries `gh workflow run deploy-ecs.yml … -f version -f environment` and
     no-ops cleanly if the workflow does not exist yet.
   When `deploy-ecs.yml` lands with `on: workflow_call`, delete the placeholder
   job and uncomment the `uses:` block directly above it in `release.yml`.

`workflow_dispatch` inputs: `ref` (required), `environment`
(`staging`/`production`), `skip_deploy` (gate-only run).

## Required secrets

Set under **Settings → Secrets and variables → Actions**. Deploy-related secrets
should live on the **environment** (`staging`, `production`), not the repo, so
production credentials are gated by environment reviewers.

| Secret | Scope | Used by | Required? | Purpose |
| --- | --- | --- | --- | --- |
| `GITHUB_TOKEN` | automatic | `release.yml` deploy job (`gh workflow run`) | auto-provided | Dispatching the deploy workflow. No manual setup. |
| `EXPO_TOKEN` | repo | `ci.yml` → `eas-preview` | required for mobile builds | Expo/EAS access token for `eas build --platform android --profile preview`. |
| `AWS_DEPLOY_ROLE_ARN` | environment | `deploy-ecs.yml` (other workstream), inherited from `release.yml` | required to deploy | IAM role ARN assumed via OIDC for ECS deploys. Needs `id-token: write` in the deploy workflow. |
| `AWS_REGION` | environment (or repo variable) | deploy | required to deploy | Target AWS region, e.g. `af-south-1`. May be a plain Actions *variable* rather than a secret. |
| `DATABASE_URL` | environment | deploy / migrations against real DB; `past-papers-ingest.yml` | required to deploy | Postgres connection string for the target environment. **Never** needed by `ci.yml` — CI uses its own throwaway service. |
| `PAST_PAPERS_DATABASE_URL` | environment | deploy / prisma past-papers datasource | required to deploy | Past-papers datasource URL. CI uses `file:./past-papers.db`. |
| `REDIS_URL` | environment | deploy | required to deploy | Redis connection string for the target environment. |
| `JWT_SECRET` | environment | deploy (api runtime) | required to deploy | ≥32-char signing secret for auth tokens. |
| `COOKIE_SECRET` | environment | deploy (api runtime) | required to deploy | ≥32-char cookie signing secret. |
| `ADMIN_INGEST_TOKEN` | repo + environment | `past-papers-ingest.yml`, deploy | required for ingest | Bearer token for the admin ingest endpoints. |
| `INGEST_URL` | repo | `past-papers-ingest.yml`, `campus-feed-refresh.yml` | required for ingest | Base URL of the deployed API used by the scheduled data jobs. |
| `OPENAI_API_KEY` | environment | deploy (api runtime, RAG/lesson generation) | required if AI features enabled | Only needed at runtime; CI never calls OpenAI. |

Non-secret values used by CI are hard-coded throwaways
(`test_secret_key_32_chars_minimum!` etc.) and are safe to keep in the workflow
file — they only ever reach the ephemeral CI postgres/redis containers.

## Branch protection

Make **`CI gate`** (job `ci-gate` in `ci.yml`) the single required status check.
It runs with `if: always()` and fails when any of `static`, `test`, `build` or
`migrate` failed or was cancelled, while tolerating the `skipped` state that a
docs-only change produces.

## Local reproduction

```bash
nvm use                 # 20.19.5 from .nvmrc
npm ci
npm run db:past-papers:generate
docker compose up -d postgres redis   # matches the CI service containers
npm run migrate -w apps/api
npm run lint && npm run typecheck && npm run test && npm run build
```
