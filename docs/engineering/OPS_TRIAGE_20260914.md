# OPS TRIAGE — 2026-09-14

Consolidated operational signals from email + platform dashboards + workflow runs.
**Result of the 09-14 session**: all triaged; two are owner money-gated, one needs a
PAT scope change, one is a registry action.

## Signals → Resolution

| # | Signal | Severity | Root / action | Status |
|---|---|---|---|---|
| 1 | Past-papers ingest failing for days (≥6 runs Sep 13–14) | High | `curl: option --retry-status: is unknown` on curl 8.5.1. Fix `f44353ea` staged on `fix/ingest-curl-retry` (push blocked by PAT scope) | ✅ Root-caused; deploy blocked by GHA PAT |
| 2 | Supabase "LottieKnight's Project" paused since **Sep 1** | High | Account owner restore. PayFast/supabase on hold because wallet + public DBs depend on it | 🔒 Owner + money |
| 3 | Vercel free tier **75% Function Storage** used | Med | Owns next-gen functions; prune old builds before push of new features | ⏳ owner Vercel cleanup |
| 4 | **Play** final signing-key registration deadline **Sep 30 2026** | High | To ship APK/AAB after… one-time key upload, non-negotiable | 🔒 Owner registry action |
| 5 | 5 failed `saedu-api-server` prod deploys (Aug 25) | Med | ECS rollout aborted; re-run via new PAT once workflow scope granted | ⏳ needs GHA PAT |
| 6 | Google Workspace billing — no confirmed renew-auth after change | Low | receipt in mailbox; verify under billing | ⏳ |
| 7 | `notify-ops` alert steps wired into all workflows (fires on failure only when webhook set) | Info | no-op unless `OPS_ALERT_WEBHOOK_URL` set | ✅ done 09-14 |

## Hard deadlines (register on calendar)

- **Sep 30 2026** — Android Play final signing-key (1 key, irreversible).
- **Supabase** — restore + billing before any new deploy writes.
- LottieKnight PAT: grant **Workflows** scope on GitHub → then replay deploys.

## Where

- Ingest runbook & secrets: `docs/engineering/INGEST_SECRETS.md`.
- Observability snapshot: `docs/observability.md` (§2026-09-14).
- Plan restored: `Desktop/AI LAB/projects/TDBS/SEPTEMBER_2026_PLAN.md`.