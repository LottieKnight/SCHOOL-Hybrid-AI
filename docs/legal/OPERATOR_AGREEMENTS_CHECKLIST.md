# POPIA SECTION 19 — OPERATOR AGREEMENTS CHECKLIST

**For:** DITSHEGO VENTURES (PTY) LTD t/a SCHOOL
**Owner:** Information Officer (MK Ditshego — privacy@ditshego-ventures.co.za)
**Last reviewed:** 2026-08-25
**Purpose:** Track whether every person/entity processing personal information on behalf of the Body ("operators") is bound by a written agreement that meets **POPIA Section 19(1)**. This is the evidence behind POPIA self-assessment Question 22 and a precondition for an honest "Yes" on Condition 7 (Security Safeguards).

---

## THE LEGAL TEST (POPIA s 19)

A responsible party must ensure that an operator processes personal information only on its behalf and subject to a **written contract** that requires the operator to:
1. Treat the information as confidential;
2. Only process it for the authorised purpose;
3. Protect it with appropriate security measures (s 19(1)(a)–(c));
4. Notify the responsible party of any security compromise;
5. Not keep or use it after the purpose is met (or return/destroy it); and
6. Submit to audits and allow the responsible party to monitor compliance.

> "Processed on behalf of" includes any cloud host, database provider, payment processor, email/SMS sender, analytics tool, or AI provider that touches personal information.

---

## OPERATOR INVENTORY (derived from the SCHOOL platform stack)

| # | Operator | Role / Data processed | Location | DPA status | Action |
|---|---|---|---|---|---|
| 1 | **Vercel** | Hosts the web app (saedu-api / SCHOOL) and API; web analytics; stores logs | USA / global edge | ⚠️ Verify | Confirm a written agreement / DPA covering the personal information in logs and the hosted database connection strings. Vercel's T&Cs include a DPA for hosted services — capture a copy. |
| 2 | **Supabase** | Primary database (PostgreSQL) hosting all user personal information | USA / EU (region-configurable) | ⚠️ Verify | Execute Supabase DPA (Standard Contractual Clauses where cross-border). Store the signed DPA. |
| 3 | **PayFast** | ZAR payment processing for wallet top-ups | South Africa | ❌ Pending | Obtain PayFast's POPIA / data-processing terms; record acceptance. PayFast is the live ZAR processor (not Stripe for the main wallet). |
| 4 | **Stripe** | Bookstore payments (stub mode currently; `BOOKSTORE_PAYMENT_PROVIDER=stripe`) | USA | ⚠️ Verify | Stripe DPA is standard and GDPR/POPIA-aligned; capture a copy. Activate formally only when the bookstore goes live. |
| 5 | **Zoho Mail** | Corporate email hosting (moloti@, legal@, information-officer@, etc.) | May be SA/US | ⚠️ Verify | Confirm Zoho DPA + data-residency; ensure DKIM/SPF are configured (see weekend-review snapshot). |
| 6 | **Resend** (or Zoho SMTP) | Transactional email sending | USA | ⚠️ Verify | Capture Resend DPA. `EMAIL_FROM=notifications@school.ditshego-ventures.co.za`. |
| 7 | **OpenAI** (AI study assistant) | Processes AI conversation history to generate responses | USA | ⚠️ Verify | Obtain OpenAI API DPA; confirm no training-on-customer-data clause; document data-minimisation (Privacy Policy §13). |
| 8 | **Twilio** (optional) | SMS / phone OTP verification | USA | ❌ Pending (disabled by default) | Only required if real SMS verification is enabled (`TWILIO_*` env). Capture DPA before enabling. |
| 9 | **NVIDIA** | Content-generation tooling / AI infrastructure (Inception Program) | USA | ❌ Pending | Confirm whether any personal information flows to NVIDIA; if yes, execute a DPA. Currently mostly compute/content, low personal-information exposure — document this assessment. |
| 10 | **Sentry** (optional, off by default) | Error monitoring (may capture request data) | EU (Ireland) | ❌ Pending (disabled) | Only if enabled. Capture DPA before enabling. |
| 11 | **Railway** | ~~Former API host~~ — **TRIAL EXPIRED; NOT IN USE.** | USA | N/A | Remove Railway from the operator inventory and from Privacy Policy §8 (see correction note). Do not treat as an operator. |
| 12 | **AWS / S3** (optional storage) | File/past-paper storage (`S3_*` env, currently unset) | af-south-1 (Cape Town) / eu-west-1 | ❌ Pending (unset) | Only if S3 storage is enabled. Capture DPA before enabling. |
| 13 | **Marketplace partners** (iPhone reseller, Cosmic Cotton) | Receive minimum customer data needed to fulfil orders | South Africa | 🟡 Template ready | **Template ready** (MARKETPLACE_PARTNER_AGREEMENT.md, Clause 4 = POPIA s19 operator clause). Execute a signed copy per partner and archive in docs/legal/partner-agreements/. |

---

## SIGN-OFF CHECKLIST (per operator)

For each operator, confirm ALL of the following and attach evidence (file/link) in the Evidence column:

- [ ] Written agreement or DPA **exists** (signed or accepted T&Cs with DPA schedule)
- [ ] Confidentiality obligation explicit (s 19(1)(a))
- [ ] Processing limited to authorised purpose (s 19(1)(b))
- [ ] Security safeguards required (s 19(1)(c)) — aligns with our §11 controls
- [ ] Security-compromise notification clause present (s 19)
- [ ] Return/destruction on termination clause present
- [ ] Audit / monitoring right reserved
- [ ] Cross-border transfer safeguard present (SCCs / adequate protection) where applicable (s 72)
- [ ] DPA copy archived in `/docs/legal/operator-agreements/`

**Evidence folder:** store signed DPAs / accepted terms here:
`docs/legal/operator-agreements/` (repo-root-relative, one file per operator)

---

## CURRENT STATUS

- **Confirmed in place:** CIPC registration (2026/349873/07, "In Business" since 04/05/2026 — email evidence, COR14.1 attachment); POPIA IO Registration 2026-018785 (Moloti Ditshego, appointed 2026-05-04, issued 2026-08-26 — PDF certificate evidence).
- **Active processors (1–7) — action required:** Obtain DPAs from Vercel, Supabase, PayFast (live ZAR processor), Resend, and OpenAI; Stripe DPA only needed when bookstore payment activation occurs. Zoho DPA: verify.
- **Deferred (disabled / unset):** Twilio (8), Sentry (10), AWS/S3 (12) — capture DPAs only when enabled.
- **Pending partner execution:** Marketplace Partner Agreement template ready (doc: `MARKETPLACE_PARTNER_AGREEMENT.md`) — obtain signed copies per partner on onboarding.
- **Remove from inventory:** Railway (#11) — trial expired, no longer in use.

---

*This is a living control document. Re-review whenever a new processor is added, a contract renews, or a self-assessment is repeated.*
