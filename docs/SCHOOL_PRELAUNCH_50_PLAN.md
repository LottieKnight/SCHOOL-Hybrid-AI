# SCHOOL — Pre-Launch Audit & 50-Point Upgrade / Patch Plan
**Target launch: Monday.** Compiled 2026-08-23 from a direct read of the repo
(`/home/lottie/projects/SCHOOL-Academic-Platform`) — every item below cites a real file or fact.

> ⚠️ Reality check on "content is generated": on disk, `content/lessons/**/lesson.json`
> returns **0 files** — the Grade-3 lesson folders referenced in the Play hand-off are still
> empty shells. The only school-curriculum artifact present is `school/curriculum/grade12/english.json`
> (a hand-authored outline) plus the 22 NWU `modules-generated/*.json` files (already enriched).
> **Do not launch Monday claiming a full school-lesson corpus exists** until this is reconciled —
> see items 1–4.

---

## TIER 0 — LAUNCH BLOCKERS (must clear before Monday, or slip launch)
1. **Reconcile the "content generated" claim.** Confirm where generated school lessons live.
   If they're in the DB (unreachable locally) or another machine, get them into
   `content/lessons/<phase>/grade-<gg>/<subject>/term-<tt>/week-<ww>/lesson.json` and run
   `scripts/enrich_school_lessons.py`. If they don't exist, either generate them or scope
   Monday's launch to the NWU module corpus + Grade 12 outline only.
2. **CIPC registration contradiction (legal).** `docs/legal/TERMS_OF_SERVICE.md` line 15 states
   reg number `2026/349873/07`, but line 19 says "Registration number: pending — CIPC
   registration in progress." Pick one truth. If registered, fix line 19; if not, fix line 15
   to say "pending" and don't assert a number. This is a consumer-protection / misrepresentation
   risk under the Consumer Protection Act and ECTA §43.
3. **Android signing key is committed to git** (`apps/android/android.keystore`,
   `apps/android-signing/android.keystore`, and `apps/android/app-release-signed.apk.idsig` are all
   `git ls-files`-tracked). Anyone with repo access can sign/impersonate the app. **Rotate the
   key**, add `*.keystore` / `*.jks` / `*.idsig` to `.gitignore`, and purge from git history
   (BFG/filter-repo). This is severity-critical before any public release.
4. **TWA / deep-link host mismatch.** `apps/android/twa-manifest.json` points host to
   `saeduweb-production.up.railway.app` (Railway — expired per project notes) and package
   `app.railway.up.saeduweb_production.twa`, but the Play plan uses package
   `za.co.ditshego.school` on `school.ditshego-ventures.co.za`. `public/.well-known/assetlinks.json`
   matches the Railway package fingerprint (`15:D6:…:70:8C`), not the new package. Regenerate the
   TWA manifest for `za.co.ditshego.school` + `school.ditshego-ventures.co.za`, re-issue
   assetlinks.json, and re-verify the live fingerprint after Play App Signing (per your hand-off note).

---

## TIER 1 — LEGAL & COMPLIANCE (high risk, minors involved)
5. **POPIA Information Officer & Responsible Party** named and registered with the Information
   Regulator (already named in ToS: MK Ditshego) — confirm registration number is on file.
6. **Minor data-processing lawful basis.** Confirm every under-18 data flow relies on verifiable
   parental/guardian consent (POPIA §34–35, Children's Act 38 of 2005). The `users.parental_consent_given_at`
   / `parent_email` wiring exists — verify it actually gates signup for <18.
7. **Research study "Observational Silence" (inattentional blindness) on minors** (`docs/research/consent-observational-silence-v1.md`,
   `stimulus-observational-silence-v1.md`, `attention-study-telemetry.md`). This collects gameplay
   timing/telemetry from <18s in "Game Center." Status is **DRAFT pending NWU REC approval**.
   **Do NOT ship this study before REC clearance + POPIA sign-off.** Gate it behind a feature flag
   defaulting OFF; remove from Monday build unless cleared.
8. **Cross-border processing disclosure.** Consent docs admit servers "may process outside SA."
   Confirm a POPIA §72 cross-border transfer justification (adequate protection / contractual
   clauses) is documented before launch; Stripe/EU AI subprocessors need the same.
9. **Privacy Policy wiring.** `/legal/privacy` route exists, but ToS links it as `[link]`. Replace
   all `[link]` placeholders in ToS/AUP/Cookie/Copyright with real hrefs; add footer links site-wide.
10. **PAIA manual** (Promotion of Access to Information Act) — publish a PAIA manual/section 51
    compliance statement (required for bodies with POPIA obligations). Not found in `docs/legal/`.
11. **Cookie consent banner** — `COOKIE_POLICY.md` exists; confirm a real consent banner is shown
    (not just a policy page) before setting non-essential cookies/analytics.
12. **Refund / Credits policy** — `REFUND_POLICY.md` present; link from wallet UI + ToS §9.4.
13. **Tutor Agreement & tax.** `TUTOR_AGREEMENT.md` present (12% commission, independent contractor).
    Confirm VAT/PAYE stance is consistent with SARS and that tutors are told they're responsible
    for their own tax. Add a KYC/qualification-verification note (ToS §8.6 already flags this).
14. **Copyright of DBE content.** `COPYRIGHT_POLICY.md` says DBE past papers used under "fair use."
    South Africa has **no broad fair-use doctrine** (it's fair dealing, and gov works may carry
    restrictions). Get a DBE/PMG usage position in writing or limit to clearly open DBE assets.
15. **Acceptable Use / safeguarding.** `ACCEPTABLE_USE_POLICY.md` present. Add explicit child-
    safeguarding + anti-grooming monitoring commitments; minors + chat/tutor features demand it.
16. **Liability cap sanity.** ToS §15 caps liability at R500 or 12-months-spend — fine, but confirm
    it doesn't try to exclude POPIA/CPA mandatory duties (it correctly carves those out — keep it).
17. **Jurisdiction / dispute.** ToS §17 references AFSA mediation + Gauteng High Court — reasonable;
    keep, but ensure the company actually exists (item 2) for the clause to mean anything.
18. **Domain / brand.** `school.ditshego-ventures.co.za` live; confirm WHOIS registrant matches the
    entity and that `.co.za` registrant is the Pty Ltd, not a personal handle.
19. **Age-gate vs COPPA/GDPR-K.** For EU/UK under-16s, GDPR-K requires age-appropriate consent (some
    member states set the bar at 13–16). Since you serve minors, add an EU age-consent path or block
    under-16 EU signups pending guardian consent.

---

## TIER 2 — SECURITY (repo & runtime)
20. **Purge secrets from git history.** Beyond the keystore (item 3), scan history for `.env`,
    service-account keys, Stripe keys. `scripts/` and migration logs may contain them.
21. **84 GitHub Dependabot vulnerabilities** (2 critical / 36 high) — triage the critical+high before
    launch; at minimum patch the 2 criticals. Don't ship known-exploitable deps.
22. **`.env` committed?** `.env` exists in the tree (size 3.5KB). Confirm it is gitignored (it should
    be). If any secret is in it and was ever committed, rotate it regardless.
23. **Stripe / payment hardening.** Confirm Stripe webhook signature verification, no secrets in client,
    and that wallet top-up (R0.10–R2,000 caps) matches the live Stripe config.
24. **Research-consent API enforcement.** `apps/api/test/research-consent.test.ts` exists — ensure the
    `412 guardian_consent_required` gate is actually enforced server-side (not just UI).
25. **Auth enforcement regression.** `apps/api/test/route-auth-enforcement.test.ts` exists — run the
    suite; confirm admin/lesson-generation routes require auth in production (not just locally).
26. **Rate limiting / abuse.** Public AI endpoints + past-paper downloads need rate limits to prevent
    scraping/cost blowout (ToS §6.2 bans scraping — enforce technically too).
27. **Password & token storage.** Verify bcrypt/argon2 + HTTPS-only cookies; check `prisma/dev.db` and
    `past-papers.db` aren't shipping with seeded creds.
28. **CORS / CSRF.** Confirm API CORS allowlist = your domains only; CSRF protection on state-changing
    forms (wallet, tutor booking).
29. **Assetlinks + Play signing fingerprint** — after Play re-signs, add Play's production signing key
    fingerprint to `assetlinks.json` (your hand-off already notes this). Automate via
    `bubblewrap fingerprints`.
30. **Backup & restore.** `docs/backup-restore.md` exists — verify automated DB backups run and a
    restore was tested at least once.

---

## TIER 3 — CONTENT & ACADEMIC REFERENCE QUALITY
31. **Enforce "no Wikipedia / academic-only" in CI.** Add a lint/githook that fails if any
    `referenceList[].url` contains `wikipedia` (the module enricher already sets
    `wikipediaExcluded:true`; extend the check to lessons).
32. **Run `enrich_school_lessons.py` the moment lessons exist** and re-validate 0 Wiki links repo-wide.
33. **Source-hash integrity.** Surface `sourceHashes` in the UI ("verified sources") so the
    academic-only claim is visible to users/teachers — it's currently a hidden field.
34. **CAPS alignment attestation.** Each lesson should cite the specific CAPS document/section
    (DBE URL). Add a `capsReference` field; the reference library already has the DBE CAPS portal.
35. **Sepedi / Home-Language accuracy.** Grade-3 Sepedi content must be reviewed by a first-language
    speaker — AI-generated indigenous-language content has high error risk; don't ship unreviewed.
36. **Teacher-notes review.** `teacherNotes` are auto-derived from outlines; have a qualified educator
    sign off on at least the Foundation Phase set before Monday.
37. **Maths/Science worked examples.** Verify solutions are correct (the ToS disclaims accuracy — but
    for a school product, wrong answers erode trust). Spot-check the Grade 12 English/Maths sets.
38. **Past-paper answers provenance.** `past-papers.db` content—confirm answers are DBE/official or
    clearly labelled "learner/contributor solutions, unverified."
39. **AI study assistant disclaimers.** ToS §5.3 covers it; echo the "not a substitute for a teacher"
    notice in-product near every AI answer.
40. **Accessibility (WCAG 2.1 AA).** `docs/accessibility-audit.md` exists — close its findings
    (contrast, alt text, keyboard nav) before a public education launch; schools will expect it.

---

## TIER 4 — PLATFORM / LAUNCH READINESS
41. **Deploy source of truth.** `content/` is gitignored, yet the 22 enriched module JSONs live there.
    Confirm the build/deploy pipeline actually bundles them (Vercel build step / copy) — otherwise
    your enrichment never reaches production. Verify on a staging deploy.
42. **Web + API deploy coherence.** Web=`saedu-api` (Vercel), API=`saedu-api-server` (Vercel),
    `NEXT_PUBLIC_API_URL=https://saedu-api-server.vercel.app`. Confirm both are built & live and the
    api.school.ditshego-ventures.co.za DNS exists (your notes say it has NO DNS — fix or drop it).
43. **Play Console account type.** Per your earlier decision: ship first release under an
    **individual** account (no DUNS gate), upgrade to organisation later when DUNS arrives.
44. **Store listing assets.** `apps/android/store_icon.png` (512) + feature graphic present; need
    **≥2 phone screenshots** from `school.ditshego-ventures.co.za` (capture on a real device).
45. **Closed testing first.** Release to a closed track (internal/beta) before Production — your
    hand-off recommends this; do it Monday, full public after smoke test.
46. **App signing choice.** Choose Play App Signing (recommended); upload key already in AAB. Keep the
    upload key safe (rotated per item 3).
47. **Observability.** `docs/observability.md`, `web-analytics.md` exist — confirm error monitoring
    (Sentry/etc.) + uptime check are live and alert to a real on-call before launch.
48. **CI/CD green.** `docs/ci-cd.md` — ensure the pipeline builds web+api+android and runs tests;
    block merge on test failure.

---

## TIER 5 — POST-LAUNCH (schedule, not block)
49. **DBE/Stakeholder comms.** Notify the school/Parent-body community; have a support mailbox
    (legal@, security@, research@, information-officer@) monitored.
50. **Week-1 watchlist.** Error rate, auth failures, payment disputes, minor-signup consent flow,
    Play reviewer feedback, and the GitHub vuln triage — daily check-in for the first 7 days.

---

## RECOMMENDED SEQUENCING FOR MONDAY
- **Hard gates (must clear or slip):** #1 (content truth), #2 (CIPC), #3 (keystore leak), #4
  (TWA/host mismatch), #7 (minor research study off).
- **Same-day if possible:** #5–6, #9, #20–21, #24–25, #41–42, #44–45.
- **Fast-follow (this week):** #8, #10–19, #22–23, #26–40, #43, #46–50.

## WHAT I CAN DO NEXT (your call)
- A) Immediately fix **#3** (purge/rotate the committed keystore + gitignore) and **#4**
  (regenerate TWA manifest + assetlinks for `za.co.ditshego.school`). Both are concrete, safe edits.
- B) Generate a launch-blocking checklist (markdown ticket list) from the Tier-0/1 items for your
  coding agent.
- C) Investigate **#1** properly — check the DB (if you can provide a reachable DATABASE_URL) or
  another machine for the "generated" lessons.
