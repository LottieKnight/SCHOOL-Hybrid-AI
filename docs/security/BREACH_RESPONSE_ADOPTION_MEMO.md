# BREACH RESPONSE PROCEDURE — FORMAL ADOPTION MEMO
## DITSHEGO VENTURES (PTY) LTD t/a SCHOOL

**Document type:** Internal approval / sign-off (POPIA Section 22; self-assessment Q24, Q40–Q42)
**Date of adoption:** 2026-08-25
**Procedure adopted:** SCHOOL Data Breach Notification Runbook (docs/security/BREACH_NOTIFICATION_RUNBOOK.md)
**Adopted by:** MK Ditshego, Founder & Information Officer
**Email:** privacy@ditshego-ventures.co.za · **Phone:** [Redacted for public repository — contact privacy@ditshego-ventures.co.za]

---

## 1. PURPOSE

This memo formally adopts the SCHOOL Data Breach Notification Runbook as the **approved security-compromise response plan** of DITSHEGO VENTURES (PTY) LTD t/a SCHOOL, satisfying POPIA self-assessment:

- **Q24** — procedures for detecting, reporting, and investigating data breaches;
- **Q40** — a documented security-compromise response plan;
- **Q41** — staff trained to recognise and respond to security compromises;
- **Q42** — compromise incidents logged, investigated, and documented.

## 2. WHAT IS BEING ADOPTED

The Runbook defines, and the Body adopts as mandatory procedure:

1. **Notifiable breach definition** (POPIA §22) — including unauthorised access to the `users` table, credential/key leaks, minor-data exposure, database dumps, ransomware, and compromised Resend / `PHONE_ENCRYPTION_KEY` / `JWT_SECRET`.
2. **Severity tiers (P1–P4)** with response SLAs (containment 1–24h; regulator notification 24–72h).
3. **Phase 1 — Detect & Contain (0–4h):** scope queries, containment steps, evidence preservation.
4. **Phase 2 — Assess & Notify (4–72h):** harm assessment, 72-hour Information Regulator notification (complaints@inforegulator.org.za) using the approved template, and data-subject notification (§22(3)), including parent/guardian notice for minors.
5. **Phase 3 — Post-Incident (72h+):** incident record under `docs/security/incidents/`, root-cause analysis within 7 days, remediation tracking via GitHub `security`-tagged issues.
6. **Data map** of personal-information categories and their storage/sensitivity.
7. **Key contacts** (Information Officer, Information Regulator, Vercel, Supabase, Resend).

## 3. EFFECTIVE DATE & TRAINING

- **Effective:** 2026-08-25. The Runbook is authoritative for all incidents from this date.
- **Training (Q41):** The Information Officer has reviewed and is trained on the Runbook. Staff/contractors with system access will be briefed on recognition and escalation on onboarding and at least annually. A training record is maintained at `docs/security/incidents/TRAINING_LOG.md`.
- **Drill (Q42):** A tabletop exercise will be run at least annually; the first drill is recorded in `docs/security/incidents/DRILL_LOG.md`.

## 4. ROLES & ACCOUNTABILITY

| Role | Responsibility |
|---|---|
| Information Officer (MK Ditshego) | Owns the procedure; makes the notifiable-breach decision; signs regulator notification |
| On-call engineer / founder | Phase 1 detection & containment; evidence preservation |
| All staff | Recognise and escalate suspected compromises immediately to the Information Officer |

## 5. RECORD-KEEPING (Q42)

Every incident — including those assessed as non-notifiable — is logged in `docs/security/incidents/YYYY-MM-DD-<slug>.md` with the standard fields in Runbook §5.1, and reviewed at the next quarterly compliance review.

## 6. SIGN-OFF

By signing below, the Information Officer confirms the Runbook has been read, is technically accurate for the current stack (Vercel + Supabase + Resend; Railway retired), and is adopted as the Body's formal breach-response procedure.

| | |
|---|---|
| **Name** | MK Ditshego (Moloti Komane Ditshego) |
| **Role** | Founder & Information Officer, DITSHEGO VENTURES (PTY) LTD |
| **Decision** | ☑ Approved & adopted as formal procedure |
| **Date** | 2026-08-25 |
| **Signature** | ___________________________ |

---
*Retention: permanent. Review trigger: any material change to the platform stack, or at least annually. Next review due: 2027-08-25.*
