# SCHOOL Canonical Learner Journey and Route Ownership

**Owner:** Ditshego Ventures / SCHOOL product engineering  
**Purpose:** keep the learner experience coherent while the platform continues to grow.

SCHOOL is a Learner Operating System, not a directory of features. The canonical loop is:

> **Know → Study → Prove → Recover → See the journey**

Every learner-facing route must belong to one of the intent groups below. New features should extend an existing group rather than create a competing top-level destination.

## Canonical navigation

| Intent group | User question | Canonical entry route | Route owner | Primary evidence/action |
|---|---|---|---|---|
| Today | What matters now? | `/dashboard` | Learner home / Today | Next action, readiness, institution compass |
| Learn | What do I need to understand? | `/learn` | Curriculum / Learn | Lesson, module, concept context |
| Practise | Can I retrieve it under pressure? | `/past-papers` | Assessment / Practise | Past paper, daily quiz, targeted practice |
| Community | Who or what can help me continue? | `/community` | Community / support | Questions, tutors, messages |
| Progress | Am I getting better? | `/dashboard/progress` | Evidence / Progress | Readiness, revision history, journey evidence |

The persistent primary action is **AI Tutor** at `/assistant`. It supports all five groups but does not replace the evidence loop.

## Study Loop ownership

| Loop stage | Canonical surfaces | Completion signal | Recovery hand-off |
|---|---|---|---|
| Know | `/learn`, `/learn/[phase]/[grade]/[subject]` | Learner opens a lesson and reaches a checkpoint | Lesson checkpoint or assistant clarification |
| Study | `/learn/.../week/[week]`, `/study` | Lesson/session completion captured | Revision artifact or planner task |
| Prove | `/past-papers`, `/daily-quiz`, `/learn/.../practice` | Assessment attempt recorded | Missed-question mapping |
| Recover | `/dashboard/weaknesses`, `/dashboard/revision`, `/planner` | Targeted retry or scheduled recovery completed | Progress evidence |
| See journey | `/dashboard/progress`, `/dashboard/revision` | Evidence timeline and readiness movement visible | Next action back to Today |

## Supporting route families

- `/assistant` — grounded AI support; source evidence must remain visible.
- `/planner` — execution layer for scheduled recovery and study tasks.
- `/dashboard/weaknesses` — concept-level weakness map and targeted retry entry.
- `/dashboard/revision` and `/dashboard/revision/[id]` — durable learning artifacts and revision history.
- `/messages`, `/tutors`, and `/community/*` — support and peer surfaces owned by Community, not primary study navigation.
- `/profile/learning` — learner preferences and academic context; it is not a replacement for Progress.

## Legacy and retired paths

| Legacy family | Policy | Replacement |
|---|---|---|
| `/phase/*` and `/phases/*` | Redirect; do not add new links | `/learn/...` |
| `/classes` and `/classes/*` | Redirect where safe | `/past-papers` |
| `/university/modules/ekrp211` | Redirect | `/learn/ekrp211` |
| `/api/v2/lesson*` and `/api/v2/lessons` | Retired response; do not revive | Canonical `/learn/.../week/...` file route |
| `/api/admin/v2/*` lesson generation | Retired response; do not revive | Lesson v1 generation pipeline |
| `/study/new` | Redirect | `/study` |
| `/login`, `/signup`, `/auth/signup` | Compatibility redirects | `/auth` |

Legacy routes may remain for bookmarks and inbound links, but they must not appear in learner navigation, sitemap, marketing copy, or new feature acceptance criteria.

## Change contract

A new learner-facing capability must declare:

1. its intent group and owning route family;
2. its canonical entry route and replacement for any legacy path;
3. its completion/evidence signal;
4. loading, empty, error, offline, and accessibility states;
5. its mobile parity or an explicit reason for web-only scope;
6. its analytics event and rollback/retirement plan.

This map is the product boundary for the Scholar’s Command Centre and keeps Ditshego Ventures’ platform investment focused on verified study progress rather than feature volume.
