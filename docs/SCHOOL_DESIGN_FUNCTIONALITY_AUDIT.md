# SCHOOL Academic Platform
## Design, Product, and Functionality Audit

**Prepared for:** Ditshego Ventures (Pty) Ltd t/a SCHOOL  
**Repository reviewed:** `LottieKnight/SCHOOL-Academic-Platform`  
**Reference branch:** `main` at `e5dfa0d` (`style(brand): unify SCHOOL palette to gold #e8c15a on onyx/slate`)  
**Audit mode:** Read-only repository audit; no source, deployment, or account changes were made.  
**Confidence:** High for repository and architecture findings; medium for rendered visual findings because dependencies were not installed and a live browser pass was not performed in this audit.

---

## 1. Executive verdict

SCHOOL is not short on ambition or capability. The repository contains a serious education platform: learning, CAPS-aligned content, past papers, an AI study assistant, planner, quiz and gamification loops, community, messaging, tutors, bookstore and equipment commerce, bursaries, wallet/credits, mobile surfaces, university modules, admin tooling, analytics, research, and a substantial operational/security layer.

The problem is **not feature poverty**. It is **product gravity**.

Today, the product can be interpreted as:

> “A large education platform with many useful surfaces.”

It needs to become:

> **“The South African learner operating system that turns today’s uncertainty into a clear next study action — and proves progress.”**

That is the wedge. Everything else should orbit it.

### Strategic recommendation

Make the product’s centre of gravity the **SCHOOL Study Loop**:

1. **Know what matters next** — curriculum, timetable, weakness, deadline.
2. **Study it** — lesson, explanation, notes, language support, accessible content.
3. **Prove it** — quiz, past paper, marking, confidence, misconception detection.
4. **Recover intelligently** — targeted practice, spaced repetition, tutor/community support.
5. **See the journey** — progress, streak, readiness, next best action.

The platform’s differentiator should not be “we have AI, community, games, and a marketplace.” Competitors can copy feature checklists. The defensible story is **curriculum-grounded intelligence plus an unusually coherent action loop, built for South African academic realities and constrained devices**.

---

## 2. What was audited

### Repository shape

| Signal | Observed evidence | Strategic meaning |
|---|---|---|
| Frontend scale | Approximately 1,147 TypeScript/TSX files across apps and packages | Significant capability, but high coordination and consistency cost |
| Web API surface | Approximately 145 `apps/web/app/api/**/route.ts` routes | Broad functionality; discoverability, ownership, and contract drift become risks |
| Database evolution | Approximately 112 API migrations | The platform has real domain depth; migration governance is now a product concern |
| Product surfaces | Web, mobile, Android/TWA, API, admin, content tooling | SCHOOL can become an ecosystem, but needs a canonical learner experience |
| Brand foundation | Gold/onyx/slate tokens, local fonts, SCHOOL logo, Ditshego footer | Strong raw material for a memorable South African premium-study identity |
| Operational maturity | CI, release docs, security docs, load-test harness, analytics, Sentry hooks | The project is beyond prototype stage, but launch gates remain open |

### Primary evidence reviewed

- `apps/web/app/page.tsx` and `apps/web/app/page.module.css`
- `apps/web/app/layout.tsx` and `apps/web/app/globals.css`
- `apps/web/components/ShellLayout.tsx`
- `apps/web/components/Sidebar.tsx`
- `apps/web/components/ui/SiteFooter.tsx`
- `apps/web/app/api/**` route inventory
- `apps/api/src/**` domain and middleware inventory
- `apps/api/migrations/**`
- `apps/mobile/**`
- `docs/LAUNCH_CHECKLIST.md`
- `docs/SCHOOL_BOARD_PACKET.md`
- `docs/RESTRUCTURE_PLAN.md`
- CI/release/security workflow files
- Existing test and E2E inventories

### Not performed in this pass

- Live browser screenshots at 375/768/1280/1920px
- Full dependency installation and production build
- Authenticated end-to-end task completion
- Production data quality verification
- Competitor pricing or market-share research

Those should be the first low-cost validation activities before any large visual rewrite.

---

## 3. Product diagnosis

### 3.1 The product is feature-rich but cognitively expensive

The route inventory exposes a very large surface area: learning, assistant, community, messages, planner, library, past papers, daily quiz, games, marketplace, textbooks, bookstore, tutors, bursary, wallet, credits, profile, settings, notifications, press, university, admin, and multiple legacy/canonical learning paths.

That is a powerful moat only if the user does not have to understand the whole platform to get value.

**Observed risk:** the navigation and information architecture appear to expose the platform’s internal breadth rather than the learner’s immediate job. `Sidebar.tsx` contains many primary and secondary destinations, streak fetches, profile logic, quick actions, badges, and role-specific logic in one navigation component. This is a warning sign for cognitive load and future navigation drift.

**Recommendation:** reorganise around user intent, not departments or modules:

- **Today** — the next best action, timetable, active streak, urgent work.
- **Learn** — curriculum, lessons, assistant, notes, language tools.
- **Practise** — quizzes, past papers, targeted weakness sets.
- **Community** — circles, questions, tutors, messages.
- **Progress** — readiness, skills, streaks, evidence of improvement.
- **More** — marketplace, bursaries, wallet, profile, settings.

The current feature set can survive. The hierarchy must change.

### 3.2 The winning product unit is the “next action,” not the dashboard

The existing product appears to have the ingredients of a good dashboard: XP, planner, quiz, assistant, past papers, content, community, and recommendations. The opportunity is to turn the landing experience into a **decision surface** rather than a link directory.

A learner should open SCHOOL and immediately see:

- “You have 22 minutes before your next commitment.”
- “Your weakest concept this week is elasticity.”
- “Complete this 8-question retrieval set.”
- “Your exam readiness moved from 61% to 68%.”
- “Your lecturer/teacher uploaded a new resource.”
- “Your past-paper memo reveals one recurring misconception.”

That is a product experience competitors struggle to fake because it requires the content, assessment, planner, analytics, and AI layers to agree.

### 3.3 The platform currently carries several identities

The repository contains signals for:

- South African R–12 / CAPS learning
- university learning and module content
- AI study assistance
- community and social discovery
- marketplace and commerce
- Ditshego Ventures brand infrastructure
- research and impact surfaces
- “old money” / premium visual styling
- games and entertainment

This is creatively rich, but the public narrative risks becoming diluted. The buyer, learner, parent, teacher, university student, tutor, seller, and administrator do not have the same first job.

**Recommendation:** keep the platform broad internally, but establish explicit product modes:

1. **SCHOOL Learner** — the flagship consumer experience.
2. **SCHOOL Campus** — university and institution workflows.
3. **SCHOOL Classroom** — teacher/class management.
4. **SCHOOL Network** — tutors, community, and support.
5. **SCHOOL Market** — commerce and access services.

These modes can share identity and data, while marketing, onboarding, and navigation stay role-specific.

### 3.4 The strongest differentiator is local context plus learning intelligence

The repository shows local relevance through CAPS content, past papers, South African universities, bursaries, multilingual language routes, low-data/lite-mode concerns, local payment/wallet flows, and institution-specific theming.

The product should say this more confidently:

> **Built for how South African learners actually study: imperfect connectivity, mixed language comfort, public exam evidence, campus pressure, funding realities, and the need to know what to do next.**

This is a sharper position than generic “AI-powered education.”

---

## 4. Design audit

### 4.1 What is working

- Gold/onyx identity is distinctive and more ownable than generic ed-tech blue.
- Local fonts are self-hosted in `apps/web/app/layout.tsx`, which supports performance, CSP, and offline-friendly delivery.
- The landing page has editorial ambition: large display typography, proof/stat blocks, feature grouping, sign-in card, CTA hierarchy, and branded atmosphere.
- `SiteFooter.tsx` explicitly names **DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL**, includes registration information, and links back to Ditshego Ventures. This is a useful trust asset that should be elevated, not hidden only in the footer.
- Shared tokens in `globals.css` provide a base for consistent surfaces, radii, motion, and semantic colours.
- The app has an intentional motion language: splash transition, ambient orbs, shell entrance, celebration overlays, and interactive cards.

### 4.2 What is holding the visual system back

The identity currently leans toward **premium dark interface + decorative glow**. That can be memorable, but it can also become visually heavy, high-contrast, and repetitive if every surface uses the same gold edge, dark glass, glow, and italic display type.

Specific concerns:

- The landing page hero uses a large italic display title, gradients, drop-shadows, aurora orbs, grid treatment, and multiple premium effects at once. The result risks competing with the actual proposition.
- `globals.css` sets `cursor: default` globally. While not a functional blocker by itself, this is an unnecessary override that can make interactive affordances feel less native and requires every interactive surface to recover the expected pointer behavior.
- Inputs globally set `outline: none` and rely on border/shadow states. There is a `:focus-visible` ring, which is good, but form-specific focus behavior should be tested on every theme and contrast combination.
- `ShellLayout.tsx` applies a global shell fade and an 8px blur transition. This is visually polished on first entry but may feel slow or disorienting on frequent navigation, especially on low-end devices or for motion-sensitive users.
- The CSS contains many semantic tokens plus multiple themes/institution accents. That flexibility is valuable, but theme combinations can become difficult to reason about and test for contrast and hierarchy.
- The landing page uses inline style fragments for some typography and spacing inside otherwise tokenised CSS. This makes future system-wide refinement harder.
- The platform’s “premium” aesthetic should be balanced with **academic clarity**. A learner under exam pressure should feel guided, not impressed at the expense of speed.

### 4.3 Required Before/After design table

| Before | After | Why |
|---|---|---|
| Hero relies on many simultaneous effects: gradient type, multiple drop-shadows, aurora orbs, grid, glass, and shine | Keep one signature effect per surface: editorial type + quiet gold light; reserve glow for active state and key proof | Makes the brand feel confident rather than over-decorated |
| Landing hero asks users to interpret several proof cards and feature grids before understanding the outcome | Lead with a concrete promise: “Open SCHOOL. Know what to do next.” Then show one live-looking action card and supporting proof | Converts visual theatre into product comprehension |
| Sidebar exposes a broad set of destinations and secondary features | Group into Today / Learn / Practise / Community / Progress, with More as a deliberate overflow | Reduces cognitive load without deleting capability |
| Dashboard is likely to become a collection of cards | Use a command-centre composition: next action, active course/subject, readiness signal, recent evidence, recovery route | Makes the dashboard operational rather than decorative |
| Gold is used as both brand accent and many interactive/status treatments | Reserve gold for brand/action, use cyan or mint for AI/system freshness, green/amber/red for semantic states | Improves hierarchy and prevents gold fatigue |
| Global shell entrance uses opacity + blur | Use a fast 160–220ms opacity/translate entrance for normal navigation; keep longer cinematic motion for onboarding/celebrations | Protects perceived speed and respects frequent use |
| Links and cards mostly communicate through colour/hover elevation | Add explicit state language: “Continue,” “Review,” “Locked until,” “Due today,” “Improving,” “Needs attention” | Makes the interface more legible to new and stressed users |
| Ditshego Ventures is primarily a legal footer mention | Add a small “A Ditshego Ventures company” mark on public pages, onboarding, legal/trust surfaces, and partner/institution views | Builds parent, institution, and partner trust without stealing SCHOOL’s spotlight |
| Mobile navigation is a separate compressed version of the same broad product | Make mobile a deliberate “Today / Learn / Practise / Progress / More” loop with a persistent quick capture/ask action | Optimises for one-handed, low-bandwidth, high-frequency study |
| Decorative motion is global and ambient | Tie motion to meaningful change: progress gained, answer clarified, task completed, new resource received | Delivers delight that reinforces learning rather than distracting from it |

---

## 5. Design direction: “SCHOOL / The Scholar’s Command Centre”

### 5.1 Brand idea

**SCHOOL** should feel like the learner’s private command centre: calm under pressure, precise, local, and quietly premium.

A possible brand line:

> **SCHOOL — know what to do next.**

Supporting line:

> Curriculum-grounded learning, practice, intelligence, and progress for South African learners — by Ditshego Ventures.

### 5.2 Visual language

- **Base:** onyx/graphite, not pure black everywhere.
- **Signature:** warm house gold used as an intentional signal, not wallpaper.
- **Academic layer:** ivory paper, ruled lines, marginalia, index-card metaphors, exam-paper textures used sparingly.
- **Intelligence layer:** restrained cyan/mint for system recommendations, AI confidence, and freshness.
- **Type:** editorial serif for meaning and confidence; humanist sans for utility; mono only for metadata and small labels.
- **Shape:** strong cards with a few deliberately asymmetric compositions; avoid making every item a rounded floating tile.
- **Motion:** fast feedback for controls; slower ceremonial motion only for milestones, onboarding, and achievement.

### 5.3 Signature components to build

1. **Next Action Card** — one action, one reason, one expected duration.
2. **Readiness Dial** — subject/module readiness with evidence links, not a decorative score.
3. **Weakness Map** — concepts, confidence, last seen, recommended recovery action.
4. **Evidence Rail** — recent quiz, past-paper, note, or tutor interaction that changed the learner’s state.
5. **Study Sprint Bar** — 15/25/45-minute modes with low-distraction focus.
6. **Grounded Answer Panel** — AI response with curriculum/source anchors and “show me the step” controls.
7. **Institution Context Badge** — university/school/programme context that makes the platform feel personalised.
8. **Ditshego Trust Mark** — subtle company/operating partner treatment on public and institutional surfaces.

---

## 6. Functionality audit

### P0 — release and trust blockers

These are not aesthetic polish items. They affect whether the platform should be presented as fully launched.

1. **Complete the launch gates already documented.** `docs/LAUNCH_CHECKLIST.md` explicitly lists open items across POPIA/consent, payment readiness, Android/TWA safety, infrastructure/load, message encryption, HSTS, and content coverage.
2. **Resolve minors’ message-body encryption gap.** The checklist says message schema columns exist but the send path still writes plaintext body. This is a trust and compliance blocker for a platform serving minors.
3. **Close the Android/Play no-go items before making mobile a headline promise.** The checklist calls out a leaked keystore in history, staging host drift, placeholder assetlinks fingerprint, and `.gitignore` conflict markers.
4. **Prove the content floor.** The launch checklist records only a fraction of lessons validated and identifies missing subject/language coverage. A beautiful empty curriculum is worse than a smaller trustworthy one.
5. **Make the production source of truth explicit.** Existing docs refer to tree drift and stale deployment sources. Release/deploy documentation needs one canonical branch/ref and a verified deploy provenance check.
6. **Clarify retired versus canonical learning paths.** The repository contains legacy route notices and retired API endpoints. These should be hidden from normal navigation, redirected where safe, and monitored for traffic.

### P1 — high-leverage product gaps

1. **Next-best-action engine:** unify planner, quiz performance, past-paper results, content, and deadlines into one daily recommendation contract.
2. **Assessment-to-recovery loop:** after a quiz or past paper, every incorrect answer should lead to a concept explanation, targeted mini-set, and retry state.
3. **Evidence-backed AI:** every assistant response should expose curriculum/module/source context and confidence boundaries. Avoid generic chatbot positioning.
4. **Readiness model:** define one learner-facing readiness model with transparent inputs. Avoid separate XP, streak, score, wallet, and progress numbers competing for attention.
5. **Onboarding compression:** ask only the minimum needed to create a useful first action. Progressive profiling should collect preferences after value is demonstrated.
6. **Role-specific product entry:** learner, teacher, parent, tutor, and institution experiences should have distinct landing logic and navigation rather than one universal shell.
7. **Offline/low-data promise:** make lite mode discoverable, measurable, and designed as a first-class path, not an emergency state.
8. **Community quality loop:** surface trusted questions, accepted answers, mentor/tutor quality, and moderation cues. A community feature is only a moat if it reliably improves study outcomes.
9. **Monetisation clarity:** wallet, credits, subscriptions, past-paper unlocks, marketplace, and tutor economics should share one plain-language entitlement model.
10. **Mobile parity contract:** define the small set of journeys that must be perfect on mobile: onboarding, today, learn, practice, assistant, progress, and offline recovery.

### P2 — polish and growth opportunities

- Study-session summaries that become revision cards automatically.
- Local-language explanation toggle at the concept level, not only global settings.
- Teacher/class cohort dashboards tied to learning evidence rather than vanity activity.
- Parent-safe progress summaries with explicit consent and privacy boundaries.
- Bursary and opportunity matching linked to academic profile, deadlines, and eligibility.
- Institution theming as a controlled brand layer, not a full visual fork.
- Public SEO pages for curriculum topics, past-paper discovery, bursaries, and learning explainers.
- Better referral narratives: invite a study circle, not merely a user.
- “Proof of progress” share cards that never expose sensitive academic details by default.

---

## 7. Accessibility and inclusive design findings

### Positive signals

- Root layout sets `lang={locale}`.
- Global `:focus-visible` styling exists in `apps/web/app/globals.css`.
- Footer links intentionally use `minHeight: "44px"`, a strong mobile target-size choice.
- The product clearly considers lite mode, offline behavior, language, and low-end devices.
- Local font loading reduces unpredictable external dependency behaviour.

### Risks to validate and fix

- `outline: none` is set on inputs/selects globally; the replacement focus treatment must be checked across all themes and browser states.
- `cursor: default` is applied globally, which can make clickable surfaces feel inert and introduces unnecessary interaction overrides.
- A static scan found multiple `role="button"` and click handlers on non-button elements. Each needs keyboard and accessible-name verification; `FlashcardDeck.tsx` is an obvious candidate for review.
- There are many icon-heavy surfaces and dense game/community components. Accessible names, focus order, live regions, and reduced-motion behavior must be tested by route, not assumed from global CSS.
- `ShellLayout.tsx` uses motion and blur on app entry. Reduced-motion behavior should be explicit for `prefers-reduced-motion: reduce` and should not make navigation feel delayed.
- Dense dashboards and dark-on-dark text tokens need contrast checks for `--text-2`, `--text-3`, gold accents, disabled states, and institution themes.
- Forms and asynchronous errors need a consistent pattern: labels, `aria-invalid`, `aria-describedby`, error announcements, and focus to the first error.

### Low-credit validation pass

1. Run a Lighthouse accessibility audit against the public landing page.
2. Run axe against `/`, `/onboarding`, `/dashboard`, `/learn`, `/past-papers`, `/assistant`, and `/messages`.
3. Keyboard-only pass: onboarding, sidebar, command palette, assistant composer, past-paper attempt, quiz submit, modal close, and mobile nav.
4. Test at 200% zoom and with reduced motion.
5. Test dark, light, obsidian/vanta, and at least two institution themes for contrast.

---

## 8. Performance and engineering readiness

### Strengths

- Next.js App Router architecture with server/client separation.
- Self-hosted fonts and Vercel Analytics/Speed Insights hooks.
- Existing E2E harnesses for accessibility, journeys, performance, and visual checks under `apps/web/e2e/prod`.
- API caching, Redis, pooling, throttling, and load-test intent documented.
- CI/release workflow structure exists and security scanning is represented.

### Risks

- The sheer surface area creates a high regression budget. Every new feature should be required to declare its owner, route, API contract, analytics event, empty state, offline behavior, and test coverage.
- `ShellLayout` performs a number of global client-side concerns: navigation, splash, analytics-adjacent UI, referrals, wellness, offline queue flushing, session warnings, and command palette. This is convenient but can become a performance and failure blast radius.
- `Sidebar` fetches quiz and community streak data as part of navigation. Navigation should not depend on multiple network calls; use cached summary data or defer secondary indicators.
- The codebase contains retired/legacy routes and a large number of migrations. Add a deprecation registry and route ownership map.
- CI includes a release deploy placeholder. The repository should report a hard failure if a tagged “production release” cannot actually deploy, or should rename the workflow to clearly describe package-only behavior.
- Tracked local databases (`prisma/dev.db`, `prisma/dev.db-journal`, and `apps/web/prisma/past-papers.db`) should be intentionally documented or excluded from release artifacts; their presence increases confusion about source-of-truth data.

### Recommended engineering contract for every new feature

```text
Feature owner
Primary learner job
Canonical route
API/data owner
Empty/loading/error/offline states
Analytics event + success metric
Accessibility acceptance criteria
Mobile acceptance criteria
Rollback/deprecation path
```

---

## 9. Market position and competitive strategy

This report does not make unverified claims about specific competitor performance. The strategic pattern is still clear.

### Avoid competing on

- Number of features
- Generic chatbot language
- “All-in-one” claims without a visible daily outcome
- Gamification as the primary reason to return
- Premium visual styling without academic proof

### Compete on

1. **South African specificity:** CAPS, past papers, universities, bursaries, local realities, language, connectivity, and affordability.
2. **Action intelligence:** the product tells the learner what to do next and why.
3. **Evidence:** improvement is shown through quizzes, past papers, concepts, readiness, and recovery — not just streaks.
4. **Trust:** grounded AI, privacy-by-design for minors, transparent credits, visible company identity, and credible content provenance.
5. **Continuity:** one learner state across web, mobile, offline, classroom, tutor, and community contexts.
6. **Taste:** a visual identity that feels authored by Ditshego Ventures rather than assembled from generic ed-tech patterns.

### Suggested market narrative

> **SCHOOL is the learning operating system for South African learners. It combines curriculum-grounded lessons, past papers, intelligent practice, an evidence-backed AI tutor, and a clear daily study plan — so every learner can see what to do next and prove they are getting better. SCHOOL is a Ditshego Ventures company.**

---

## 10. Recommended roadmap

### Phase 0 — Truth and focus (1–2 weeks)

**Goal:** make the current product legible before adding more.

- Write the canonical product thesis and role definitions.
- Freeze non-essential new feature work.
- Produce route ownership map and navigation taxonomy.
- Mark legacy/retired routes and remove them from normal discovery.
- Define the learner Study Loop event model.
- Establish the content floor for launch: subjects, languages, papers, and minimum validated lessons.
- Create a hard launch dashboard from `docs/LAUNCH_CHECKLIST.md`.

**Exit criteria:** a new learner can be shown one clear path from onboarding to first measurable improvement.

### Phase 1 — Experience spine (2–4 weeks)

- Recast `/dashboard` as **Today**.
- Add Next Action Card, study duration, rationale, and completion feedback.
- Simplify sidebar into intent groups.
- Standardise loading, empty, error, offline, and success states.
- Refactor shell-level network calls so navigation renders independently.
- Add Ditshego trust treatment to public, onboarding, institutional, and legal surfaces.

**Exit criteria:** task completion time and first-action rate improve in usability tests.

### Phase 2 — Assessment intelligence (3–6 weeks)

- Connect quiz/past-paper results to weakness concepts.
- Build targeted practice generation and retry state.
- Add transparent readiness model with evidence links.
- Ground assistant answers in module/curriculum context.
- Add study-session summary and revision capture.

**Exit criteria:** every incorrect answer produces a useful next recovery action.

### Phase 3 — Trust, access, and scale (parallel gate)

- Close message encryption and production key/config gaps.
- Complete consent, POPIA, payment, HSTS, and legal document fields.
- Prove pooled DB/Redis behavior and load targets.
- Complete Android/TWA safety and device validation.
- Run route-level accessibility and mobile regression suite.

**Exit criteria:** launch checklist moves from “mostly documented” to evidenced green for the web-first launch scope.

### Phase 4 — Role products (4–8 weeks)

- Learner mode: perfect the daily loop.
- Teacher/classroom mode: assignments, cohort insight, content distribution.
- Parent mode: consented, low-noise, outcome-oriented progress.
- Institution mode: adoption, usage, curriculum coverage, privacy controls.
- Tutor/community mode: verified quality and outcome contribution.

**Exit criteria:** each role has a distinct value proposition and does not inherit learner complexity by accident.

### Phase 5 — Category expansion

Only after the Study Loop is strong:

- Marketplace and bookstore expansion.
- Bursary/opportunity graph.
- Tutor marketplace depth.
- Institution SSO/LMS integrations.
- Public knowledge/SEO surfaces.
- Partner and Ditshego Ventures ecosystem surfaces.

---

## 11. Success metrics that matter

### North-star metric

**Verified Study Progress per Active Learner (VSPAL):** the number of meaningful concept improvements evidenced by a completed learning action plus a later assessment signal within a defined period.

Examples:

- A learner completes a lesson, then improves on a concept quiz.
- A learner reviews a past-paper misconception, then answers a targeted retry correctly.
- A learner uses the assistant to clarify a concept, then demonstrates retrieval later.

### Supporting metrics

- Time from login to first meaningful action.
- Percentage of sessions with a completed Next Action Card.
- Assessment-to-recovery completion rate.
- Week-2 and Week-4 learning retention.
- Readiness movement per learner, with confidence intervals.
- Content coverage and validation rate by subject/language/institution.
- AI grounded-answer helpfulness and correction rate.
- Lite-mode completion success on low-end devices.
- Accessibility issue rate on canonical learner journeys.
- Support tickets per 1,000 active learners.
- Revenue per learner only after trust and completion metrics are healthy.

Avoid treating raw logins, page views, game plays, wallet activity, or streak length as primary product success without connecting them to learning evidence.

---

## 12. First implementation backlog

### P0

- [ ] Create canonical learner journey map and route ownership table.
- [ ] Resolve message-body encryption at rest before broad minor-user launch.
- [ ] Close or explicitly scope every open item in `docs/LAUNCH_CHECKLIST.md`.
- [ ] Establish one production deploy source of truth and verify current branch provenance.
- [ ] Define and publish minimum trustworthy content coverage.
- [ ] Remove legacy learning/API paths from normal navigation and add redirects/telemetry.

### P1

- [ ] Reframe dashboard as Today / Next Action.
- [ ] Simplify sidebar and mobile navigation into intent-based groups.
- [ ] Create a shared `NextActionCard` component and action contract.
- [ ] Create a shared evidence/readiness model.
- [ ] Connect past-paper/quiz errors to targeted practice.
- [ ] Add grounded-source UI to assistant responses.
- [ ] Make Ditshego Ventures trust treatment visible beyond the footer.
- [ ] Add canonical empty/loading/error/offline state patterns.
- [ ] Add route-level axe/Lighthouse checks for the core learner loop.

### P2

- [ ] Introduce paper/annotation visual language as a restrained signature.
- [ ] Add session summaries and automatic revision capture.
- [ ] Add learner-facing weakness map.
- [ ] Add role-specific landing and onboarding variants.
- [ ] Add public SEO content surfaces for curriculum and past papers.
- [ ] Add partner/institution proof surfaces and Ditshego Ventures company story.

---

## 13. Final creative direction

Do not redesign SCHOOL into another polished dashboard.

Redesign it into **a place where uncertainty visibly turns into progress**.

The first screen should not ask:

> “Which of our many features would you like to open?”

It should answer:

> **“Here is what matters now, here is why, and here is the evidence that you are getting better.”**

Let the gold be the signal of agency. Let the onyx be the calm. Let the paper/editorial layer make learning feel authored and culturally grounded. Let cyan/mint indicate intelligence, freshness, and system guidance. Let Ditshego Ventures stand behind the trust architecture with confidence.

**SCHOOL can beat feature competitors by being more coherent, more local, more honest about evidence, and more beautiful in the moments that matter.**

---

## Appendix A — Immediate low-credit validation plan

1. Install dependencies once with the repository’s pinned lockfile.
2. Run the existing typecheck, focused tests, and web build; record failures without broad refactoring.
3. Start the web app with a safe non-production env fixture.
4. Capture screenshots at 375px, 768px, 1280px, and 1920px for `/`, `/onboarding`, `/dashboard`, `/learn`, `/past-papers`, `/assistant`, and `/messages`.
5. Run axe/Lighthouse only on those canonical routes.
6. Manually complete one learner journey: sign up → onboarding → Today → lesson → quiz → recovery → progress.
7. Turn the evidence into a small first PR: navigation + Today surface + shared states, not a full rewrite.

## Appendix B — Audit limitations

This is a repository-grounded strategic audit, not a claim of production conformance. Live behavior, authenticated flows, database state, device rendering, and competitor benchmarks still require validation. Recommendations are intentionally separated from verified observations so the next implementation phase can be evidence-led rather than speculative.
