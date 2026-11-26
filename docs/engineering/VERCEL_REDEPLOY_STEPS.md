# Vercel Redeploy Runbook — `saedu-api` (web app)

When to use: AFTER the coordinated force-push lands the legal-page fix (commit
`fe3322b4` / `0e6daa02`) on git origin. This deploys the `/legal/*` 500 fix to
`https://school.ditshego-ventures.co.za`.

Project identity (from `.vercel/project.json` in `projects/SCHOOL-Academic-Platform`):
- Project: `saedu-api`  (id `prj_oHiKgwqSM22xOEceIi96of5Mefll`)
- Org/team: `team_vKDv43hFTM6kvJ1E2AQq3FTb` (lottieknights-projects)
- Root directory: `apps/web`  (this is the web app that serves the legal pages)
- Linked git branch: the one the coordinated push updates (main on `projects`, sprint-3 on bare)

IMPORTANT — why NOT a local CLI deploy:
- `vercel deploy --prebuilt` from the monorepo root double-appends `apps/web` (project
  `rootDirectory` + cwd) → "path does not exist".
- `--prebuilt` ignores `.vercelignore`, so it tries to upload repo-root ML models
  (`models/school-caps/*.safetensors`, several hundred MB each) and hits Vercel's 100 MB
  per-file cap → deploy fails.
- Therefore the reliable path is a REMOTE build from git (dashboard Redeploy), which
  applies the project's real build config and `.gitignore` correctly.

## Steps (dashboard, no token needed)

1. Open https://vercel.com and log in as the account that owns `saedu-api`.
2. Go to the team **lottieknights-projects** → project **saedu-api**.
3. Open **Deployments** (left nav).
4. Confirm the latest production deployment is the one built from the pushed branch
   (it should be, since the push triggers a build). If you need to force it:
   - Click the **⋯** (three dots) on the most recent successful deployment →
     **Redeploy** (or "Redeploy to Production").
   - If prompted, choose **"Redeploy with existing Build & Output Settings"**.
5. Wait for the build to finish (watch the部署 log; Next.js build usually 2–5 min).
6. Once "Ready", open the live URL (Production → Domains → school.ditshego-ventures.co.za).

## Verify the fix shipped (run from terminal)

```
for p in privacy terms cookies aup; do
  echo "/legal/$p -> $(curl -s -o /dev/null -w '%{http_code}' https://school.ditshego-ventures.co.za/legal/$p)"
done
```
Expected: all four return `200` (were `500` before the fix).

## If the redeploy still 500s
- Confirm the pushed branch actually contains `apps/web/lib/legalContent.ts`
  (tracked, committed). If the push missed it, the redeploy builds stale code.
- Check Vercel build log for a `readFileSync` / module error — would indicate the
  embed didn't take. Re-run local `npm run build` in `apps/web` to confirm it builds.

## Post-deploy (Play Console)
Once `/legal/privacy` → 200, the **Privacy policy declaration** in Play Console
(App content → Privacy policy) can be filed with URL:
`https://school.ditshego-ventures.co.za/legal/privacy`
This unblocks one of the 10 required publish declarations.
