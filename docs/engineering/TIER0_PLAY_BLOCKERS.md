# TIER 0 — GOOGLE PLAY LAUNCH BLOCKERS (fix tickets)
**Date:** 2026-08-25 · **Verdict:** 🔴 NO-GO until all 5 closed.
**Evidence base:** security audit (deleg_16667cfb, task 1) with file:line.

---

## BLOCKER T0-1 — Android upload keystore leaked in git history (P0, credential compromise)
**Evidence:** blobs `apps/android/android.keystore` (f78cf859), `apps/android-signing/android.keystore` (784a8489), `apps/mobile/android/app/debug.keystore` (364e105) reachable from `refs/remotes/origin/*` via `git rev-list --all --objects`. `KEYSTORE_NOTE.md`: "leaked in git history and purged 2026-08-23 (B3 fix); rotate before any release."

**Fix:**
1. **Treat as compromised.** Request an upload-key reset from Google Play:
   - Generate a new keystore: `keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
   - Export cert: `keytool -export -rfc -keystore upload-keystore.jks -alias upload -file upload_cert.pem`
   - Upload `upload_cert.pem` via Play Console → App signing → "Request upload key reset".
2. **Purge from git history** (after rotation, before any further release):
   ```bash
   cd /home/lottie/projects/SCHOOL-Academic-Platform
   # Ensure git-filter-repo installed; DRY RUN first
   git filter-repo --invert-paths --path apps/android/android.keystore --path apps/android-signing/android.keystore --path apps/mobile/android/app/debug.keystore --dry-run
   # Then for real (force-pushes history — coordinate with all branches/clones first)
   git filter-repo --invert-paths --path apps/android/android.keystore --path apps/android-signing/android.keystore --path apps/mobile/android/app/debug.keystore
   ```
   ⚠️ `git filter-repo` rewrites history — all collaborators must re-clone. Confirm with the team before running.
3. **Keep keystores out of git** permanently: ensure `*.keystore`, `*.jks`, `*.p12` are in `.gitignore` (verify — see T0-4 re merge markers).

**Acceptance:** Upload key reset confirmed in Play Console; `git rev-list --all --objects | grep -i keystore` returns nothing; new release signed with rotated key.

---

## BLOCKER T0-2 — TWA build.gradle points at STAGING host (P0)
**Evidence:** `apps/android/app/build.gradle:17` `hostName: 'saeduweb-production.up.railway.app'`; `:33` `applicationId "app.railway.up.saeduweb_production.twa"`. Conflicts with `apps/android/twa-manifest.json` (host `school.ditshego-ventures.co.za`, packageId `za.co.ditshego.school`).

**Fix:** Edit `apps/android/app/build.gradle`:
- `hostName` → `school.ditshego-ventures.co.za`
- `applicationId` → `za.co.ditshego.school` (match twa-manifest.json)
- `nameProvider` / `launchUrl` should target `https://school.ditshego-ventures.co.za`
- Re-run the TWA generator (`bubblewrap build`) to regenerate `twa-manifest.json` + `build.gradle` from the correct URL, then re-verify host matches.

**Acceptance:** `./gradlew assembleRelease` produces an APK whose TWA wraps `school.ditshego-ventures.co.za` (no URL bar, trusted).

---

## BLOCKER T0-3 — assetlinks.json placeholder not replaced (P0)
**Evidence:** `apps/web/public/.well-known/assetlinks.json:11` contains `"REPLACE_WITH_PLAY_APP_SIGNING_FINGERPRINT"`.

**Fix:**
1. Get the **Play App Signing** SHA-256 (Play Console → Setup → App integrity → App signing key certificate) OR the upload-key cert fingerprint (`openssl x509 -in upload_cert.pem -noout -fingerprint -sha256`).
2. Replace the placeholder with the real SHA-256 (after T0-1 rotation, use the rotated key's fingerprint).
3. Redeploy web app so `/.well-known/assetlinks.json` is live and publicly fetchable.
4. Verify: `https://school.ditshego-ventures.co.za/.well-known/assetlinks.json` returns valid JSON with `sha256_cert_fingerprints` matching the signing key.

**Acceptance:** TWA trusted (no URL bar); `assetlinks.json` validated by Digital Asset Links API.

---

## BLOCKER T0-4 — .gitignore committed with merge-conflict markers (P0 hygiene)
**Evidence:** `apps/.../.gitignore` (or repo root) lines 65/73/77 contain `<<<<<<< HEAD`, `=======`, `>>>>>>> origin/claude/...` — a committed botched merge.

**Fix:**
1. Open the file, resolve the conflict (keep the correct union of ignore rules), remove the marker lines.
2. Ensure ignore rules cover keystores: add `*.keystore`, `*.jks`, `*.p12`, `.env*,` if missing.
3. `git add .gitignore && git commit -m "fix: resolve committed .gitignore merge-conflict markers"`

**Acceptance:** `git status` clean; `grep -nE '<<<<<<<|>>>>>>>|=======' .gitignore` returns nothing.

---

## BLOCKER T0-5 — POPIA §35 age-gate bypassable (P1, minors' compliance)
**Evidence:** `apps/api/src/routes/auth/registration.ts:30` `dateOfBirth: z....optional()`; `:71` entire gate wrapped in `if (parsed.data.dateOfBirth)`. Minor omitting DOB skips under-13 block (`:84-85`) + parental-consent (`:88-93`).

**Fix (pick one, recommend A):**
- **A (enforce):** Make `dateOfBirth` required for learner self-signup role. Change schema to `.min(1)` / non-optional for `role: 'learner'`; reject registration without DOB with a clear message. Keep tutor/parent flows as-is.
- **B (defence-in-depth):** Even when DOB absent, require parental-consent flow for any account that *could* be a minor (default-to-consent-until-proven-adult).
- Add a test: registering a learner with no DOB is rejected (A) or forced into consent (B).

**Acceptance:** A learner self-signup without DOB is impossible; under-13 + missing-consent path is unreachable.

---

## SEQUENCING
1. T0-1 (rotate key) — do FIRST; unblocks T0-3 fingerprint.
2. T0-4 (.gitignore) — quick, do alongside.
3. T0-2 (build.gradle) + T0-3 (assetlinks) — after key rotation.
4. T0-5 (age-gate) — independent; do before any minors-facing release.
5. Re-run `./gradlew assembleRelease` + internal-track upload for a smoke test.

After all 5: Google Play 🟢 GO (pending standard store-listing assets: screenshots, privacy policy URL, content-rating questionnaire).
