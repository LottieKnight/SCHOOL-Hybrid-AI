# INGEST — SECRETS & RUNBOOK

**Status (2026-09-14):** Pipeline verified present on `main`. Secrets are **placeholder-only**
until the owner pastes real values. No placeholder was invented as a working secret.

---

## The scheduled ingest (GitHub Actions → web app)

`.github/workflows/past-papers-ingest.yml` triggers every 4 hours and POSTs to the
**web app** admin ingest route:

- Endpoint: `POST /api/admin/ingest/past-papers` in `apps/web` (route:
  `apps/web/app/api/admin/ingest/past-papers/route.ts`)
- Auth: header `x-admin-ingest-token: <ADMIN_INGEST_TOKEN>` (or Bearer)
- Body from the workflow: `{"maxLinks":300,"repairLimit":50}`
- The route runs `npm run ingest:dbe` (`tsx scripts/ingest-dbe-past-papers.ts`) under a
  distributed lock and returns `{ok:true}` only when exit code 0, no timeout, and the
  past-papers coverage SLO holds.

## Required secrets/vars

| Where | Name | Purpose | Status |
|---|---|---|---|
| GitHub Actions secret | `INGEST_URL` | Full URL of the web-app ingest route on the deployed host (e.g. `https://<web-host>/api/admin/ingest/past-papers`) | ❌ Placeholder — owner to set |
| GitHub Actions secret | `ADMIN_INGEST_TOKEN` | Must equal the web app's `ADMIN_INGEST_TOKEN` env var | ❌ Placeholder — owner to set |
| Web app env (Vercel/Caddy) | `ADMIN_INGEST_TOKEN` | Server-side token the route compares against | ❌ Placeholder — owner to set |
| GitHub Actions secret (optional) | `OPS_ALERT_WEBHOOK_URL` | Failure-notification webhook (Discord/Slack/Mattermost). If unset, notify step no-ops. | ⏸ Optional — unset = silent skip |

> If `INGEST_URL`/`ADMIN_INGEST_TOKEN` are missing or mismatched the run fails fast with
> "INGEST_URL is not set" or 401. Set them **in both** GitHub Actions and the deplooyed
> web app so they match.

## Known failure (fixed 2026-09-14, commit `f44353ea`)

Daily `failure_type=network_failure curl_exit=2` with
`curl: option --retry-status: is unknown` — the runner's curl (Ubuntu 24.04, 8.5.1)
does not support `--retry-status` (needs curl ≥ 8.7). Replaced with `--retry-all-errors`.
**Push of commit `f44353ea` currently blocked by PAT lacking `workflow` scope** — re-run the
workflow once the commit is pushed with a workflow-scoped token.

## Smoke check (low-risk, bounded)

```bash
npm run ingest:dbe:smoke50   # dry-run parse + bounded real ingest (max-links=50)
```

Run against a scratch DB first to avoid importing into the live table unexpectedly.