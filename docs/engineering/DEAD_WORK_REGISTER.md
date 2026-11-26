# Dead-Work / Recoverable-Work Register

Audited 2026-09-14 after the repo relocation & `origin/main` reconcile.

## What was lost

- `/home/lottie` (WSL) was swept. All repos moved to `C:\Users\molot\Desktop\`.
- Old local `main` had **82 commits** not on `origin/main`. During reconcile these were NOT
  merged (they would have clobbered the deployed truth); they are preserved — they are not
  lost. See recoverable below.
- Paths that no longer exist: `/home/lottie/SEPTEMBER_2026_PLAN.md`, `WEEKLY_GOALS_TECHDEBT.md`,
  `SCHOOL_GROUP_SESSION_README.md`, `CLAUDE_CONTEXT.md`. Plan files were re-created at
  `Desktop/AI LAB/projects/TDBS/`. Context/session README: recreate on request.
- `gpu-env` virtualenv gone (bin/python3). Falling back to system python3.

## Recoverable (on branch `backup/desktop-main-pre-reconcile-20260914`)

Local clone before reconcile. Contains **82 commits** ahead of origin/main, including:

- `293c25c6` debug: log resolved DB hostname in plannerDb (ENOTFOUND diagnosis — superseded
  by the curl root-cause finding on the ingest side).
- `dbd7f5a5` campus-feed cron fix (may already be present on origin/main).
- `b974d21c` **student survival upgrades**: Loadshedding Tracker, Grade Calculator, Referral
  Dashboard, Onboarding Persistence, Performance Indexing — **NOT on origin/main**. The commit
  also contains build junk (android/..gradle, dist/, apk/aab/keystore binaries) — cherry-pick
  only the source files if this work is revived.
- Any other unreleased features/demo states on that branch.

To recover any single commit (source only, no binaries):

```bash
git checkout backup/desktop-main-pre-reconcile-20260914 -- <source paths>
# or: git cherry-pick <sha> --no-commit && git restore --staged --source old vs clean
```

## 🔒 SECURITY FLAG — signing keystore leaked into git history

`b974d21c` commits `apps/android/android.keystore` (2,698 B) into history (also a copy at
`apps/android-signing/android.keystore`, plus `app-release-signed.apk`, `.aab`, and the
entire `apps/android/.gradle` tree). Because keystores must never be committed:

1. The key SHOULD be rotated before any Play upload; treat the committed copy as compromised
   (repo is private today, but that can change).
2. `git filter-repo`/history purge was previously an open candidate (G5) — elevate to
   **required security fix** before the repo is ever shared.
3. Confirm these files are NOT currently on `origin/main`. If the repo gets shared,
   regenerate the key and use a secret-backed store.

## Lost vs recoverable summary

| Work | Where | Fate |
|---|---|---|
| 82 local commits (old main) | backup branch | Recoverable via cherry-pick |
| Student survival upgrades | b974d21c (backup) | Recoverable (source only) |
| WSL plans / README | /home/lottie (swept) | Recreated (see above) |
| gpu-env | deleted | Recreate venv if needed |