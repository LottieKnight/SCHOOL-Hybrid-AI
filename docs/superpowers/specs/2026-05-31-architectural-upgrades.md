# Architectural Upgrades — Implementation Plan (post-green baseline)

> Status: **GREEN baseline locked.** In-repo wiring shipped (accepted-answer
> 20-credit award — see `apps/api/src/db/community.ts` `acceptAnswer` +
> `POST /community/posts/:id/accept`; SCHOOL Press v1 verified complete:
> migration `083_publications.sql` + `db/press.ts` + `routes/press.ts`
> + registration in `server.ts`).
>
> The remaining upgrades below need **external secrets the sandbox cannot
> provision** (`VOYAGE_API_KEY`, translation API, tenant config) OR are large
> cross-cutting refactors with no test coverage. They are **SPEC-stage** for a
> credentialed operator. No new migration is required for the accepted-answer
> feature (`posts.accepted_answer_id` already exists via migration 055).

---

## 1. Voyage `voyage-3-lite` migration  *(secret: `VOYAGE_API_KEY`)*

**Current** — `apps/web/lib/rag.ts:32-53`, `embedQuery`:
- Calls a local embedding micro-server at `EMBEDDING_SERVER_URL`
  (default `http://localhost:8001/embed`) with `{ texts: [text.slice(0, 2000)] }`.
- Returns a vector (currently 1536-dim from `text-embedding-3-small`) stored in
  Supabase `documents.embedding` (`vector(1536)`), queried via the
  `match_documents` RPC (`retrieveDocuments`, `rag.ts:59-76`).

The code already contains the Phase 7 TODO (lines 37–40):
```
// PHASE 7: Replace with Voyage AI call when EMBEDDING_SERVER_URL is removed.
// POST https://api.voyageai.com/v1/embeddings
// { input: [text], model: "voyage-3-lite" } → dims: 512
// Also migrate Supabase: ALTER TABLE documents ALTER COLUMN embedding TYPE vector(512);
```

**Target** — `voyage-3-lite`, **512 dims**:
1. Replace `embedQuery` with a direct Voyage call:
   ```ts
   const res = await fetch("https://api.voyageai.com/v1/embeddings", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       Authorization: `Bearer ${VOYAGE_API_KEY}`,
     },
     body: JSON.stringify({ input: [text.slice(0, 2000)], model: "voyage-3-lite" }),
   });
   // response: { data: [{ embedding: number[] }] }
   ```
   - Config: `const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? "";`
   - Guard: throw if no key.
   - **Confirmed** (docs.voyageai.com): `voyage-3-lite` → **512 dims**, 32k-token context,
     optimised for latency + cost; auth is `Authorization: Bearer $VOYAGE_API_KEY`;
     body is `{ input: [text], model: "voyage-3-lite" }` (fixed 512 — *no* `output_dimensionality`);
     response is `{ data: [{ embedding: number[] }], usage: {...} }`.
   - ⚠️ **Operator decision:** `voyage-3-lite` is a *legacy* model (still served, but Voyage
     recommends the 4-series). If you want a **current** model at 512 dims, use
     `voyage-4-lite` with `output_dimensionality: 512` — same dimension, better quality, and
     future-proof. The pgvector migration is identical either way (`vector(512)`).
2. Add an `EmbeddingProvider` seam (see §3) so the Voyage impl is selectable via
   `EMBEDDING_PROVIDER=voyage|local|openai` and the local
   `EMBEDDING_SERVER_URL` can be removed without churning call-sites.
3. **Vector dimension migration** (Supabase `documents.embedding`):
   - The existing 1536-dim vectors are **incompatible** with 512-dim Voyage output.
   - Approach (operator): `ALTER TABLE documents ALTER COLUMN embedding TYPE vector(512)`
     is unsafe while old vectors exist → **backfill**: add a `vector(512)` column
     (or re-use after dropping), re-embed every document through Voyage, then
     swap. Because re-embedding requires `VOYAGE_API_KEY`, this step is
     operator-run via a `scripts/reindex-voyage.ts` migration script.
   - `retrieveDocuments` is dimension-agnostic (it sends `query_embedding` of
     whatever dim `embedQuery` returns), so **no code change** is needed in
     `match_documents` once the column + embeddings are consistent.

**Status (this session):** `embedQuery()` swapped to Voyage and **verified live** — `VOYAGE_API_KEY` (valid, HTTP 200) returns 512-dim `voyage-3-lite` vectors; the real `embedQuery()` now returns `dim=512`; web **typecheck + build green** (✓ Compiled successfully) with the change. `VOYAGE_API_KEY` / `VOYAGE_EMBEDDING_MODEL` + Supabase keys added to `.env.example`. The **data backfill** below still needs Supabase credentials (absent in this sandbox, no `documents` table in local Postgres) → operator run.

**Env keys (operator must provision):**
- Web env (Railway/Vercel): `VOYAGE_API_KEY` (required). Optionally `VOYAGE_EMBEDDING_MODEL` (default `voyage-3-lite`).
- Supabase env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (already required by `retrieveDocuments`) **plus** a Supabase Postgres connection string for the reindex script — see below.

**Operator runbook:**
1. Provision `VOYAGE_API_KEY` in the **web** env (Railway/Vercel).
2. Add a 512-dim column (keeps the old 1536-dim `embedding` for a safe rollback):
   ```sql
   ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_512 vector(512);
   ```
3. Backfill via the in-repo script `npx tsx scripts/reindex-voyage.ts` — it needs `SUPABASE_DATABASE_URL` (the Supabase pooler Postgres connection string, not just the REST service-role key):
   ```
   SUPABASE_DATABASE_URL=postgres://postgres.<ref>:<token>@db.<ref>.supabase.co:5432/postgres \
   VOYAGE_API_KEY=<pa-...> npx tsx scripts/reindex-voyage.ts
   ```
   Idempotent (keyset cursor on `id`, skips rows already carrying `embedding_512`) and resumable. Set `RAG_TEXT_COLUMN` (default `content`) / `EMBEDDING_DIM` (default `512`) / `BATCH_SIZE` (default `50`) if your schema differs.
4. Atomic column swap once `embedding_512` is fully populated:
   ```sql
   ALTER TABLE documents DROP COLUMN embedding;
   ALTER TABLE documents RENAME COLUMN embedding_512 TO embedding;
   ```
5. Remove `EMBEDDING_SERVER_URL` / shut down the local embedding micro-server.
6. `npm run build -w apps/web` + smoke `POST /api/study-assistant` with a real query (asserts the 512-dim vector round-trips through `match_documents`).

---

## 2. Tenant isolation  *(architectural, no secret, large surface)*

**Current** — all data is multi-tenant in a shared schema with **no
`tenant_id` scoping** on the core tables (`users`, `posts`, `lessons`,
`comments`, `workbooks`, etc.). Rows are reachable by id alone; cross-tenant
isolation is an application-level invariant today.

**Goal** — enforce row-level tenant scoping so a tenant can never read/write
another tenant's rows, even via id enumeration.

**Approach:**
1. Schema: add `tenant_id UUID` (defaulting to a per-account primary tenant in
   the backfill) to core tables + FK `→ tenants(id)`. Add a
   `idx_*_tenant` index on each. (A `tenants` table already exists via
   migration 078.) Migration is additive with a single-tenant backfill so it is
   safe to apply to existing data.
2. Middleware: `apps/api/src/middleware/tenant.ts`-style resolver that reads the
   tenant from a header (`x-tenant-id`) or subdomain, validates membership
   against `request.user.sub`, and decorates `request.tenantId`. This is gated
   behind a `TENANT_ISOLATION_ENABLED=true` flag and rolled out per-route.
3. Query audit: every `pool.query` that touches a tenant-scoped table must add
   `AND tenant_id = $n`. This is the risky part — a missed predicate leaks rows.
   **Mitigation:** start from a small surface (community posts + comments) and
   add a `pre-validation` hook that rejects any query on a scoped table without
   a tenant. Full coverage is a phased rollout, not a flag day.
4. Tests: a tenant-scoped DB fixture (`test` DB with two tenants) + an
   integration suite asserting `GET /community/posts/:id` returns 404 across
   tenant boundaries.

**Risks:** large blast radius; must ship with tests before enabling in prod.
Do **not** toggle on until the integration suite is green.

---

## 3. AURA provider seam  *(refactor of `apps/web/lib/rag.ts` / `lib/assistant.ts`)*

**Current** — `rag.ts` hardcodes the local embedding server and `assistant.ts`
hardcodes the OpenAI chat path. `study-assistant/route.ts` calls these directly.

**Goal** — abstract AI behind a provider interface so AURA (and future providers)
are a configuration swap, not a refactor:
```ts
// lib/ai/providers.ts
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  dimensions: number;
}
export interface ChatProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
}
export type Provider = { embedding: EmbeddingProvider; chat: ChatProvider };
// registry keyed by AI_PROVIDER=aura|openai (default openai)
```
- `OpenAIEmbeddingProvider` — wraps `apps/api/lib/ai/openai.ts` (or the existing
  OpenAI client) — the fallback that preserves current behavior.
- `AuraProvider` — stub using `AURA_API_KEY` + `AURA_ENDPOINT`; not exercised
  in this sandbox (no key).
- `rag.ts`/`assistant.ts` consume `getProvider()` instead of hard-coded calls.

**Link to §1:** the Voyage migration is folded in here as a third
`EmbeddingProvider` so the embedding surface has one seam for both Voyage and
AURA.

---

## 4. i18n Phase 2 — extended domains

**Current** — Phase 1 (next-intl) is wired for `apps/web/messages/{en,zu,xh,af,st,tn,nso,ts,ss,ve,nr}.json` over the core namespaces. Phase 1 spec lives at
`docs/superpowers/specs/2026-05-30-next-intl-i18n-design.md` §6.

**Phase 2** = extend the same next-intl pattern to seven additional domains:
`bookstore`, `marketplace`, `past-papers`, `community`, `classes`, `planner`,
`learn`.

**Plan (operator):**
1. For each domain, add a namespace block to each of the 11 locale JSON files
   (e.g. `{ "bookstore": { "title": "..." } }`). English values are source of
   truth; the others are machine-translated.
2. `npm run translate -- --domain bookstore,marketplace,past-papers,community,classes,planner,learn --target zu,xh,af,st,tn,nso,ts,ss,ve,nr` (runs `scripts/translate.ts`, which requires the translation API key — **not available in this sandbox**).
3. In each domain's route-bundle / pages, replace hard-coded strings with
   `useTranslations("domain")` lookups (same convention as Phase 1).
4. `useTranslations` namespaces are validated at build via the existing tsup/next
   `missingKey` check (Phase 1 infra). Re-run `npm run build -w apps/web` to
   surface any uncovered keys.

**No new migration / schema.** Blocked only on translation credentials.

---

## 5. RAG cleanup (folded into §1 + §3)

- Remove `EMBEDDING_SERVER_URL` plumbing in `rag.ts` once Voyage is live.
- Delete the local embedding micro-server (`docker-compose` service /
  `apps/api/embedding-server`).
- Keep `match_documents` RPC unchanged (dimension-agnostic).

---

## Delivered vs. spec-gated (this session)

| Upgrade | Status | Notes |
|---|---|---|
| Accepted-answer 20-credit award + proof-of-progress | ✅ **Shipped** | `db/community.ts` `acceptAnswer` + `POST /community/posts/:id/accept`. No migration (col exists in 055). Idempotent via `creditWallet`. |
| SCHOOL Press v1 | ✅ **Verified complete** | `083` + `db/press.ts` + `routes/press.ts` + `server.ts:30,208`. Already green. |
| Dashboard wiring / analytics | ✅ **Shipped** | `GET /analytics/dashboard-summary` + writes. (See changeset.) |
| Voyage `voyage-3-lite` | 📝 **Spec** | Needs `VOYAGE_API_KEY` (not in sandbox). See §1. |
| Tenant isolation | 📝 **Spec** | Large surface, needs integration tests. See §2. |
| AURA provider seam | 📝 **Spec** | Refactor of `rag.ts`/`assistant.ts`. See §3. |
| i18n Phase 2 | 📝 **Spec** | Needs translation API key. See §4. |
