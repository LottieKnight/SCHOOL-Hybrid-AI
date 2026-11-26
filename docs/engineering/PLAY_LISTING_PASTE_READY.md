# PLAY CONSOLE — PASTE-READY SETUP ASSETS (SCHOOL)
**Package:** `za.co.ditshego.school` · **App:** SCHOOL · **Operator:** DITSHEGO VENTURES (PTY) LTD t/a SCHOOL
**Status:** 🔴 NO-GO for publish until T0-1…T0-5 done. These assets are ready to paste now;
the app is created in Console — fill the fields as you reach them.

> NOTE: Browser control could NOT drive the Console — the agent session has no authenticated
> Play login. These are formatted for you to paste directly into your logged-in Console.

---

## A. STORE LISTING (Store settings → Store listing)
Title (30): `SCHOOL — Learn, Past Papers`
Short description (80): `CAPS-aligned lessons, past papers, AI tutor & exam prep for SA learners.`
Full description:
```
SCHOOL is a South African education platform built for the CAPS curriculum — from Grade R to Grade 12 and tertiary. Study with curriculum-aligned lessons, practice past papers, get AI-powered study coaching, track exam readiness, and connect with tutors.

• Curriculum-aligned lessons across subjects and terms
• Past papers with feedback and targeted practice
• Adaptive practice and spaced-repetition flashcards
• AI study assistant grounded in your syllabus
• Exam-readiness scoring and weak-topic recommendations
• Parent and teacher visibility into progress
• Tutor marketplace and student community

SCHOOL is operated by DITSHEGO VENTURES (PTY) LTD t/a SCHOOL, a registered South African company. We comply with POPIA and protect learners' data, including minors' data under parental consent. Privacy: school.ditshego-ventures.co.za/legal/privacy

Note for parents: Learners under 18 require parental consent to register.
```
Category: `Education`
Tags: `education, studying, exam prep, past papers, South Africa, CAPS, tutoring`
Contact email (developer): `privacy@ditshego-ventures.co.za`
Website: `https://school.ditshego-ventures.co.za`

## B. PRIVACY POLICY (App content → Privacy policy)
URL: `https://school.ditshego-ventures.co.za/legal/privacy`
(Verify it returns HTTP 200 before submitting. It is POPIA/PAIA-compliant with IO details,
children's-data section §6, data-subject rights, and the operator list.)

## C. CONTENT RATING (App content → Content rating) — truthful answers
- Primary rating: **Everyone / PEGI 3 (education, all ages)**
- Targets children under 13 / "Designed for Families"? **Yes — serves minors (not exclusively DfF)** → engages Families Policy
- Violence / blood: **No**
- Sexual content: **No**
- Profanity / hate speech: **No** (moderated community)
- User-generated content: **Yes** (community, messages, tutor marketplace) → needs moderation (present)
- Advertising: **No** (no ad SDK)
- Location sharing: **No precise location** (province/city optional)
- In-app purchases: **Yes** (wallet credits, bookstore, marketplace)
- User interaction (messaging): **Yes** (learner↔tutor, community) → disclosed, moderated
- Collects personal info from children: **Yes (with parental consent)** → Families Policy trigger

## D. DATA SAFETY (App content → Data safety) — truthful
"Does your app collect/process data?" → **Yes**
| Data | Collected | Shared | Deletable |
| Email | Yes | No | Yes |
| Phone | Yes | No | Yes |
| Date of birth | Yes | No | Yes |
| Name/profile | Yes | No | Yes |
| Messages (in-app) | Yes | No | Yes |
| Financial (wallet/credits) | Yes | With PayFast (PCI) | Yes |
| Location (approx, optional) | Yes | No | Yes |
| App activity (lessons/quizzes) | Yes | No | Yes |
| Diagnostics (Sentry, if on) | Optional | With Sentry (EU) | Yes |
Checkboxes: Data encrypted in transit (HTTPS) ✅ · Data encrypted at rest ✅ · All data deletable by user ✅
⚠️ Do NOT claim end-to-end message encryption (not yet implemented). State transport + DB at rest.

## E. TARGET AUDIENCE (App content → Target audience)
- Primary: **13–17** and **18+** (also serves Grade R–12). Minors included → Families Policy applies.
- "Is your app suitable for children under 13?" → answer per the minors-serving reality above.

## F. ASSETLINKS.JSON (T0-3) — apply AFTER keystore reset
The fingerprint below MUST be the **Play App-Signing certificate SHA-256** (from Console →
Setup → App integrity → App signing key certificate), NOT the upload key. Paste the real
value from Console over the PLACEHOLDER, then commit + deploy to
`https://school.ditshego-ventures.co.za/.well-known/assetlinks.json`.
See TIER0_EXECUTION_SCRIPT.md Phase 1b/1c.

## G. PRE-LAUNCH GATE (all required before Publish)
- [ ] T0-1 keystore rotated + Play reset confirmed
- [ ] T0-2 TWA wraps prod host `school.ditshego-ventures.co.za`
- [ ] T0-3 assetlinks.json live with Play signing fingerprint
- [ ] T0-4 .gitignore conflict resolved  ← DONE this session
- [ ] T0-5 age-gate enforced (DOB mandatory)
- [ ] Privacy policy URL set, returns 200
- [ ] Internal AAB built + TWA opens prod domain (no url bar)
- [ ] Content rating + Data safety submitted
- [ ] Icon 512 + feature graphic 1024×500 + ≥2 screenshots uploaded
- [ ] In-app purchases declared
- [ ] Test account supplied to Google (App access)
- [ ] Closed test: ≥12 testers, ≥14 days (Console requires this before production)
