# SCHOOL Platform — Legal Overview and Pre-Launch Checklist

**Last updated:** 2026-04-29

---

## Document Index

| Document | Status | Primary Law Covered |
|---|---|---|
| [Terms of Service](TERMS_OF_SERVICE.md) | Active | ECTA, CPA, common law contract |
| [Privacy Policy](PRIVACY_POLICY.md) | Active | POPIA, GDPR (EEA users) |
| [Refund and Credits Policy](REFUND_POLICY.md) | Active | CPA Sections 16, 44, 56 |
| [Copyright and Content Policy](COPYRIGHT_POLICY.md) | Active | Copyright Act 98/1978, DMCA |
| [Acceptable Use Policy](ACCEPTABLE_USE_POLICY.md) | Active | CPA, PEPUDA, Children's Act |
| [Tutor Service Agreement](TUTOR_AGREEMENT.md) | Active | Labour law, Tax, Children's Act |
| [Cookie Policy](COOKIE_POLICY.md) | Active | POPIA (electronic communications) |
| [PAIA Manual](PAIA_MANUAL.md) | Active | PAIA (s 51) |
| [Marketplace Partner Agreement](MARKETPLACE_PARTNER_AGREEMENT.md) | Template | POPIA s 19 (operator), CPA |
| [PIIA Template](PIIA_TEMPLATE.md) | Template | POPIA Reg 4(1)(b) |
| [Operator Agreements Checklist](OPERATOR_AGREEMENTS_CHECKLIST.md) | Active | POPIA s 19 |

---

## Pre-Launch Legal Checklist

Complete every item before going live with paying users.

### A — Company Registration and Compliance

- [x] **Company registered** with CIPC (Companies and Intellectual Property Commission)
      Registration number **2026/349873/07** (Ditshego Ventures (Pty) Ltd t/a SCHOOL, incorporated 26 May 2026)
      — reflected in all legal documents
- [ ] **Information Officer registered** with the Information Regulator of South Africa
      Apply at: https://www.justice.gov.za/inforeg/
      Cost: Free. Response time: variable.
- [ ] **PAIA Manual drafted and published** (required by PAIA Section 51 for all private bodies)
      Minimum content: how to request records, fees, contact details.
      Publish at: [DOMAIN]/legal/paia-manual
- [ ] **VAT registration** assessed — if annual taxable turnover will exceed R1,000,000, mandatory.
      If below threshold, consider voluntary registration.
- [ ] **Pty Ltd tax registration** with SARS (income tax, PAYE if you hire staff)

### B — Legal Documents

- [ ] Insert company registration number in all documents
- [ ] Insert physical address (required by ECTA Section 43 — a PO Box is NOT sufficient)
- [ ] Insert phone number
- [ ] Insert domain name / website URL
- [ ] Insert Information Officer name and email
- [ ] Insert Information Regulator registration reference
- [ ] Insert launch date as effective date for all documents
- [ ] Insert Stripe account country (ZA — ensure Stripe ZA entity is used for ZAR processing)
- [ ] Insert analytics provider and cookie details in Cookie Policy
- [ ] Insert tutor payout cycle (e.g., "7 business days")

### C — Infrastructure and Third-Party Agreements

- [ ] **Railway Corporation ToS opt-out** — send opt-out letter within 30 days of first accepting Railway's ToS
      Mail to: 548 Market St PMB 68956, San Francisco, CA 94104
      Include: your name, account email/phone, clear opt-out statement
- [ ] **Stripe South Africa account** — ensure processing through Stripe's ZA entity for ZAR
      Required for Consumer Protection Act compliance on refunds
- [ ] **OpenAI Data Processing Agreement** signed
      Required by POPIA Section 21 (operator agreements)
- [ ] **Railway Data Processing Agreement** reviewed/signed
      Required by POPIA for cross-border transfers
- [ ] **AWS/S3 Data Processing Agreement** if storing past papers / uploads there

### D — DMCA Agent Registration

- [ ] **Register DMCA Designated Agent** with the US Copyright Office
      Required for DMCA safe harbor protection (Railway is US-hosted)
      Register at: https://www.copyright.gov/dmca-agent/
      Cost: ~$6/year
      Required fields: agent name, email address, physical address

### E — Website Legal Requirements (ECTA Section 43)

The following must be visible on every page or easily accessible from the footer:
- [ ] Full legal name of company
- [ ] Registration number
- [ ] Physical address
- [ ] Phone number
- [ ] Email address
- [ ] Link to Terms of Service
- [ ] Link to Privacy Policy
- [ ] Link to Refund Policy
- [ ] Link to Cookie Policy

### F — Consent Flows in the Product

- [ ] **Registration flow** — checkbox or explicit consent step for Terms + Privacy Policy
      Do NOT use pre-ticked boxes — invalid under POPIA
- [ ] **Minor account flow** — parental/guardian consent collection mechanism
      (Phone/email verification of parent, or school-level bulk consent for institutional accounts)
- [ ] **Cookie consent banner** — granular consent for optional cookies
      Must not gate core functionality behind accepting optional cookies
- [ ] **Marketing opt-in** — separate, explicit opt-in for promotional emails
      Not bundled with Terms acceptance
- [ ] **Wallet top-up** — clear disclosure of credit-to-ZAR ratio before purchase
      Required by CPA Section 22 (right to information)
- [ ] **Auto-top-up** — clear disclosure of recurring charge terms before activation

### G — Data Protection Operational Readiness

- [ ] **POPIA Compliance Assessment** conducted internally or by a POPIA consultant
- [ ] **Data Subject Request process** operational (30-day SLA as per POPIA)
      intake email: information-officer@[DOMAIN]
- [ ] **Security breach notification procedure** documented
      72-hour notification to Information Regulator required (POPIA Section 22)
- [ ] **Retention schedule** implemented in the database
      Equipment quotes: 30 days max (already configurable via env)
      Financial records: 5 years (VAT Act)
- [ ] **Processor agreements** in place with all third parties (Stripe, OpenAI, Railway)

### H — Content and Copyright

- [ ] **DBE past paper ingestion** reviewed against DBE's terms of access
      Consider proactive communication to DBE regarding your use case
- [ ] **CAPS content** — confirm use falls within educational use exemption
- [ ] **Textbooks in bookstore** — ensure supplier agreements include right to resell/list
- [ ] **AI-generated content disclaimer** visible to users in the AI assistant UI

### I — Tutor Marketplace

- [ ] **Tax practitioner consulted** on independent contractor classification
      Confirm no "employment relationship" indicators under SA labour law tests
- [ ] **Tutor onboarding flow** — agreement acceptance at registration (not just on file)
- [ ] **Safeguarding policy** for tutors working with minors documented
- [ ] **Police clearance process** for tutors defined (optional vs. mandatory)

### J — Financial Services Compliance

- [ ] **National Credit Act** — assess if wallet credit product constitutes credit (it should not,
      as it is prepaid and not credit, but confirm with legal counsel)
- [ ] **FICA** — assess if wallet top-up triggers Financial Intelligence Centre Act obligations.
      At R2,000 max top-up, likely below threshold but confirm.
- [ ] **Payment Card Industry Data Security Standard (PCI-DSS)** — Stripe handles card data;
      confirm SCHOOL does not store raw card data anywhere in the codebase.

---

## Key South African Regulatory Contacts

| Regulator | Jurisdiction | Website | Contact |
|---|---|---|---|
| Information Regulator | POPIA / PAIA | https://www.justice.gov.za/inforeg/ | inforeg@justice.gov.za |
| National Consumer Tribunal | CPA | https://www.thenct.org.za | [see website] |
| CGSO (Consumer Goods Ombud) | CPA | https://www.cgso.org.za | [see website] |
| CIPC | Company registration | https://www.cipc.co.za | [see website] |
| SARS | Tax | https://www.sars.gov.za | [see website] |
| ICASA | Telecoms / zero-rating | https://www.icasa.org.za | [see website] |

---

## Key Laws Referenced in Platform Documents

| Act | Relevance |
|---|---|
| Protection of Personal Information Act 4 of 2013 (POPIA) | Data protection, privacy, minors' data |
| Electronic Communications and Transactions Act 25 of 2002 (ECTA) | E-commerce disclosures, electronic contracts |
| Consumer Protection Act 68 of 2008 (CPA) | Refunds, cancellations, fair terms, quality |
| Copyright Act 98 of 1978 | Past papers, curriculum content, user content |
| Children's Act 38 of 2005 | Minor learners, safeguarding |
| Promotion of Access to Information Act 2 of 2000 (PAIA) | PAIA manual, access to records |
| Promotion of Equality and Prevention of Unfair Discrimination Act 4 of 2000 (PEPUDA) | Non-discrimination in acceptable use |
| Value-Added Tax Act 89 of 1991 | Tax invoicing, VAT obligations |
| Income Tax Act 58 of 1962 | Tutor independent contractor tax treatment |
| Digital Millennium Copyright Act (US) (DMCA) | US infrastructure copyright safe harbor |
| General Data Protection Regulation (EU) 2016/679 (GDPR) | EEA users' data rights |

---

## Important Disclaimer

**These documents are legal templates prepared by an AI assistant and must be reviewed by a qualified South African attorney before use.** They are a starting framework, not final legal advice. In particular, the following require specialist legal input:

1. The independent contractor classification of tutors (labour law risk)
2. The wallet credit product's classification under financial services law
3. The DBE past paper usage rights
4. Your specific POPIA compliance requirements based on your data flows
5. VAT registration requirements based on projected revenue

Recommended: engage a South African technology law firm familiar with EdTech, fintech (for the wallet), and consumer protection law before launch.

---

*Ditshego Ventures (Pty) Ltd t/a SCHOOL — [Redacted for public repository — contact privacy@ditshego-ventures.co.za] — CIPC reg. 2026/349873/07*
