# Release Report — <version / date>

## 1. Version & scope
- Commit(s):  `<hashes from this branch; push only after owner unblocks>`
- Branch: `release-week-0.5-p0`
- Release window: `<start> → <end>`
- Verdict:  BLOCKED / GATED-ON-OWNER / READY

## 2. Infrastructure status (owner-gated)
- Railway billing/API/Redis: `<resolved / still blocked>` + evidence
- Supabase: `<resumed / blocked>`
- GitHub secrets/AWS vars: `<present / missing>`
- Canonical domain decision: **OWNER DECISION REQUIRED** — `<recorded decision>`.
  Firefox-local origin serving: `school.ditshego-ventures.co.za`.
  Production env vars resolve to `saedu-api.vercel.app`.

## 3. Hard gates
| Gate | Classification | Status |
|---|---|---|
| 1 Anonymous AI limiting (2/min, 5/day, server-side) | REMEDIATED | `<live-verify PASS / BLOCKED>` |
| 2 `paid:true` content flag full trace | PASS (existing) | `<re-run PASS>` |
| 3 Student spotlight (no fabricated mock) | PASS | PASS |
| 4 Colour contrast foundation | DEFERRED | `<itemized>` |

## 4. Verification runbooks executed
- [ ] `npm run verify:typecheck`
- [ ] `npm run verify:release` → `artifacts/release-verify/release-verify.md`
- [ ] `npm run verify:release:playwright` → `artifacts/release-verify/playwright/playwright.md`
- Report summaries:  `<PASS / FAIL / BLOCKED / N/A counts>` per suite.
- Evidence snapshots: `<paths>`.

## 5. Release-gating FAIL items (must be 0)
- none / `<id — description — owner action>`

## 6. BLOCKED / owner-pending items
| ID | Check | Reason | Owner action |
|---|---|---|---|
| ... | ... | ... | ... |

## 7. Regressions
- Web unit tests: 196/196
- `tsc --noEmit` (app + verification tooling): clean
- ESLint: clean
- Playwright journeys: `<n>/<n>`
- a11y serious+ gate: `<n>/<n>`
- Perf (desktop/mobile): `<all PASS / itemized>`
- Visual 18-viewport matrix: `<n>/18`

## 8. Signed-off evidence (owner + agent)
- Date/time, reviewer, and the exact report artifacts referenced above.

_Generated from `docs/release/RELEASE_REPORT_TEMPLATE.md`._