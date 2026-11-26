# QUICK WINS — Highest-Confidence, Low-Risk (drafted 2026-08-25)
Correction to the pasted 50-item audit: the "P0-1 committed live secrets" claim was
VERIFIED FALSE (.env is gitignored; keystore purged 2026-08-23). These three wins are
grounded in actual code reads, not assumptions. They are ready-to-commit draft specs —
not yet applied. Review each, then hand to dev/opencode.

| # | Win | Confidence | Risk | Effort | Closes | Files |
|---|---|---|---|---|---|---|
| 01 | KaTeX math rendering in lessons | HIGH | LOW | S (½d) | P1-7 | `apps/web/lib/markdown.ts`, `AiLessonView.tsx`, `package.json` |
| 02 | Per-request nonce CSP middleware | HIGH | LOW | S (½d) | P0-3 (corrected) | `apps/web/middleware.ts` (new), `next.config.mjs`, `layout.tsx` |
| 03 | Visual lesson schema extension | HIGH | LOW | M (1–2d) | P1-6/8/9/10 (foundation) | `packages/shared/src/gen/lessonGenerator.ts`, `AiLessonView.tsx`, `LessonVisual.tsx` (new) |

## Key code facts established before drafting
- `renderMarkdown` = `marked` + `sanitize-html` (NO katex). Math not rendered. CONFIRMED.
- `next.config.mjs` HAS static security headers but NO CSP; comment references missing
  `proxy.ts` middleware. So CSP is incomplete, not absent.
- `GeneratedLessonContent` has no diagram/chart/image/widget fields → lessons are
  structurally text-only. CONFIRMED by type read at lessonGenerator.ts:37.

## Recommended order
Do 01 + 03 together (math is the cheapest visual; schema is the backbone for all the
rest). 02 is independent — ship in parallel. Once these land, the higher-effort visual
wins (image gen via DALL·E/SD, interactive simulations, ConceptMap wiring, WebSocket
real-time, E2E message encryption) become straightforward.

See the three files in this folder for full implementation + acceptance criteria.
