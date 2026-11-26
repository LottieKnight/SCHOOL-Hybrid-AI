# SCHOOL — Group Session Handoff Log

**Recreated 2026-09-14** (the original `/home/lottie/SCHOOL_GROUP_SESSION_README.md` was lost
in the workspace sweep). This file lives in-repo so it survives moves.

## What we did this session (2026-09-14)

### Repo relocation & reconcile (A1)
- Repo moved into `C:\Users\molot\Desktop\AI LAB\projects\TDBS\SCHOOL-Academic-Platform`.
- `main` reconciled to `origin/main` @ `61be77a2` (the deployed truth). Old local-only work
  preserved on branch `backup/desktop-main-pre-reconcile-20260914` (82 commits) — **do not
  delete**; it holds the unmerged sprint work.

### Verified on main (A4 / A6)
- Payments/monetisation routes (billing, wallet, invoices, funnels, admin monetisation) are
  registered in `apps/api/src/server.ts`.
- ToS is current: CIPC 2026/349873/07, registered 05/04/2026, "In Business".

### Ingest issue root-caused (A2)
- Daily ingest failures were `curl: option --retry-status: is unknown` (runner curl 8.5.1).
  Fix staged on `fix/ingest-curl-retry`; push blocked by PAT lacking `workflow` scope →
  owner to grant scope, then merge the PR.

### Documents landed on main this session
- `docs/engineering/LAUNCH_SCOPE_NWU_GR12.md` (A5)
- `docs/engineering/INGEST_SECRETS.md` (A8)
- `docs/engineering/OPS_TRIAGE_20260914.md` (D20)
- `docs/engineering/DEAD_WORK_REGISTER.md` (D21)
- `docs/legal/EVIDENCE_VAULT.md` + `docs/legal/operator-agreements/` index (D19/A7)
- `docs/observability.md` snapshot (A9)

## Where the group left off / next session

1. Merge `fix/ingest-curl-retry` (owner: grant Workflows on PAT → `gh pr merge`).
2. Recover `student survival upgrades` (Loadshedding Tracker, Grade Calculator, Referral
   Dashboard, Onboarding Persistence, Performance Indexing) from `b974d21c` (source only) if
   the feature is still wanted.
3. D1/D7 PayFast sandbox → live proposal; D8 Supabase restore + Vercel deploy (money-gated).
4. Play **final signing-key** registration before **Sep 30 2026** (owner).
5. Keystore-leak remediation (rotate key; git filter-repo) — see DEAD_WORK_REGISTER security flag.

## Convention notes
- GitHub = source of truth; keep WSL/Desktop copies as mirrors.
- Plans restored at `Desktop/AI LAB/projects/TDBS/SEPTEMBER_2026_PLAN.md` and
  `WEEKLY_GOALS_TECHDEBT.md`.