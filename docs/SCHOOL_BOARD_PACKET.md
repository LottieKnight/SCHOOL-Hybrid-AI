# SCHOOL Board Packet

## Executive View

SCHOOL is no longer a web-only prototype. It is now a multi-surface education platform with:

- a hardened web app
- a live mobile app
- canonical learner routes
- live content wiring
- launch operations and load testing in place

The work completed so far is enough to move from feature development into launch-proofing. The next step is not more broad feature sprawl. It is proving that the system holds together under real traffic, on real devices, with one clear learner journey.

---

## What We Delivered

### Platform stability

- Redis-backed session caching
- per-user AI throttling
- cached leaderboard and growth reads
- pooled DB connection priority corrected
- launch gate checklist and ops runbook
- repo-level load-test harness

### Canonical learner path

- EKRP 211 normalized to `/learn/ekrp211`
- duplicate study entrypoints reduced
- mobile module and lesson views wired to live web content

### Mobile product surface

- auth and five-tab shell
- Home XP strip
- live module overview and chapter reader
- flashcards
- daily quiz upgrade
- celebration overlay
- settings
- wallet
- past papers browser and in-app viewer
- onboarding completion

---

## Current Position

### Strong points

- The platform has a real content and navigation model.
- The mobile app is wired to production APIs instead of local mocks.
- The learner journey is mostly coherent across web and mobile.
- The repo now has operational discipline: runbooks, load tests, and clear launch gates.

### Remaining risk

- Scale is not yet proven with a full production-like load test.
- Android smoke validation still needs a device-capable host or physical device.
- Some mobile and web surfaces still need polish and consistency work.
- Redis and DB pool behavior must be observed under real traffic before broad rollout.

---

## What This Means

SCHOOL is at the point where the question is no longer, "Can we build it?"

The question is:

- Does it stay reliable when usage spikes?
- Does the learner see one canonical experience?
- Are content surfaces accurate and discoverable?
- Can we support growth without fragmenting the product?

The answer is: mostly yes in code, not yet fully proven in production.

---

## Top Risks

1. Load and reliability are not yet fully evidenced.
2. Android validation is not complete on this host.
3. Redis and DB pool pressure could still surface at scale.
4. Mobile parity is good for the core study loop, but not complete for every secondary flow.
5. Content coverage needs to remain trustworthy as the module library grows.

---

## Next Best Moves

### 1. Prove scale

- Run the staging and production smoke load tests.
- Confirm p95 latency, error rate, and pool behavior.
- Validate AI throttling under realistic traffic.

### 2. Finish device validation

- Run Android smoke on a device-capable machine or physical device.
- Verify onboarding, past papers, wallet, settings, and the Home XP strip.
- Keep the mobile surface one-handed and fast.

### 3. Lock the content model

- Keep the learner journey canonical.
- Avoid duplicate module surfaces unless they serve clearly different purposes.
- Maintain live lesson availability signals.

### 4. Tighten release discipline

- Split changes into clean reviewable bundles.
- Maintain rollback paths.
- Keep platform, mobile, and content workstreams separable.

---

## Roadmap

### Phase 1: Launch stabilization

- Production load test evidence
- Redis and DB monitoring
- Alerting and dashboards
- Final route cleanup

### Phase 2: Mobile maturity

- Push notifications
- Offline caching
- Assistant polish
- More complete community flows

### Phase 3: Study depth

- Better streak and progress surfaces
- Expanded quiz loops
- Smarter recommendations
- Stronger analytics

### Phase 4: Growth readiness

- Credits and wallet refinement
- Lifecycle messaging
- Better retention loops
- Clear internal reporting

### Phase 5: Platform maturity

- Observability dashboards
- Content moderation tools
- Admin/editor improvements
- Shared schema consolidation

---

## Board Ask

- Approve the current release focus on scale validation and mobile completion.
- Treat load testing and Android smoke as release gates, not optional checks.
- Keep the canonical learner route model intact.
- Fund the next phase of observability and content coverage.

---

## Bottom Line

SCHOOL is ready for disciplined launch work.

It is not ready for a carefree wide rollout until:

- load is proven,
- Android is validated,
- and the content/route model remains clean.

If we stay focused on those three things, SCHOOL can move from "working product" to "stable learning platform."
