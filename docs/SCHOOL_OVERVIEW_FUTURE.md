# SCHOOL Overview and Future Roadmap

## Executive Summary

SCHOOL has moved from a desktop-first web platform into a multi-surface education system with:

- a hardened web app
- a live mobile app for iPhone and Android
- shared module/content routes
- a growing set of study, practice, community, wallet, and onboarding flows

The current state is good enough to support launch hardening and iterative expansion, but it is not a finished product. The next phase is about proving reliability under real traffic, tightening mobile parity, and keeping the content model clean enough that learners see one coherent SCHOOL experience instead of multiple competing paths.

## What We Completed

### Web platform hardening

- Redis-backed session caching was added for user lookups.
- AI routes were rate limited per user.
- Leaderboard and growth reads were cached.
- The pooled database path was corrected to prefer the Supabase pooler.
- A launch gate checklist and operating runbook were added.
- A repo-level load-test harness was added and documented.

### Canonical learner surfaces

- EKRP 211 was normalized to a single canonical learner route at `/learn/ekrp211`.
- Duplicate learner entrypoints were reduced so the study surface is easier to reason about.
- The mobile app now pulls live module data and live lesson detail from the web side.

### Mobile app foundation

- The Expo mobile app now exists as a real product surface.
- Auth works through SecureStore-backed bearer tokens.
- The five-tab shell renders on iPhone-class devices.
- The Home screen now includes a live XP strip.
- The Learn tab, module overview, and chapter reader are live.
- Flashcards, daily quiz, celebration overlay, settings, wallet, past papers browser, and onboarding completion were added.

### Mobile-to-web integration

- Mobile now uses live module routes instead of a local seed catalog.
- The chapter reader can fetch deeper lesson detail from the live lesson route.
- The module cards can show live lesson availability.
- The wallet, profile, locale, onboarding, XP, and past paper surfaces are now tied to real backend routes.

## What Is Strong Right Now

- The content architecture is no longer a toy prototype.
- The mobile app is not a visual mock; it is wired to real APIs and real content.
- The platform has moved from “feature work” into “launch proofing.”
- The repo now has operational documentation for load testing and launch gating.

## Disclaimers and Assumptions

- This is a living platform, not a frozen release.
- A successful typecheck does not equal production readiness.
- Some checks still depend on real infrastructure:
  - staging or production load testing
  - Redis quota and reliability
  - production DB pool behavior
  - Android smoke on a device-capable host or physical device
- The mobile app is currently strongest on iPhone-class devices; Android validation still needs device-grade confirmation.
- Some routes are intentionally split between web and mobile because the web remains the source of truth for content and identity flows.
- The roadmap below assumes the current auth and content architecture remains stable.

## Near-Term Priorities

### 1. Prove scale

- Run the load-test harness against staging and production smoke paths.
- Confirm the 1,500-user assumption with measured p95 and error rates.
- Watch for DB pool saturation, Redis errors, and AI throttling behavior.

### 2. Finish mobile validation

- Complete a real-device Android smoke test.
- Verify the onboarding, wallet, settings, past papers, and Home XP strip flows end to end.
- Keep the mobile shell visually consistent and one-handed friendly.

### 3. Clean up release boundaries

- Split launch hardening, mobile work, and content-route work into reviewable commit groups or PRs.
- Keep the canonical learner route model tight.
- Avoid duplicate surfaces unless they are intentionally distinct.

### 4. Keep content trustworthy

- Ensure live lesson availability badges remain accurate.
- Make the fallback behavior explicit when lesson detail is missing.
- Keep the content source of truth centralized.

## Future Roadmap

### Phase 1: Launch stabilization

- Production load test evidence
- Redis and DB pool monitoring
- Error budget and alerting discipline
- Final route and navigation cleanup

### Phase 2: Mobile parity

- Push notifications
- Offline cache for recent modules
- Richer assistant overlay
- Deeper community flow polish
- More complete onboarding personalization

### Phase 3: Study performance

- Better progress and streak surfaces
- Expanded daily challenge variations
- Smarter recommendation surfaces
- Stronger quiz analytics and feedback loops

### Phase 4: Monetization and retention

- Wallet and credits refinement
- Subscription or bundle strategy if needed
- Purchase flows where appropriate
- Lifecycle messaging tied to student behavior

### Phase 5: Platform maturity

- Observability dashboards
- Content moderation tooling
- Editor and admin improvements
- Better shared schemas across web, API, and mobile

## Suggested Additions I Would Make Next

- A single release readiness dashboard with launch gates and owners.
- A mobile device smoke checklist that is separate from web load testing.
- A content coverage report for live lesson availability across core modules.
- A “what changed this week” changelog for internal stakeholders.
- A clear rollback matrix for DB, Redis, AI, and mobile deployments.

## Bottom Line

SCHOOL is past the concept stage. The core work now is to:

1. prove the platform under load,
2. keep the mobile experience coherent,
3. preserve a single canonical learner journey,
4. and keep the content and operational story legible as the product grows.

If the next phase is executed cleanly, SCHOOL can move from “working product” to “stable learning platform.”
