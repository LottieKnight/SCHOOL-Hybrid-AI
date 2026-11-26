# GOOGLE PLAY STORE LISTING ASSETS — SCHOOL (TWA)
**Date:** 2026-08-25 · **Package:** `za.co.ditshego.school` (post T0-2 fix)
**App name:** SCHOOL (launcher) / SCHOOL Academic Platform (store)
**Type:** Trusted Web Activity wrapping `https://school.ditshego-ventures.co.za`
**Prerequisite:** Complete TIER0_EXECUTION_SCRIPT.md (T0-1…T0-5) first. These listing
assets assume the TWA wraps the PROD domain and the age-gate is enforced.

---

## 1. PRIVACY POLICY (required for Play + POPIA PAIA)
A full PAIA-compliant privacy policy already exists at `docs/legal/PRIVACY_POLICY.md`
and is served at `https://school.ditshego-ventures.co.za/legal/privacy`.

**Action for the agent:** ensure the policy is publicly reachable and use this exact
URL in the Play Console "Privacy Policy" field:
```
https://school.ditshego-ventures.co.za/legal/privacy
```
Confirm it returns 200 and contains: Information Officer (MK Ditshego,
privacy@ditshego-ventures.co.za, [Redacted for public repository — contact privacy@ditshego-ventures.co.za]), POPIA registration note, children's
data section (§6), data-subject rights, and the operator list (Vercel/Supabase/PayFast/
Zoho/OpenAI). All present in the current policy — just verify the live URL.

**Store-listing privacy blurb (short, for the "App permissions" / description area):**
> SCHOOL collects only the personal information needed to deliver education: email,
> phone (for 2FA/alerts), date of birth (age verification + parental consent), and
> payment records. We do not sell your data. Learners under 18 are protected under
> POPIA §35 and the Children's Act — their data is processed only with parental
> consent. Full policy: school.ditshego-ventures.co.za/legal/privacy.

---

## 2. CONTENT RATING QUESTIONNAIRE (Play Console → Content rating)
Answer truthfully. SCHOOL is an **education app that serves minors**, so it is rated
for users under 18 — this triggers Google Play **Families Policy** requirements.

| Question | Answer | Notes |
|---|---|---|
| Primary content rating | **Everyone / PG (South Africa: all ages; education)** | Educational; no violence, no user-generated adult content |
| Does the app target children under 13 / "Designed for Families"? | **Yes — serves minors, but NOT exclusively "Designed for Families"** | We serve Grade R–12 + tertiary; minors included. Select "Yes, it may appeal to / be used by children" → this engages Families Policy |
| Contains violence / blood? | No | |
| Contains sexual content? | No | |
| Contains profanity / hate speech? | No (moderated community) | Note: community/messaging exists → must have moderation (we have report + tutor-DM model) |
| Contains user-generated content (UGC)? | **Yes** (community posts, messages, tutor marketplace) | REQUIRES: anti-abuse policy, moderation, and age-gate. Our age-gate (T0-5) + report flows cover this |
| Contains advertising? | No (organic BrandOS only; no ad SDK) | Confirm no ad network SDK in the TWA |
| Contains location sharing? | No precise location collected | (Province/city only, optional) |
| In-app purchases? | **Yes** (wallet credits, bookstore, marketplace) | Declare; ensure parental auth for minor purchases (our consent flow) |
| Does it allow user interaction (messaging)? | **Yes** (learner↔tutor, community) | Must disclose; covered by moderation + ToS |
| Collects personal/sensitive info from children? | **Yes (with parental consent)** | This is the key Families-Policy trigger — see §3 below |

**Resulting rating:** Likely **"Everyone" / "PEGI 3" equivalent** for SA. Because it
serves children, Google will apply **Families Policy** — the app must:
- Not use the Advertising ID for kids (we don't run ads — fine).
- Have a privacy policy (✅).
- Not link out to non-approved sites for kids (TWA wraps our own domain only — fine).
- Provide a way to delete a child's account/data (POPIA + our deletion flow covers it).

---

## 3. DATA SAFETY FORM (Play Console → App content → Data safety)
Fill per the actual privacy policy. Truthful answers:

**Does your app collect/process data?** Yes.

| Data type | Collected? | Purpose | Shared? | Can user delete? |
|---|---|---|---|---|
| Email | Yes | Login, comms, transactional | No (operators only per DPA) | Yes |
| Phone | Yes | 2FA, alerts | No | Yes |
| Date of birth | Yes | Age verification, parental consent | No | Yes |
| Name / profile | Yes | Personalisation | No | Yes |
| Messages (in-app) | Yes | Delivery, dispute evidence | No (encrypted at rest — see T0 note) | Yes |
| Financial (wallet/credits) | Yes | Transactions | With PayFast/Stripe (PCI) | Yes |
| Location | Optional (province/city) | Localisation | No | Yes |
| App activity (lessons, quizzes) | Yes | Progress/analytics | No | Yes |
| Diagnostics (Sentry, if on) | Optional | Crash fixing | With Sentry (EU) | Yes |

Checkboxes to select in Console:
- [x] Data collected: Profile, Email, Phone, Messages, Financial, App activity, Diagnostics, Location (approx)
- [x] Data shared: (list PayFast/Stripe for financial only) — be precise
- [x] "All data can be deleted by the user" → YES (POPIA right + account deletion)
- [x] "Data is encrypted in transit (HTTPS)" → YES
- [x] "Data is encrypted at rest" → YES (DB; phone + messages encrypted — note T0 backlog: message-body encryption is a planned hardening; state "in transit + DB-level at rest" accurately to avoid misrepresentation)
- [ ] "Need to file a security report" → N/A

> ⚠️ Honesty rule: do NOT claim end-to-end encryption of messages until T0 backlog
> item (message-body encryption) is implemented. State transport + DB encryption.

---

## 4. STORE LISTING COPY (short)
**Title (30 char):** SCHOOL — Learn, Past Papers
**Short desc (80 char):** CAPS-aligned lessons, past papers, AI tutor & exam prep for SA learners.
**Full desc (4000 char max):**
> SCHOOL is a South African education platform built for the CAPS curriculum —
> from Grade R to Grade 12 and tertiary. Study with curriculum-aligned lessons,
> practice past papers, get AI-powered study coaching, track exam readiness, and
> connect with tutors.
>
> • Curriculum-aligned lessons across subjects and terms
> • Past papers with feedback and targeted practice
> • Adaptive practice and spaced-repetition flashcards
> • AI study assistant grounded in your syllabus
> • Exam-readiness scoring and weak-topic recommendations
> • Parent and teacher visibility into progress
> • Tutor marketplace and student community
>
> SCHOOL is operated by DITSHEGO VENTURES (PTY) LTD t/a SCHOOL, a registered South
> African company. We comply with POPIA and protect learners' data, including
> minors' data under parental consent. Privacy: school.ditshego-ventures.co.za/legal/privacy
>
> **Note for parents:** Learners under 18 require parental consent to register.

**Category:** Education
**Tags:** education, studying, exam prep, past papers, South Africa, CAPS, tutoring

---

## 5. GRAPHIC ASSETS CHECKLIST
Play requires these (TWA still needs store art even though the app is a wrapper):

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG (adaptive foreground + background) | ☐ Generate (current `manifest.json` is SVG-only — add 512 PNG) |
| Feature graphic | 1024×500 PNG | ☐ Create (brand: SCHOOL logo on dark bg) |
| Phone screenshots | ≥2, 1080×1920 (or 9:16) | ☐ Capture from web app: lesson view, past-paper, dashboard, AI tutor |
| Tablet screenshots | 7" + 10" (optional but recommended) | ☐ Capture |
| TV banner | 1280×720 (only if TV) | N/A |
| Promo video | YouTube link (optional) | ☐ Optional |

**Agent task:** render the web app at desktop + mobile widths, screenshot the 4 key
screens, export as 1080×1920 PNGs. Generate a 512×512 icon + 1024×500 feature graphic
from the SCHOOL brand (dark `#0A0A0A` theme).

---

## 6. PRE-LAUNCH CHECKLIST (gate before "Publish")
- [ ] T0-1…T0-5 executed (keystore rotated, TWA prod host, assetlinks live, age-gate on)
- [ ] `https://school.ditshego-ventures.co.za/legal/privacy` returns 200
- [ ] Internal-track APK built (`assembleRelease`) and installed on a test device — TWA opens prod domain with NO url bar
- [ ] Content rating submitted + approved
- [ ] Data safety form submitted
- [ ] Privacy policy URL set in Console
- [ ] Icon + feature graphic + ≥2 screenshots uploaded
- [ ] In-app purchases declared (wallet/bookstore/marketplace)
- [ ] Console "App access" / "Login credentials" provided to Google (give a test account)
- [ ] Store listing copy (§4) entered

**🟢 GO when all boxes ticked.** Until T0-1…T0-5 close, the app is 🔴 NO-GO regardless
of listing completeness.
