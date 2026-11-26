# Revenue Gate — Operator Action Sheet (2026-09-22)

What the agent completed vs what only the operator (account/billing/legal holder for
DITSHEGO VENTURES (PTY) LTD t/a SCHOOL, CIPC 2026/349873/07) can do. Execute these to
switch payment acceptance on. Anything "DONE" below has been verified against `main`.

> Deadlines: **Google Play signing-key registration = 2026-09-30** (one-time). Supabase
> and Railway billing gates are the only things between you and live revenue.

---

## ✅ DONE today (agent, on `main`, uncommitted)

| Item | Detail |
|---|---|
| CAPS scaffold built | `packages/shared/content/caps_scaffold.json` — 4 phases, 1,576 subject-terms, 15,760 weeks (full R-12 curriculum grounding for lessons) |
| Content CI gate | `scripts/check_no_wikipedia.py` → **PASS**, 0 Wikipedia refs across 24 content files |
| TWA rebrand (B4) | `apps/android/**` moved from `app.railway.up.saeduweb_production.twa` → `za.co.ditshego.school`; host, namespace, webManifestUrl, fullScopeUrl all → `school.ditshego-ventures.co.za`; assetStatements site corrected; Java tree moved to `za/co/ditshego/school/`. Zero `railway`/`saeduweb` strings remain in code |
| .gitignore resolved (T0-4) | Merge-conflict markers removed (was blocking release hygiene) |
| Keystore purge verified (B3) | No `.jks/.keystore/.p12` blobs in `git rev-list --all`; ignore rules present. **Your old leak is gone from history** |
| Mobile release signing | Removed `signingConfig signingConfigs.debug` from `apps/mobile` release — releases can no longer ship debug-signed |

---

## 🔵 BLOCKED on you — do in this order

### 1. Supabase — resume `saedu_vercel_auth` (30 min)
Paused since 2026-09-01. Every payment flow (wallet ledger, invoices, auth) writes here.
1. https://supabase.com/dashboard → project `saedu_vercel_auth` → **Resume**.
2. Confirm Pooler reachable from Vercel env (`POSTGRES_URL`) and Railway env (`DATABASE_URL`).
3. Do **not** create a new project or migrate users.
Verify: `GET https://<ref>.supabase.co/auth/v1/health` → 200.

### 2. Railway — plan + redeploy (30 min)
Trial expired; `school-api` has no successful deploy since Aug 5-6 (root cause already fixed in `main`).
1. https://railway.app → account `lottieknight`, project **sunny-luck** → pick plan.
2. Restart Redis service `ca18b060` from dashboard (218/500 MB volume intact).
3. `railway service redeploy --service school-api --from-source --yes`
4. Verify: `/health` returns 200; no restart loop.

### 3. GitHub — ECS deploy vars + PAT scope (15 min)
1. Actions → Variables: `AWS_REGION=af-south-1`, `ECS_CLUSTER`, `ECR_REPOSITORY_API`, `ECR_REPOSITORY_WEB`.
2. Grant PAT `contents: write` + `actions: read/write` (for staged ingest/deploy workflows).

### 4. Google Play — register/rotate signing key (before **2026-09-30**)
1. Generate fresh upload keystore (do this on the Play Console machine):
   ```
   keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias android
   keytool -export -rfc -keystore upload-keystore.jks -alias android -file upload_cert.pem
   ```
2. Play Console → App signing → "Request upload key reset" → upload `upload_cert.pem`.
3. Keep `upload-keystore.jks` local-only (`*.jks`/`*.keystore` are gitignored).
4. Update `apps/web/public/.well-known/assetlinks.json` fingerprint to the **App Signing** key SHA-256 if it differs (currently `2F:D0:EA:...` on `za.co.ditshego.school`), redeploy web, then verify via the Digital Asset Links API.

### 5. PayFast — go live (30 min)
1. Request POPIA/data-processing term sign-off (OPERATOR_AGREEMENTS_CHECKLIST #4) — required before live ZAR.
2. Set on Railway API env:
   `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_IPS`, `PAYFAST_SANDBOX=false`.
3. Sandbox test first (`PAYFAST_SANDBOX=true`), then flip live.

### 6. Stripe — activate when the bookstore goes live
Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BOOKSTORE_PAYMENT_PROVIDER=stripe` on the API env, and update env on Vercel for the web. Webhooks already fail closed in production when secrets are unset.

### 7. DPAs (POPIA s21/s72) — IO owner (MK Ditshego)
- OpenAI DPA: sign (also needed for lesson generation API key).
- PayFast terms: **pending** → gates #5.
- Supabase, Vercel, Zoho, Resend: verify DNA/SCCs on file in `docs/legal/operator-agreements/`.
- Railway vs retired contradiction: resolve (OPERATOR #11) — pick one story for Privacy Policy §8.

### 8. Canonical origin — one decision (blocks SEO/email alignment)
Pick ONE of: `school.ditshego-ventures.co.za` (repo default) / `saedu-api.vercel.app` / `school.ac.za`. Agent then aligns env + sitemap/robots/email domain.

---

## 📦 Content generation (agent runs once you set a key)

Lesson text generation needs an OpenAI-compatible key (there is no LLM key on this box and
no reachable Postgres for the DB-backed path). When you have `OPENAI_API_KEY`:

```sh
# install deps + run RAG v1 file-based generator (no DB needed):
cd packages/shared
OPENAI_API_KEY=sk-... npm run rag:v1:generate -- --grade 3 --subject maths --term 1 --week 1
# then enrich all generated lessons:
curl -sSL https://raw.githubusercontent.com/... # or from repo root:
python3 scripts/enrich_school_lessons.py
python3 scripts/check_no_wikipedia.py   # must stay PASS
```

Useful targets given the revenue plan: start with the Grade 12 English outline already at
`school/curriculum/grade12/english.json`, then fee-paying grades (10-12 FET).

Scope notes: the 22 NWU modules (`apps/web/content/modules-generated/`) are already
enriched and reference-clean — saleable now; the R-12 `content/lessons` tree is what's
empty (0 lesson.json on disk).

---

## Test after unblock
1. Wallet topup via PayFast sandbox (web `/wallet` + mobile wallet) — expect idempotent credit.
2. Past-paper detailed-report debit — expect wallet deduction + `wallet_ledger` row.
3. `pnpm` tests: `wallet-routes`, `wallet-ledger-idempotency`, `payfast-bookstore-checkout`.