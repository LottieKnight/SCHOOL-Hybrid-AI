# HAND-OFF PROMPT — opencode (SCHOOL Google Play Launch Blockers + Listing)

You are taking over execution of the Google Play Store launch-readiness work for the
**SCHOOL Academic Platform** (operator: DITSHEGO VENTURES (PTY) LTD t/a SCHOOL, CIPC
2026/349873/07, South Africa). The Play Console account is already verified. Your job is
to close the launch blockers (T0-1…T0-5) and prepare the store listing. **Do not publish
— leave everything in draft and report back.** Stop and report at two explicit gates
(Phase 1b and before any force-push).

---

## CANONICAL REPO
`/home/lottie/projects/SCHOOL-Academic-Platform`  (a parallel mirror exists at
`/home/lottie/SCHOOL-Academic-Platform` — keep both in sync; they must stay identical
for all source/docs changes). All relative paths below are from the canonical repo root.

## GROUND TRUTH (verified this session, do NOT re-litigate)
- The "committed live secrets" panic is **FALSE**: `.env`/`.env.local`/`.env.production`
  are gitignored and untracked. Do NOT waste time on secret-purging of .env.
- The REAL P0 is the **Android upload keystore in pushed git history** — see T0-1.
- `next.config.mjs` already sets static security headers (Referer/X-Content-Type/
  X-Frame-Options/Permissions-Policy/HSTS) but has NO Content-Security-Policy and
  references a missing `proxy.ts`. A per-request CSP middleware (`apps/web/middleware.ts`)
  was ALREADY ADDED this session — do not duplicate it.
- KaTeX math rendering was ALREADY ADDED this session (`apps/web/components/Markdown.tsx`
  + deps + `AiLessonView.tsx` swap). `npx tsc --noEmit` is clean. Do not redo.
- Lessons are 100% text today (no math render, no diagrams/images). That is POST-launch
  enhancement (see LAUNCH_PLAN_50.md Tier 2). Not in your scope now.

## REFERENCES (read these first — they are the detailed scripts)
- `docs/engineering/TIER0_EXECUTION_SCRIPT.md` — the 8-phase copy-paste script with exact
  commands, old→new strings, safety gates, and rollback. THIS IS YOUR PRIMARY INSTRUCTION.
- `docs/engineering/PLAY_LISTING_ASSETS.md` — privacy URL, content-rating answers, Data
  Safety form, listing copy, graphic-asset checklist, pre-launch gate.
- `docs/engineering/TIER0_PLAY_BLOCKERS.md` — the ticket-level rationale (file:line).
- `docs/engineering/LAUNCH_PLAN_50.md` — full 50-item plan (context only).

## YOUR TASKS (in order)

### T0-1 — Rotate the Android upload keystore (P0, credential compromise)
- Generate a NEW upload keystore locally with `keytool` (NEVER commit it; add `*.keystore`
  `*.jks` `*.p12` `*.pem` `keys/` to `.gitignore`).
- **GATE 1b (HUMAN ACTION — STOP AND REPORT HERE):** The Play Console upload-key reset
  (Setup → App integrity → Request upload key reset, upload `upload_cert.pem`) is a
  Console action the human must do. Report the exact steps taken and wait.
- After Google confirms the reset: purge the 3 leaked keystore blobs from git history
  with `git filter-repo --invert-paths` (DRY RUN first; see script). Verify
  `git rev-list --all --objects | grep -i keystore` returns nothing.
- ⚠️ `git filter-repo` rewrites history. Coordinate with the team; all clones must re-clone.

### T0-4 — Resolve committed `.gitignore` merge-conflict markers (P0 hygiene)
- Repo-root `.gitignore` lines 65/73/77 and `apps/web/.gitignore` lines 1/6/8 contain
  `<<<<<<<`/`=======`/`>>>>>>>` markers. Edit to remove markers, keep the union of rules.
  Grep-clean after.

### T0-2 — Fix TWA `build.gradle` to PRODUCTION (P0)
- `apps/android/app/build.gradle` currently: `applicationId: 'app.railway.up.saeduweb_production.twa'`
  and `hostName: 'saeduweb-production.up.railway.app'` (STAGING). Change to
  `applicationId: 'za.co.ditshego.school'` and `hostName: 'school.ditshego-ventures.co.za'`
  (matches `apps/android/twa-manifest.json`). If `bubblewrap` is available, regenerate the
  TWA manifest from the prod URL; otherwise the manual edit is sufficient. Grep-verify no
  `railway` host remains.

### T0-3 — Replace `assetlinks.json` placeholder (P0)
- `apps/web/public/.well-known/assetlinks.json` line 11 has
  `"REPLACE_WITH_PLAY_APP_SIGNING_FINGERPRINT"`. Replace with the **Play App Signing**
  certificate SHA-256 (from Console → Setup → App integrity → App signing key certificate;
  if using the upload key for an internal track, use that fingerprint). Keep the existing
  real fingerprint too. Validate with `jq empty`. Redeploy web app and `curl` the live URL
  to confirm valid JSON with the real SHA-256.

### T0-5 — Enforce POPIA §35 age-gate (P1, minors' compliance)
- `apps/api/src/routes/auth/registration.ts` line 30: `dateOfBirth` is `.optional()` and
  the entire gate is inside `if (parsed.data.dateOfBirth)` — a minor can skip it by
  omitting DOB. Make `dateOfBirth` **non-optional** (remove `.optional()`). Optionally
  de-wrap the `if` block since DOB is now guaranteed. Add a test: learner signup without
  DOB → 400. Run `npx tsc --noEmit` in apps/api to confirm clean.

### BUILD & SMOKE TEST
- `cd apps/android && ./gradlew assembleRelease` — TWA must wrap prod domain, no URL bar.
- `cd apps/api && npx tsc --noEmit` — clean.

### STORE LISTING (draft only — do NOT publish)
Per `PLAY_LISTING_ASSETS.md`:
- Set Privacy Policy URL: `https://school.ditshego-ventures.co.za/legal/privacy` (verify 200).
- Fill Content Rating questionnaire (answer truthfully — app serves minors → Families
  Policy applies; UGC/messaging/in-app-purchases all declared; our moderation + age-gate
  cover it).
- Fill Data Safety form from the table (email/phone/DOB/messages/financial/app-activity).
  HONESTY RULE: do NOT claim message E2E encryption (not yet implemented) — state
  transport + DB encryption.
- Generate graphic assets: 512×512 icon, 1024×500 feature graphic, ≥2 phone screenshots
  (1080×1920). NOTE: `apps/web/public/manifest.json` is SVG-only — add raster PNGs.
- Enter listing copy from §4 (title/short/full description, category Education, tags).
- Provide Google a test-account login (App access).
- Leave listing in DRAFT.

## HARD CONSTRAINTS
- Do NOT push to `origin` without explicit confirmation. T0-1 rewrites history; any push
  must be a coordinated force-push after the team re-clones, OR push on a fresh branch/PR.
- Do NOT claim secrets-purging of `.env` (false premise).
- Do NOT modify the already-added `middleware.ts` or `Markdown.tsx` unless you find a bug.
- Report at GATE 1b (Play Console reset is human) and before any force-push.
- Keep both repos in sync for every source/doc change.

## DEFINITION OF DONE (report when all true)
- [ ] `git rev-list --all --objects | grep -i keystore` → empty (T0-1)
- [ ] `.gitignore` (both) grep-clean of conflict markers (T0-4)
- [ ] `build.gradle` host = prod, appId = `za.co.ditshego.school` (T0-2)
- [ ] `assetlinks.json` live URL returns valid JSON w/ real Play SHA-256 (T0-3)
- [ ] learner signup w/o DOB → 400; under-13 → 403; 13–17 needs consent (T0-5)
- [ ] `assembleRelease` succeeds; TWA trusted (no URL bar)
- [ ] `tsc --noEmit` clean (api)
- [ ] Store listing drafted (privacy URL, rating, data-safety, graphics, copy) — NOT published
- [ ] Both repos committed locally; push deferred pending T0-1 coordination

Report a concise summary of what you executed, what's blocked on the human (Play Console
reset), and the exact next command for the push once coordination is given.
