# SCHOOL — CODING AGENT MASTER HAND-DOWN (launch prep)

> Paste-ready brief. Everything below was verified against the repo at
> `/home/lottie/projects/SCHOOL-Academic-Platform` on 2026-08-23. Paths are real.
> Do NOT fabricate lessons, prices, legal numbers, or sources. When a blocker needs a
> decision only the owner can make (CIPC number, DB credentials, launch go/no-go), STOP and
> report — do not guess.

---

## 0. WHAT THIS IS
A single source of truth for the coding agent tasked with getting **SCHOOL** (package
`za.co.ditshego.school`, web `school.ditshego-ventures.co.za`) launch-ready by **Monday**.
It consolidates: (a) the pre-launch audit + 50-point plan, (b) the school-lesson generation &
academic-enrichment spec, and (c) a precise map of where every relevant file lives so you
don't re-discover the codebase.

Read order for the agent:
1. This file (orientation + map).
2. `docs/SCHOOL_PRELAUNCH_50_PLAN.md` (the 50 items, ranked by risk).
3. `SCHOOL Lesson Generation & Enrichment - Coding Agent Handoff.md` (generation + enrichment detail).
4. The specific files cited per task.

---

## 1. REPO MAP — WHERE EVERYTHING LIVES

**Repo root:** `/home/lottie/projects/SCHOOL-Academic-Platform`  (git remote: `LottieKnight/SCHOOL-Academic-Platform`, branch `main`)

### Apps & packages
- `apps/web/` — Next.js web app (deploy target **`saedu-api`** on Vercel). Legal routes live at
  `apps/web/app/legal/{privacy,cookies,terms,aup,research-consent}/page.tsx`.
- `apps/api/` — Fastify API (deploy target **`saedu-api-server`** on Vercel). Env:
  `NEXT_PUBLIC_API_URL=https://saedu-api-server.vercel.app`.
- `apps/android/` — TWA / Android project (bubblewrap). **Signing key committed here — see §2.**
- `apps/mobile/` — React-Native/expo mobile app (`apps/mobile/android/app/debug.keystore` tracked).
- `packages/shared/` — shared schema + generation scripts. **The canonical schema lives here:**
  `packages/shared/src/lesson-content.ts` (`LessonSchema`, zod).
- `apps/web/packages/shared/` — duplicate of the above (web copy); keep both in sync if editing.

### Content & data
- `apps/web/content/modules-generated/*.generated.json` — **22 NWU university modules**, already
  enriched with `referenceList` (academic, no Wikipedia), `teacherNotes`, `sourceHashes`,
  `wikipediaExcluded:true`. NOTE: `content/` is gitignored — confirm the build actually bundles
  these (Vercel build step) or they won't reach production.
- `content/lessons/` — **SCHOOL school-lesson corpus. Currently EMPTY (0 `lesson.json`).** The
  Grade-3 Sepedi folders are empty shells. Nothing to enrich until generated.
- `school/curriculum/grade12/english.json` — the only school-curriculum artifact on disk (a
  hand-authored Grade 12 English outline). Not in the `lesson.json` schema format.
- `data/modules/*.json` + `*_deep.json` — raw NWU module source data.
- `prisma/dev.db`, `apps/web/prisma/past-papers.db` — local DBs (past papers).

### Models & generation
- `models/school-caps/` — fine-tuned Mistral (32 768 ctx) for CAPS lesson generation.
- Generation scripts (read before generating): `packages/shared/scripts/{generate-week-lesson,
  generate-term-lessons, gen-lesson, rag_v1_generate_lesson, seedCurriculumFromScaffold}.ts`.
- CAPS scaffold: `apps/web/content/caps_scaffold.json` (phases/grades present, subjects empty).
- Source manifest: `content/academic-source-manifest.seed.json` (DBE CAPS + NWU yearbook; `pending`).

### Enrichment scripts (already in repo, use these — don't reinvent)
- `scripts/enrich_references_teachernotes.py` — enriches the 22 NWU modules (DONE, pushed).
- `scripts/enrich_school_lessons.py` — enriches school lessons with **academic-only** references
  (NO Wikipedia), teacher notes, source hashes. Auto-attaches to any `content/lessons/**/lesson.json`.
  Run: `python3 scripts/enrich_school_lessons.py` (`--dry` to preview).

### Legal & compliance docs (`docs/legal/`)
- `TERMS_OF_SERVICE.md` — **has a CIPC contradiction (see §2, blocker #2).**
- `PRIVACY_POLICY.md`, `COOKIE_POLICY.md`, `ACCEPTABLE_USE_POLICY.md`, `COPYRIGHT_POLICY.md`,
  `REFUND_POLICY.md`, `TUTOR_AGREEMENT.md`, `CIPC_REGISTRATION_GUIDE.md`, `LEGAL_OVERVIEW.md`,
  `DITSHEGO_GROUP_STRUCTURE.md`, `MEMORANDUM_OF_INCORPORATION.md`, `INVOICE_TEMPLATE.md`.
- `docs/research/` — `consent-observational-silence-v1.md`, `stimulus-observational-silence-v1.md`,
  `attention-study-telemetry.md`, `stimulus-prototype.html` — **minor research study, DRAFT, NOT
  REC-approved (see §2, blocker #7).**

### Audit & plans
- `docs/SCHOOL_PRELAUNCH_50_PLAN.md` — the 50-point ranked plan (authoritative for launch scope).
- `SCHOOL Lesson Generation & Enrichment - Coding Agent Handoff.md` — generation + enrichment spec.
- Other ops docs: `docs/DEPLOY_RUNBOOK.md`, `docs/MVP_OPERATIONS.md`, `docs/ci-cd.md`,
  `docs/backup-restore.md`, `docs/observability.md`, `docs/accessibility-audit.md`,
  `docs/platform-map.md`, `docs/security/BREACH_NOTIFICATION_RUNBOOK.md`, `docs/security-scanning.md`.

### Android / Play
- `apps/android/twa-manifest.json` — **points to DEAD host `saeduweb-production.up.railway.app`
  and package `app.railway.up.saeduweb_production.twa` (see §2, blocker #4).**
- `apps/web/public/.well-known/assetlinks.json` — matches the Railway package fingerprint
  `15:D6:B6:…:CE:70:8C` (not the new `za.co.ditshego.school` package).
- Store assets: `apps/android/store_icon.png` (512), feature graphic, `apps/android/app-release-signed.apk.idsig`.
- **Signing keys COMMITTED to git (verified via `git ls-files`):**
  `apps/android/android.keystore`, `apps/android-signing/android.keystore`,
  `apps/android/app-release-signed.apk.idsig`, `apps/mobile/android/app/debug.keystore`.

---

## 2. THE FIVE LAUNCH BLOCKERS (clear these or slip launch)

**B1 — "Generated content" is not on disk.** `content/lessons/**/lesson.json` = 0. The Grade-3
lesson folders are empty. If lessons exist in a DB or another machine, fetch them into the
`content/lessons/<phase>/grade-<gg>/<subject>/term-<tt>/week-<ww>/lesson.json` layout, then run
`scripts/enrich_school_lessons.py`. If they don't exist, scope Monday's launch to the NWU module
corpus + the Grade 12 outline, and say so — do not claim a school corpus.

**B2 — CIPC contradiction in ToS.** `docs/legal/TERMS_OF_SERVICE.md` line 15 says reg
`2026/349873/07`; line 19 says "Registration number: pending — CIPC registration in progress."
Owner must confirm the true status. If registered → fix line 19. If not → fix line 15 to "pending"
and remove the asserted number. Misrepresentation risk under CPA + ECTA §43.

**B3 — Android signing key leaked in git (CRITICAL).** `apps/android/android.keystore`,
`apps/android-signing/android.keystore`, `*.idsig` are tracked. Anyone with repo access can
sign/impersonate the app. Actions: (1) generate a NEW upload key, (2) add `*.keystore *.jks *.idsig`
to `.gitignore`, (3) purge from git history (git filter-repo / BFG) and force-push, (4) rotate any
credential the key protected. Also drop `apps/mobile/android/app/debug.keystore` from VCS.

**B4 — TWA / assetlinks host mismatch.** `twa-manifest.json` + `assetlinks.json` target the dead
Railway host/package. Regenerate for `za.co.ditshego.school` + `school.ditshego-ventures.co.za`
via bubblewrap; re-issue `assetlinks.json`; after Play App Signing, add Play's production signing
fingerprint (use `bubblewrap fingerprints`). Verify the live fingerprint matches.

**B5 — Minor research study not cleared.** `docs/research/consent-observational-silence-v1.md`
describes an inattentional-blindness game collecting telemetry from under-18s in "Game Center."
Status: DRAFT, pending NWU REC + POPIA sign-off. **Do NOT ship this study Monday.** Gate it behind
a feature flag defaulting OFF; remove from the launch build unless REC clearance is confirmed.

---

## 3. HARD CONSTRAINTS (non-negotiable)
- **NO Wikipedia. Academically-recognised sources ONLY** for any lesson/reference. The school
  enricher already enforces `wikipediaExcluded:true`; extend with a CI lint that fails if any
  `referenceList[].url` contains `wikipedia`.
- **Minors + POPIA.** Every under-18 data flow needs verifiable parental/guardian consent
  (POPIA §34–35, Children's Act 38 of 2005). Confirm `users.parental_consent_given_at` /
  `parent_email` actually gates <18 signup and the `412 guardian_consent_required` API response.
- **No fabricated content.** Lessons/outcomes must trace to DBE CAPS or generated module outlines.
- **Don't clobber the 22 enriched module JSONs or the two enrichment scripts.** The school script
  already skips module files.
- **Leave unrelated dirty files alone** (e.g. `apps/web/app/learn/professional/page.tsx`,
  `docs/*`, `package.json`). Commit only the files your task touches.

---

## 4. TASKS FOR THE AGENT (prioritised)

### P0 — do first (security + truth)
1. **B3 keystore purge/rotate** (see §2 B3). Highest urgency — live secret leak.
2. **B4 TWA/assetlinks regeneration** for `za.co.ditshego.school`.
3. **B1 content reconciliation** — locate/confirm generated lessons; if absent, scope launch.
4. **B5 disable minor research study** in the Monday build (feature flag OFF).

### P1 — legal & quality (same-day if possible)
5. Fix **B2** CIPC contradiction (owner confirms number).
6. Wire real legal-policy hrefs (replace `[link]` in ToS/AUP/Cookie/Copyright) + footer links.
7. Enforce guardian-consent gate server-side; verify with `apps/api/test/research-consent.test.ts`.
8. Run `scripts/enrich_school_lessons.py` once lessons exist; assert 0 Wiki links repo-wide.
9. Add CI lint: fail build if any `referenceList[].url` matches `wikipedia`.
10. Triage the **2 critical + 36 high** GitHub Dependabot vulns; patch criticals.
11. Scan git history for committed secrets (`.env`, keys) and rotate any found.
12. Confirm `content/` build bundling (Vercel) so enriched modules reach prod; verify on staging.

### P2 — platform readiness
13. Individual Play Console account (no DUNS gate) for first release; choose Play App Signing.
14. Capture ≥2 phone screenshots from `school.ditshego-ventures.co.za` for store listing.
15. Release to **closed testing** first, public after smoke test.
16. Confirm web+api deploy coherence; fix or drop dead `api.school.ditshego-ventures.co.za` DNS.
17. Verify observability/error monitoring + uptime alerting are live before launch.

### P3 — content quality (this week)
18. Sepedi/Home-Language lessons reviewed by a first-language speaker before shipping.
19. Teacher sign-off on Foundation Phase `teacherNotes`.
20. Spot-check worked-example correctness (Grade 12 Maths/English).
21. Add `capsReference` field citing the specific DBE CAPS section per lesson.
22. Surface `sourceHashes` in UI as "verified sources."
23. Close accessibility-audit.md (WCAG 2.1 AA) findings.

---

## 5. DEFINITION OF DONE (Monday)
- B1–B5 resolved or launch explicitly scoped around them with owner sign-off.
- Keystore purged from git + rotated; TWA/assetlinks match `za.co.ditshego.school`.
- Every shipped lesson has academic-only `referenceList`, `teacherNotes`, `sourceHashes`,
  `wikipediaExcluded:true`; 0 Wiki links repo-wide (CI-enforced).
- Legal policies linked in-app; guardian-consent gate enforced; minor research study OFF unless
  REC-cleared.
- Web + API live and coherent; closed-test track published; monitoring alerting.

---

## 6. WHERE TO GET ANSWERS (don't guess — consult these)
- **Launch scope / blockers:** `docs/SCHOOL_PRELAUNCH_50_PLAN.md`
- **Generation + enrichment spec:** `SCHOOL Lesson Generation & Enrichment - Coding Agent Handoff.md`
- **Lesson schema:** `packages/shared/src/lesson-content.ts`
- **Academic source library (no Wiki):** inside `scripts/enrich_school_lessons.py`
  (`SCHOOL_SOURCES` dict: DBE CAPS, DBE LTSM/workbooks, Thutong, Siyavula, SARB, Stats SA, SAHO,
  OpenStax, IFRS, CFA, Purdue OWL).
- **Legal truth:** `docs/legal/*` (esp. `TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`,
  `CIPC_REGISTRATION_GUIDE.md`).
- **Research/minor-consent:** `docs/research/consent-observational-silence-v1.md`.
- **Deploy topology:** `docs/DEPLOY_RUNBOOK.md`, `docs/MVP_OPERATIONS.md`, `docs/ci-cd.md`,
  `docs/platform-map.md`.
- **Owner decisions only (STOP and ask):** CIPC registration number, live `DATABASE_URL` for the
  generated lessons, Play account org/DUNS status, and the final go/no-go for Monday.

---

## 7. QUICK-START
1. `cd /home/lottie/projects/SCHOOL-Academic-Platform`
2. Read `docs/SCHOOL_PRELAUNCH_50_PLAN.md` then the generation handoff.
3. Start with P0 tasks (B3 keystore, B4 TWA, B1 content, B5 study flag).
4. For each task: edit only the relevant files, validate (lint/test/build), commit scoped,
   report status against the 50-plan item numbers.
5. Blockers needing owner input → stop and surface with the exact question.
