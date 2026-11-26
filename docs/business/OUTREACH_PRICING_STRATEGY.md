# SCHOOL — SA OUTREACH & ECONOMIC PRICING STRATEGY
**Date:** 2026-08-25 · **Operator:** DITSHEGO VENTURES (PTY) LTD t/a SCHOOL
**Principle (operator mandate):** First serve South African students in need with the
resources we can make available; then build an economic pricing system that sustains the
platform without excluding low-income learners. Learning content is NEVER paywalled.

---

## 1. ACCESS-FIRST OUTREACH (students in need)
**Goal:** get free, quality CAPS education to learners who can't pay.

A. **Sponsored-seat programme (Bursary tier — already coded as `bursary` plan, R0).**
   - NPOs, schools, and bursary funds (e.g. NSFAS-adjacent, community trusts) sponsor
     learner seats. A sponsor redeem code maps to `plan_type=bursary`.
   - Action: build a `/redemption` flow + admin bulk-seat issuance (open item in UPGRADE_PLAN_50 #50).

B. **Zero-rated / data-light access.** SA learners on prepaid data are price-sensitive to
   MBs, not only Rands.
   - Pursue a zero-rating partnership (MTN/Telkom/Cell C edu-zero-rating) — open item #48.
   - Ship the lightweight TWA + offline lessons (T0-2 TWA + Workbox offline #22) so a
     learner downloads once and studies without signal.

C. **School & community deployments.** Target no-fee and rural schools (Eastern Cape,
   Limpopo, KZN) via the School tier (R199/educator, class management). Offer the first
   term free to 50 pilot schools.

D. **Offline distribution.** Pre-load lessons onto low-cost Android devices / USB for
   libraries and community centres without connectivity.

E. **Mother-tongue reach.** Multi-language lessons (EN/AF/ZU/SO/TS/ST/XH/TN) — Foundation
   Phase mother-tongue is a CAPS requirement we currently under-serve (#42). Prioritise.

## 2. ECONOMIC PRICING (implemented this session — see pricing.ts / FeatureGate)
**Tiers (ZAR, VAT-inclusive, monthly):**
| Tier | Price | Who | Access |
|---|---|---|---|
| Free | R0 | Anyone | All lessons + past papers; AI/personalisation locked |
| Scholar | R29/mo | Individual learner | + AI tutor, spaced repetition, exam readiness, offline |
| Family | R59/mo | Up to 4 learners | Same as Scholar ×4 profiles |
| School | R199/mo | Educator | + class management, teacher dashboard, analytics |
| Bursary | R0 | Sponsored | Full Scholar access, paid by sponsor |

**Why these numbers:** R29 ≈ one loaf of bread / one taxi trip — the price of *one*
tutoring session (R150–R400) is 5–13× this. The model monetises convenience/power
features, never the curriculum. Wallet/credit economy (already mature) stays for the
marketplace (books, Cosmic Cotton, tutor sessions).

**Cadence:** annual = 10× monthly (2 months free) — implemented in `/billing/subscribe`.
**Payment:** PayFast (ZAR, local cards + EFT + capped mobile money) — self-serve checkout
endpoint added this session.

## 3. GO-TO-MARKET (phased)
**Phase 1 — Credibility (pre-launch, now):** POPIA-compliant, IO registered, Play approved
(T0-1…T0-5). Publish the free tier + bursary programme loudly.
**Phase 2 — Communities:** WhatsApp study groups, school WhatsApp broadcast lists (SA's
dominant channel — build connector #37), Facebook parent groups, TikTok/Reels study tips
(BrandOS auto-post #36).
**Phase 3 — Schools:** Direct outreach to 50 no-fee/rural schools; teacher dashboard demo.
**Phase 4 — Paid (measured):** Google Ads (operator already runs SA/English paid search)
retargeting free-tier users to Scholar; track CAC vs R29 LTV.

## 4. MEASUREMENT
- Free→Scholar conversion (the only monetisation lever that matters at scale).
- Sponsored-seat uptake (outreach KPI).
- Offline-lesson usage (data-access KPI).
- Past-paper completion + exam-readiness lift (outcome KPI).

## 5. IMPLEMENTATION STATUS (this session)
✅ `apps/api/src/services/pricing.ts` — full ZAR tier model + feature flags.
✅ `apps/web/components/SessionProvider.tsx` — exposes planTier + isScholar/Family/School/Bursary.
✅ `apps/web/components/FeatureGate.tsx` — gated by economic tier (free never blocked).
✅ `apps/api/src/lib/payfast.ts` — `createPayFastSubscriptionUrl` (subscription checkout).
✅ `apps/api/src/routes/billing.ts` — `POST /billing/subscribe` (self-serve tier purchase).
⏳ Remaining: redemption UI for bursary codes (#50), zero-rating partnership (#48),
   multi-language lessons (#42), School teacher dashboard (#43).
