# PERSONAL INFORMATION IMPACT ASSESSMENT (PIIA) — TEMPLATE
## DITSHEGO VENTURES (PTY) LTD t/a SCHOOL

**Reference:** POPIA Regulation 4(1)(b) — assessment of the envisaged processing of personal information; and Regulation 4(2) where processing involves large volumes, special categories, or profiling.

**Version:** 1.0
**Owner:** Information Officer — MK Ditshego (privacy@ditshego-ventures.co.za)
**How to use:** Copy this template to `docs/legal/piia/<project-slug>.md`, complete every section, and attach it to the project proposal/PR. A PIIA is required **before** each new project, product, feature, or third-party integration that processes personal information (self-assessment Q38). Review on material change (Q39).

---

## 1. PROJECT / PROCESS IDENTIFICATION
| Field | Detail |
|---|---|
| Project / feature name | |
| Description (what it does) | |
| Business purpose | |
| Owner / product lead | |
| Proposed go-live date | |
| Status (Draft / In Review / Approved / Live) | |

## 2. DATA SUBJECTS & PERSONAL INFORMATION
| Item | Detail |
|---|---|
| Categories of data subjects | e.g. learners, tutors, parents, visitors |
| Personal information collected | e.g. name, email, phone, DOB, academic data, wallet ledger, AI chat |
| Special categories (POPIA s 26)? | ☐ None ☐ Child data ☐ Health ☐ Other: ______ |
| Volume / scale | e.g. <1k / 1k–100k / >100k records |
| Source of information | e.g. directly from data subject, partner, third party |

## 3. LAWFUL BASIS & PURPOSE (POPIA Conditions 2–4)
| Item | Detail |
|---|---|
| Specified, explicit, legitimate purpose | |
| Lawful basis (consent / contract / legal obligation / legitimate interest) | |
| Is explicit consent required? (e.g. minors, direct marketing) | ☐ Yes ☐ No — how obtained |
| Any further processing beyond original purpose? | ☐ No ☐ Yes — basis: ______ |
| Profiling / automated decision-making? | ☐ No ☐ Yes — describe safeguards |

## 4. COLLECTION, STORAGE & RETENTION
| Item | Detail |
|---|---|
| How collected | e.g. web form, API, partner feed |
| Where stored | e.g. Supabase (region), S3, logs |
| Encryption at rest / in transit | |
| Retention period (justify vs POPIA s 14) | |
| Deletion / anonymisation method | |

## 5. SHARING & CROSS-BORDER TRANSFERS (POPIA s 72)
| Item | Detail |
|---|---|
| Operators / processors involved | e.g. Vercel, Supabase, PayFast, OpenAI |
| Does personal information leave SA? | ☐ No ☐ Yes — destinations: ______ |
| Transfer safeguard | ☐ SCCs ☐ Adequate jurisdiction ☐ Consent ☐ Contract necessity |
| Recipients (third parties) | |

## 6. SECURITY SAFEGUARDS (POPIA s 19)
| Item | Detail |
|---|---|
| Technical measures | e.g. bcrypt, JWT, HTTPS, CSP, encryption |
| Organisational measures | e.g. access control, training, runbooks |
| Operator agreements (s 19) in place? | ☐ Yes ☐ Pending — reference |
| Access restricted to authorised staff? | ☐ Yes ☐ No |

## 7. RISK ASSESSMENT
| # | Risk (to data subject / Body) | Likelihood | Impact | Existing control | Residual risk |
|---|---|---|---|---|---|
| 1 | Unauthorised access / breach | | | | |
| 2 | Excessive collection | | | | |
| 3 | Cross-border exposure | | | | |
| 4 | Retention beyond need | | | | |
| 5 | Child-data without valid consent | | | | |
| (add rows as needed) | | | | | |

## 8. MITIGATION & RESIDUAL APPROVAL
- Mitigation actions required before go-live:
  1.
  2.
- Residual risk after mitigation: ☐ Low ☐ Medium ☐ High
- If **High** residual risk: do **not** proceed without Information Officer + (where relevant) legal sign-off, and consider a regulator consultation.

## 9. SIGN-OFF
| Role | Name | Date | Decision |
|---|---|---|---|
| Information Officer | MK Ditshego | | ☐ Approved ☐ Conditional ☐ Rejected |
| Product Lead | | | |
| (Legal, if applicable) | | | |

**Review trigger:** any material change to purpose, data categories, recipients, or jurisdiction requires a fresh PIIA version and re-approval.

---
*Template v1.0 — DITSHEGO VENTURES (PTY) LTD t/a SCHOOL. Reuse freely across group ventures; record each completed assessment under docs/legal/piia/.*
