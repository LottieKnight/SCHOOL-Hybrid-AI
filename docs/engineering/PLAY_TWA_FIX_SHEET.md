# Android Play Store Release-Blocker Fix Sheet (T0-1, T0-2, T0-3, T0-4)

**Source audit:** TIER0_PLAY_BLOCKERS.md (2026-08-25) + verified drift check (2026-08-26).
**Verdict:** 🔴 NO-GO on the GitHub deploy source (`projects/SCHOOL-Academic-Platform`). The local
`SCHOOL-Academic-Platform` tree is AHEAD (commit `de26cbbc` rebranded TWA to `za.co.ditshego.school`)
but was never pushed. Reconcile before release.

This sheet is for the owner's Play Console / laptop session. It needs owner credentials + keytool,
so it is a human task, not an agent task.

---

## STATUS (verified 2026-08-26)

| ID | Blocker | GitHub (deploy) | Local tree |
|---|---|---|---|
| T0-1 | Leaked upload keystore in git history | ❌ blobs present (f78cf859, 784a8489, 364e105) | ⚠️ not in local history (purged or never pulled) |
| T0-2 | TWA build.gradle wraps STAGING | ❌ `saeduweb-production.up.railway.app` | ⚠️ host fixed to `school.ditshego-ventures.co.za` but lines 79/84 still hardcode staging `webManifestUrl`/`fullScopeUrl` |
| T0-3 | assetlinks.json fingerprint | ❌ must match rotated key | ❌ same |
| T0-4 | .gitignore merge markers | ❌ lines 65/73/77 | ✅ resolved locally |
| T0-5 | POPIA §35 age-gate | ✅ mandatory DOB, under-13 block, parental consent | ✅ same |

---

## STEP 1 — Reconcile the trees (do this BEFORE touching keys)
The local tree's TWA rebrand must reach GitHub; otherwise any key rotation is wasted on stale code.
1. In the local tree: `git push` the `de26cbbc` (and any other) commits to the matching GitHub remote/branch, OR
   cherry-pick `de26cbbc` onto the GitHub tree and push.
2. Confirm GitHub `apps/android/app/build.gradle` now shows `applicationId 'za.co.ditshego.school'` and
   `hostName 'school.ditshego-ventures.co.za'`.
3. STILL fix lines 79 + 84 in `build.gradle` (they hardcode `saeduweb-production.up.railway.app` for
   `webManifestUrl` and `fullScopeUrl`) → change both to `https://school.ditshego-ventures.co.za/...`.

## STEP 2 — T0-1 Rotate the leaked upload key (Play Console)
Treat all three keystores as compromised.
1. Generate a NEW upload keystore:
   ```
   keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Export the cert:
   ```
   keytool -export -rfc -keystore upload-keystore.jks -alias upload -file upload_cert.pem
   ```
3. Play Console → App signing → "Request upload key reset" → upload `upload_cert.pem`.
4. Keep `upload-keystore.jks` OUT of git (verify `*.keystore`, `*.jks`, `*.p12` are gitignored — see T0-4).

## STEP 3 — T0-3 Replace assetlinks.json fingerprint
1. Get the fingerprint of the NEW signing key:
   ```
   openssl x509 -in upload_cert.pem -noout -fingerprint -sha256
   ```
   (Or use the Play App Signing SHA-256 from Play Console → Setup → App integrity → App signing key certificate.)
2. Replace the value in `apps/web/public/.well-known/assetlinks.json` `sha256_cert_fingerprints` with
   the real fingerprint (uppercase colon-separated, e.g. `2F:D0:...`).
3. Redeploy web so `https://school.ditshego-ventures.co.za/.well-known/assetlinks.json` is live.
4. Verify via the Digital Asset Links API that it returns valid JSON matching the signing key.

## STEP 4 — T0-4 Resolve .gitignore merge markers (GitHub)
On the GitHub tree, open the repo-root `.gitignore`; remove the conflict markers around lines 65/73/77
(`<<<<<<< HEAD`, `=======`, `>>>>>>> origin/claude/...`). Keep the correct union of ignore rules and ensure
keystore patterns are present. Commit: `fix: resolve committed .gitignore merge-conflict markers`.

## STEP 5 — Purge keystore blobs from git history (AFTER rotation)
Only after Step 2 (rotation) and only with team coordination (rewrites history):
```
git filter-repo --invert-paths \
  --path apps/android/android.keystore \
  --path apps/android-signing/android.keystore \
  --path apps/mobile/android/app/debug.keystore
```
Acceptance: `git rev-list --all --objects | grep -i keystore` returns nothing; all collaborators re-clone.

## STEP 6 — Build + smoke test
```
./gradlew assembleRelease   # TWA must wrap school.ditshego-ventures.co.za (no URL bar)
```
Upload internal-track build; verify TWA trusted (assetlinks validates).

---

## Acceptance (all must be true for 🟢 GO)
- [ ] GitHub build.gradle: production host + packageId, no staging URLs in lines 79/84
- [ ] Upload key rotated in Play Console; new keystore local-only
- [ ] assetlinks.json live with correct fingerprint; Digital Asset Links validates
- [ ] GitHub .gitignore clean (no merge markers)
- [ ] keystore blobs absent from `git rev-list --all --objects`
- [ ] Internal-track APK wraps prod domain, trusted, no URL bar

*Prepared 2026-08-26. Human-executed (needs Play Console + keytool + git history rewrite coordination).*
