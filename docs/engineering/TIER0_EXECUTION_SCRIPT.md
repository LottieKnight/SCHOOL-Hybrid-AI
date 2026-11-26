# EXECUTION SCRIPT — SCHOOL Google Play Launch Blockers (T0-1 → T0-5)
**For:** coding agent (opencode / etc.) · **Date:** 2026-08-25
**Source of truth:** `/home/lottie/projects/SCHOOL-Academic-Platform` (canonical repo)
**Goal:** Make the Android TWA shippable to Google Play + fix the POPIA §35 age-gate.
**VERIFIED CURRENT STATE** (read directly from repo before writing this):
- `apps/android/app/build.gradle:17` `applicationId: 'app.railway.up.saeduweb_production.twa'`, `hostName: 'saeduweb-production.up.railway.app'`
- `apps/web/public/.well-known/assetlinks.json:11` has `"REPLACE_WITH_PLAY_APP_SIGNING_FINGERPRINT"`
- `.gitignore:65/73/77` + `apps/web/.gitignore:1/6/8` contain `<<<<<<<`/`=======`/`>>>>>>>` markers
- `apps/api/src/routes/auth/registration.ts:30` `dateOfBirth: ….optional()`; `:71` gate wrapped in `if (parsed.data.dateOfBirth)`

**⚠️ ORDER MATTERS:** T0-1 (keystore rotation) MUST complete before T0-3 (assetlinks
fingerprint) because the fingerprint in assetlinks must be the ROTATED key's.
T0-4 (gitignore) is independent — do it early. T0-5 (age-gate) is independent.

**DO NOT push to origin until T0-1 is fully done** (it rewrites history; see Phase 1).

---

## PHASE 0 — Pre-flight (safe, read-only)
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform
git status --short                 # expect clean + your committed work (commit 502e252a)
git log --oneline -1
git rev-parse HEAD                 # note the SHA; tag it as a safety point
git tag pre-t0-launch-fix $(git rev-parse HEAD)
# Confirm the leaked keystore blobs exist in history (evidence, do not panic)
git rev-list --all --objects | grep -iE '\.keystore$' | head
```
If `git status` is NOT clean, STOP and reconcile before proceeding.

---

## PHASE 1 — T0-1: Rotate the Android upload keystore (P0, credential compromise)
The upload keystore is in pushed git history (blobs `apps/android/android.keystore`,
`apps/android-signing/android.keystore`, `apps/mobile/android/app/debug.keystore`).
Treat as compromised. Steps:

### 1a. Generate a NEW upload keystore (local, NEVER commit it)
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform
mkdir -p keys && chmod 700 keys
keytool -genkeypair -v -keystore keys/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload \
  -dname "CN=SCHOOL, O=DITSHEGO VENTURES (PTY) LTD, C=ZA"
keytool -export -rfc -keystore keys/upload-keystore.jks -alias upload \
  -file keys/upload_cert.pem
# Record the NEW upload cert fingerprint (you'll need it for Play + assetlinks):
keytool -list -v -keystore keys/upload-keystore.jks -alias upload \
  2>/dev/null | grep -A1 "SHA256:" | head -2
```

### 1b. Request upload-key reset from Google Play
> This is a HUMAN/Console action, cannot be scripted:
> 1. Play Console → your app → **Setup → App integrity → Request upload key reset**.
> 2. Upload `keys/upload_cert.pem` when prompted.
> 3. Wait for Google to confirm the reset (can take up to 2 business days).
> Play will then sign with ITS app-signing key; the `sha256_cert_fingerprints`
> that belongs in `assetlinks.json` is the **Play App Signing** cert
> (Play Console → Setup → App integrity → "App signing key certificate" SHA-256),
> NOT necessarily your upload key. Use the App Signing cert fingerprint in T0-3.

### 1c. Purge keystores from git history (AFTER rotation, BEFORE next push)
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform
# DRY RUN first — must show the 3 paths and nothing else unexpected
git filter-repo --invert-paths --dry-run \
  --path apps/android/android.keystore \
  --path apps/android-signing/android.keystore \
  --path apps/mobile/android/app/debug.keystore
# If dry-run looks right, run for real:
git filter-repo --invert-paths \
  --path apps/android/android.keystore \
  --path apps/android-signing/android.keystore \
  --path apps/mobile/android/app/debug.keystore
# Verify removal
git rev-list --all --objects | grep -iE '\.keystore$' && echo "STILL PRESENT" || echo "OK: no keystore in history"
```
> ⚠️ `git filter-repo` rewrites ALL history. All collaborators must re-clone afterward.
> Coordinate with the team first. This is the reason we did NOT push in the prior step.

### 1d. Ensure keystores can never be re-committed
Append to `.gitignore` (and `apps/web/.gitignore` if it's the repo-root one being used):
```
# Keystores / secrets — NEVER commit
*.keystore
*.jks
*.p12
*.pem
keys/
```
(Keep `upload_cert.pem` out of git — it's a public cert but no need to track it.)

**✅ T0-1 DONE when:** Play reset confirmed + `git rev-list … | grep keystore` returns nothing.

---

## PHASE 2 — T0-4: Resolve committed `.gitignore` merge-conflict markers (P0 hygiene)
Two files have conflict markers. Read each, keep the CORRECT union of rules, delete markers.

### 2a. Repo-root `.gitignore` (markers at lines 65/73/77)
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform
sed -n '60,80p' .gitignore      # inspect both sides of the conflict
```
Manually edit `.gitignore` to remove the `<<<<<<< HEAD` / `=======` / `>>>>>>> origin/claude/…`
lines, keeping the superset of ignore rules from both sides. Then:
```bash
grep -nE '<<<<<<<|=======|>>>>>>>' .gitignore && echo "STILL HAS MARKERS" || echo "OK clean"
```

### 2b. `apps/web/.gitignore` (markers at lines 1/6/8)
```bash
sed -n '1,12p' apps/web/.gitignore
# Edit to remove the 3 marker lines, keep the union of rules.
grep -nE '<<<<<<<|=======|>>>>>>>' apps/web/.gitignore && echo "STILL HAS MARKERS" || echo "OK clean"
```

**✅ T0-4 DONE when:** both files grep-clean; `git status` shows them modified.

---

## PHASE 3 — T0-2: Fix TWA `build.gradle` to PRODUCTION (P0)
Current (WRONG — staging):
```
applicationId: 'app.railway.up.saeduweb_production.twa',
hostName: 'saeduweb-production.up.railway.app',
```
Target (matches `twa-manifest.json`: host `school.ditshego-ventures.co.za`, packageId `za.co.ditshego.school`):

### 3a. Edit `apps/android/app/build.gradle`
Use the patch tool or sed to change EXACTLY these two lines:
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform
# Replace applicationId line
#   applicationId: 'app.railway.up.saeduweb_production.twa',
# with
#   applicationId: 'za.co.ditshego.school',
# Replace hostName line
#   hostName: 'saeduweb-production.up.railway.app', // The domain being opened in the TWA.
# with
#   hostName: 'school.ditshego-ventures.co.za', // The domain being opened in the TWA.
```
Apply via your patch tool with these exact old→new strings:
- OLD: `    applicationId: 'app.railway.up.saeduweb_production.twa',`
- NEW: `    applicationId: 'za.co.ditshego.school',`
- OLD: `    hostName: 'saeduweb-production.up.railway.app', // The domain being opened in the TWA.`
- NEW: `    hostName: 'school.ditshego-ventures.co.za', // The domain being opened in the TWA.`

### 3b. Regenerate the TWA manifest (preferred over hand-edits)
If `bubblewrap` is available:
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform/apps/android
bubblewrap build --manifest src/main/assets/twa-manifest.json  # or re-run init against the prod URL
```
Otherwise the manual edit in 3a is sufficient; just re-verify the generated
`twa-manifest.json` host/packageId match.

**✅ T0-2 DONE when:** `grep -n "za.co.ditshego.school\|school.ditshego-ventures.co.za" apps/android/app/build.gradle` shows the prod values; no `railway` host remains.

---

## PHASE 4 — T0-3: Replace `assetlinks.json` placeholder (P0)
### 4a. Get the correct SHA-256
Use the **Play App Signing** certificate fingerprint (from Play Console → Setup →
App integrity → App signing key certificate). If you must use the upload key for a
pre-release internal track, use the upload cert fingerprint from Phase 1a instead.
Let `PLAY_SHA256` = that value (format `AA:BB:CC:…:FF`, 32 groups).

### 4b. Edit `apps/web/public/.well-known/assetlinks.json`
Replace the placeholder line. Current:
```json
        "REPLACE_WITH_PLAY_APP_SIGNING_FINGERPRINT"
```
New (keep the existing real fingerprint AND add the Play one; or if only Play signs,
replace the placeholder entirely):
```json
        "PLAY_SHA256_PLACEHOLDER_REPLACE_ME"
```
→ set it to the real `PLAY_SHA256`. Final file should look like:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "za.co.ditshego.school",
      "sha256_cert_fingerprints": [
        "80:54:AD:84:DA:96:DD:E9:C7:F0:CC:EF:70:70:BE:27:2A:AA:77:59:D4:CF:41:FF:42:B7:38:20:78:44:D4:26",
        "<PLAY_SHA256>"
      ]
    }
  }
]
```
Validate JSON: `jq empty apps/web/public/.well-known/assetlinks.json && echo OK`.

### 4c. Redeploy the web app so `/.well-known/assetlinks.json` is publicly live, then verify:
```bash
curl -s https://school.ditshego-ventures.co.za/.well-known/assetlinks.json | jq .
# Should return valid JSON with the real sha256 in sha256_cert_fingerprints.
```
Also validate via: https://developers.google.com/digital-asset-links/tools/generator

**✅ T0-3 DONE when:** live URL returns valid JSON containing the real Play SHA-256.

---

## PHASE 5 — T0-5: Enforce POPIA §35 age-gate (P1, minors' compliance)
Current: `dateOfBirth` is `.optional()` and the entire gate is inside
`if (parsed.data.dateOfBirth)` — a minor can skip it by omitting DOB.

### 5a. Make DOB required for learner self-signup
In `apps/api/src/routes/auth/registration.ts`:
- Change line 30 from:
  `  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),`
  to:
  `  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),`
  (non-optional). This rejects learner signups without DOB at schema-parse time (400).

### 5b. (Defence-in-depth) Keep the gate logic, but it's now always reached.
The existing block (under-13 → 403; 13–17 → require consent + parentEmail) now runs
for every learner because DOB is mandatory. No further change needed to the `if` block,
but you MAY simplify by removing the `if (parsed.data.dateOfBirth)` wrapper since DOB
is now guaranteed present:
```ts
// Replace the wrapper:
//   if (parsed.data.dateOfBirth) {
//     const dob = new Date(parsed.data.dateOfBirth);
//     ... existing gate ...
//   }
// With (DOB now required):
const dob = new Date(parsed.data.dateOfBirth);
if (isNaN(dob.getTime())) {
  reply.code(400).send({ error: "Invalid date of birth" });
  return;
}
const today = new Date();
const age = today.getFullYear() - dob.getFullYear() -
  (today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate()) ? 1 : 0);
if (age < 13) {
  reply.code(403).send({ error: "Users under 13 may not register in accordance with POPIA §35" });
  return;
}
if (age < 18 && !parsed.data.parentalConsentAcknowledged) {
  reply.code(403).send({ error: "Parental consent is required for users under 18", requiresParentalConsent: true });
  return;
}
if (age < 18 && !parsed.data.parentEmail) {
  reply.code(400).send({ error: "A parent or guardian email address is required for users under 18" });
  return;
}
```

### 5c. Add a test (recommended)
In `apps/api/test/` add a case: POST `/auth/register` as `role: 'learner'` WITHOUT
`dateOfBirth` → expect 400. (Already have `auth-tokens.test.ts` as a pattern.)

**✅ T0-5 DONE when:** registering a learner without DOB returns 400; under-13 path
unreachable; 13–17 still requires consent + parentEmail.

---

## PHASE 6 — Build & smoke test (after all fixes)
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform/apps/android
./gradlew assembleRelease        # TWA APK wrapping school.ditshego-ventures.co.za
# Typecheck the API after the age-gate change:
cd /home/lottie/projects/SCHOOL-Academic-Platform/apps/api && npx tsc --noEmit
```

## PHASE 7 — Commit & (coordinated) push
```bash
cd /home/lottie/projects/SCHOOL-Academic-Platform
git add -A
git commit -m "fix(play): rotate keystore, TWA prod host, assetlinks, age-gate enforcement"
# Mirror the source edits to the other repo (SCHOOL-Academic-Platform) too:
#   copy apps/android/app/build.gradle, apps/web/public/.well-known/assetlinks.json,
#   .gitignore, apps/web/.gitignore, apps/api/src/routes/auth/registration.ts
#   to /home/lottie/SCHOOL-Academic-Platform/<same path>, then commit there.
```
**PUSH:** Because Phase 1c rewrote history, the push to `origin` MUST be a coordinated
force-push after the team has re-cloned, OR push the filter-repo result on a fresh
branch and open a PR. Do NOT silently `git push --force` to `main` without team sign-off.

---

## ROLLBACK / SAFETY
- Pre-flight tag `pre-t0-launch-fix` lets you `git reset --hard pre-t0-launch-fix`.
- `git filter-repo` is destructive to history — only run after Play reset is confirmed
  and the team is notified.
- Keep `keys/` local; never commit `*.jks`/`*.pem`.

## ACCEPTANCE (all must be true for 🟢 GO)
- [ ] `git rev-list --all --objects | grep -i keystore` → empty
- [ ] `.gitignore` (both) grep-clean of conflict markers
- [ ] `build.gradle` host = `school.ditshego-ventures.co.za`, appId = `za.co.ditshego.school`
- [ ] `assetlinks.json` live URL returns valid JSON with real Play SHA-256
- [ ] learner signup without DOB → 400; under-13 → 403; 13–17 needs consent
- [ ] `./gradlew assembleRelease` succeeds; TWA shows NO url bar (trusted)
- [ ] `npx tsc --noEmit` clean in apps/api
