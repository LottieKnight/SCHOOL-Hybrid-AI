# AURA / SCHOOL — Build Roadmap (Decomposition)

**Date:** 2026-05-31
**Status:** Roadmap approved-for-review. Each sub-project below gets its own spec → plan → implementation cycle.
**Source:** "AURA / SCHOOL Master Plan" handoff spec.

This document is **not** an implementation spec. It is the whole-board map: it decomposes the
Master Plan into seven sequenced sub-projects, records the decisions already locked, grounds each
step in what actually exists in the repo today, and names the dependencies and risks. We build one
sub-project at a time, starting with Step 1.

---

## Naming

- **SCHOOL** — the platform (this monorepo).
- **AURA** — the assistant brand + model-orchestration layer being added.
- **AURA School** — tenant: curriculum-grounded teacher assistant.
- **AURA NWU** — tenant: North-West University campus-support assistant.

Tenants share **no** retrieval indexes, memory, feedback loops, eval sets, source corpora, or prompts.
They share only: platform shell, auth, orchestration, observability, guardrails, export plumbing.

---

## Locked decisions

1. **Decomposition over one big spec.** Seven sub-projects, built and shipped in order. Step 1 is
   foundational; everything downstream depends on it.

2. **Provider transport = Option C.** The provider abstraction is built on the **Vercel AI SDK**,
   talking **provider-direct** (`@ai-sdk/openai`), with:
   - **Vercel AI Gateway deferred** as a one-flip upgrade (model string `openai('gpt-5.5')` →
     gateway `'openai/gpt-5.5'`) for failover / unified billing / observability when wanted.
   - **Raw OpenAI client reserved as an escape hatch for the Realtime voice API only** (Step 5),
     isolated behind the provider seam.
   - Rationale: the AI SDK's unified interface (`generateObject` for structured output, `embed`,
     `transcribe`, speech) is the expensive-to-retrofit value and is captured now; the Gateway is
     the cheap-to-retrofit value and is deferred. The API runs on **Railway**, not Vercel, so the
     Gateway's zero-config (OIDC) convenience is muted for half the codebase — another reason not
     to couple to it on day one.

3. **Reconciliation with the spec's "use the Responses API" instruction.** On the AI SDK, the
   chat/completions-vs-Responses transport choice is hidden below the SDK. We satisfy the spec's
   *intent* — structured outputs, multi-turn state, modern path — without a literal endpoint
   migration. If a specific OpenAI feature ever requires Responses directly, it stays isolated
   behind the provider seam.

---

## Current state (verified 2026-05-31)

Monorepo: `apps/web` (Next.js, on **Vercel**), `apps/api` (on **Railway**), `packages/shared`.

- **OpenAI usage is scattered across ~15+ call sites**, not the 3 the spec names. All use raw
  `fetch` to `/chat/completions` with `gpt-4o-mini`. Beyond the three shared files, includes
  `apps/web/app/api/assistant/*`, `study-assistant`, `intelligence/transcribe`,
  `intelligence/flashcards`, `games/score-ai`, and `apps/web/lib/{embeddings,memory,topicExtractor,server/plannerText}.ts`,
  plus an older `packages/shared/src/rag_v1/generator.ts`.
- **Identical duplication at every site:** each re-resolves `OPENAI_API_KEY`/`OPENAI_API_BASE`/`OPENAI_MODEL`
  from env, POSTs chat/completions, hand-rolls error handling, and parses model output with
  `JSON.parse` + ad-hoc salvage (`extractJson`). This is the bug class `generateObject` removes.
- **Dependencies:** `openai` SDK v6 already installed (root + web); `zod` already installed
  (api + shared). The **AI SDK (`ai`, `@ai-sdk/openai`) is not yet installed** — Step 1 adds it.
- **Two separate database stacks:**
  - `apps/api/migrations/*.sql` — hand-rolled numbered SQL migrations (`001`–`010`), Postgres,
    run via `npm run db:migrate` (`migrate -w apps/api`). **This is the main app DB.**
  - `apps/web/prisma/schema.prisma` — separate Prisma store (SQLite local / Postgres-ready),
    **only** for DBE past-papers.
- **No `tenant` concept anywhere.** Net-new in Step 2.
- **"NWU" ≠ existing university code.** The repo has a student-facing *university/institution*
  domain (`university-profile`, `university-catalog`, `seed-institutions`,
  `scrape-module-timetable`, `institutionSeedData`). The AURA **NWU campus-support assistant**
  does **not** exist. Reuse opportunity *and* naming-collision risk — flagged in Step 4.
- **No evals** of any kind. Net-new in Step 6.
- **Voice ~95% net-new:** only one transcription route exists (`intelligence/transcribe`); no
  Realtime, no TTS.
- **A fine-tuned CAPS model is present** (`caps_finetune_clean.jsonl`, `models/school-caps`). The
  provider seam must keep it reachable as a model string / custom `baseURL`.
- **i18n already shipped** (Phase 1, next-intl, all 11 SA languages) — see
  `2026-05-30-next-intl-i18n-design.md`. The language layer (Step 5) builds on this, not from scratch.

---

## Sub-project sequence

### Step 1 — Provider abstraction layer  ← **build first**

- **Goal.** One provider-neutral interface in `packages/shared`, on the AI SDK (Option C), and
  migrate the ~15 raw-fetch call sites onto it. Interface surface:
  `generateText`, `generateStructured`, `embedText`, `transcribeAudio`, `speakText`,
  `openRealtimeSession`. Product code must never touch provider-specific response shapes.
- **Current state.** Net-new module; `openai`/`zod` present, AI SDK absent.
- **Key decisions (resolve in the Step-1 spec).** Module location/shape in `packages/shared`;
  how `generateStructured` takes a Zod schema; env/config consolidation (single resolver replacing
  the per-site `OPENAI_*` reads); default model + per-task `reasoning.effort`; how the CAPS
  fine-tune is addressed as a model; migration order (shared files first, then web routes);
  whether `speakText`/`openRealtimeSession` are stubbed now or deferred to Step 5.
- **Risks.** AI SDK v6 vs the installed `openai` v6 coexisting; behaviour parity for call sites that
  currently depend on quirks of the salvage parser; not regressing streaming where it's already used.
- **Acceptance.** All targeted call sites compile and pass through the interface; structured calls
  validate against a schema instead of `JSON.parse`; `typecheck` + `test` green; no product file
  imports `openai` or calls `fetch('/chat/completions')` directly (except the isolated voice hatch).
- **Dependencies.** None. Unblocks all of 2–7.

### Step 2 — Tenant isolation + session state + schema

- **Goal.** Tenant-scoped data model and routing. Shared platform tables from the spec
  (`tenants`, `assistant_profiles`, `assistant_sessions`, `assistant_messages`, `assistant_runs`,
  `assistant_run_sources`, `assistant_feedback`, `eval_*`), with hard tenant isolation enforced and
  tested.
- **Current state.** No tenant concept. Main DB = `apps/api` numbered SQL migrations.
- **Key decisions.** **Recommendation: tenant tables live in the `apps/api` numbered-migration
  stack** (continue `011_...sql`), not Prisma — keep the past-papers Prisma store separate.
  Tenant-scoping mechanism (column-scoped + enforced in a data-access layer vs Postgres RLS);
  session-state strategy (the spec's `previous_response_id` notion vs our own `assistant_sessions`
  rows under Option C).
- **Risks.** Cross-tenant leakage is the headline acceptance criterion — needs explicit leakage
  tests, not just schema. Two-DB-stack confusion.
- **Acceptance.** Migrations apply; a written cross-tenant leakage test proves AURA NWU cannot read
  AURA School data and vice-versa.
- **Dependencies.** Step 1 (runs/messages reference provider output).

### Step 3 — AURA School text assistant

- **Goal.** Replace the stub curriculum flow with ATP-aware retrieval + structured weekly/daily plan
  generation grounded in the ATP slice; "simpler / more detailed / printable" variants.
- **Current state.** Real curriculum + RAG code exists (`packages/shared/src/rag/*`,
  `v2/generateLesson.ts`, `curriculum.ts`, `apps/api/src/routes/curriculum.ts`). This step *upgrades*
  existing flows onto the provider seam + structured output, not greenfield.
- **Key decisions.** ATP-slice resolution; hybrid retrieval shape; the weekly-plan Zod schema.
- **Risks.** Largest existing surface area; regressing working lesson generation.
- **Acceptance.** Planner returns structured weekly/daily plans grounded in ATP.
- **Dependencies.** Steps 1, 2.

### Step 4 — AURA NWU campus assistant

- **Goal.** Ingest approved campus sources; location/service/policy search; short, grounded,
  privacy-safe answers; escalation for account-specific questions instead of guessing.
- **Current state.** Does **not** exist. Adjacent student-facing "university/institution" code
  exists and must not be conflated (collision risk).
- **Key decisions.** Whether any existing institution/calendar data is reusable as a campus source;
  the approved-source ingestion boundary; escalation workflow.
- **Risks.** Naming collision with existing university domain; scope creep into student-facing
  features; privacy (answers must be account-agnostic).
- **Acceptance.** Answers come only from approved campus sources; AURA NWU never reads school
  curriculum data; account-specific questions escalate.
- **Dependencies.** Steps 1, 2 (proves isolation with a second real tenant).

### Step 5 — Voice layer (narrow pilot)

- **Goal.** Audio capture, ASR, TTS, Realtime; pipeline = capture → VAD → language ID → ASR →
  tenant/domain routing → retrieval → generation → TTS; barge-in, streaming, text fallback.
  Rollout: English/Afrikaans baseline → Sepedi pilot → remaining languages, each quality-gated.
- **Current state.** ~95% net-new; one transcription route exists. i18n (11 languages) already
  shipped and is the language-layer foundation.
- **Key decisions.** Whether Realtime uses the raw OpenAI escape hatch behind the seam; one voice
  persona per tenant (not per language); response-language mirroring + technical-term preservation.
- **Risks.** Low-confidence languages must fall back to text/clarification, never hallucinate;
  latency; this is explicitly **not** an early milestone.
- **Acceptance.** Voice preserves the user's language as far as the model reliably supports; low-
  confidence languages fall back; production voice only after per-language eval gates pass.
- **Dependencies.** Steps 1, 2, 3 (text + retrieval stable first). **Do not start before 3 is solid.**

### Step 6 — Evals, feedback, and promotion loop

- **Goal.** `eval_sets`/`eval_cases`/`eval_runs`; per-turn logging (tenant, session, language,
  intent, sources, output, feedback; for voice also audio ref, transcript, diarization, timestamps,
  latency, confidence); language-growth annotations; periodic promotion of **reviewed-only** data
  into KB/prompts/eval sets.
- **Current state.** None.
- **Key decisions.** Eval-set isolation per tenant; the human-review/promotion gate (no auto-training
  on raw conversations); annotation schema.
- **Risks.** Accidentally mixing tenant eval data; promoting unreviewed data.
- **Acceptance.** Transcript data is versioned, reviewed, and used only through controlled updates.
- **Dependencies.** Steps 1–5 (needs real traffic to evaluate); per-tenant eval gates feed Step 5
  rollout.

### Step 7 — Hardening

- **Goal.** Eval automation, latency tuning, rollback paths, release gates. Pre-merge: typecheck,
  unit/integration, targeted retrieval + tenant-leak tests, voice smoke on staging. Pre-prod:
  migrate, deploy API (Railway), deploy web (Vercel), verify retrieval + voice in staging, promote
  only after eval gates pass.
- **Current state.** Strong security tooling already exists (`security:*` scripts: audit, semgrep,
  gitleaks, trivy, headers). Build on it.
- **Dependencies.** All prior steps.

---

## Dependency graph

```
Step 1 (provider seam) ─┬─> Step 2 (tenancy) ─┬─> Step 3 (School text) ─┬─> Step 5 (voice pilot) ─┐
                        │                      └─> Step 4 (NWU campus) ──┘                          ├─> Step 6 (evals/loop) ─> Step 7 (hardening)
                        └──────────────────────────────────────────────────────────────────────────┘
```

Critical path: **1 → 2 → 3 → 5**. Step 4 parallels Step 3 once 2 is done. Step 6 needs live traffic
from 3–5. Step 7 is last.

---

## Cross-cutting risks

- **Two DB stacks** — every schema decision must state which stack it targets (default: `apps/api`
  numbered migrations; past-papers Prisma stays separate).
- **Tenant leakage** is the single most important correctness property; it is an explicit acceptance
  criterion in Steps 2, 3, 4, and 6, enforced by tests, not convention.
- **Scope discipline** — voice (5) and evals (6) must not start before text + retrieval (1–3) are
  stable, per the Master Plan's own "do not make voice the first milestone."
- **Provider lock-in is bounded** by Option C: Gateway and any raw-OpenAI voice usage stay behind
  the Step-1 seam, so they're swappable.

---

## Next step

Brainstorm **Step 1 — Provider abstraction layer** into its own implementation-ready spec
(`docs/superpowers/specs/2026-05-31-aura-provider-abstraction-design.md`), then plan and build it.
Each later step repeats the spec → plan → build cycle when its dependencies are met.
