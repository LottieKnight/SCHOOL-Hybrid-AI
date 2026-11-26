# Phase 4 learning sessions and revision artifacts

## Design intent

Phase 4 separates a learning event from the durable learner-owned artifact produced by that event.

- `LearningSession` is the event envelope: a lesson, quiz, past-paper attempt, targeted retry, AI coaching session, or tutor session.
- `RevisionArtifact` is the saved output a learner can revisit, share with an authorized tutor, or attach to a planner item.

Both records are user-scoped. Source references remain polymorphic (`sourceType` + `sourceId`) so the model can cover existing systems without forcing every feature into one database relation.

## Proposed tables

### `LearningSession`

| Column | Purpose |
|---|---|
| `id` | Stable session identifier |
| `userId` | Owner and access-control boundary |
| `kind` | `lesson`, `quiz`, `past_paper`, `targeted_retry`, `assistant`, or `tutor` |
| `status` | `started`, `completed`, `abandoned`, or `needs_review` |
| `title` | Human-readable session title |
| `subject`, `grade` | Queryable academic context |
| `sourceType`, `sourceId` | Source object, such as `past_paper_attempt` + attempt ID |
| `summaryJson` | Versioned machine-readable summary payload |
| `startedAt`, `completedAt` | Session timing |
| timestamps | Audit and ordering |

### `RevisionArtifact`

| Column | Purpose |
|---|---|
| `id` | Stable artifact identifier |
| `userId` | Owner and access-control boundary |
| `sessionId` | Optional parent learning session |
| `artifactType` | `session_summary`, `recovery_result`, `revision_note`, or future types |
| `title` | Learner-facing artifact title |
| `body` | Plain text or sanitized rich-text body |
| `sourceType`, `sourceId` | Original evidence reference |
| `evidenceJson` | Before/after scores, concepts, source labels, and confidence |
| `status` | `saved`, `archived`, or `deleted` |
| timestamps | Audit and revision ordering |

## Access and privacy rules

1. Every read is scoped by `userId` unless the caller has an explicit tutor or institution relationship.
2. Tutor access must be relationship-based and auditable; an artifact ID alone is never sufficient authorization.
3. Institution reporting must use aggregate queries and minimum cohort thresholds rather than exposing raw learner artifacts.
4. `summaryJson` and `evidenceJson` must not contain unnecessary personal information or private messages.
5. Retention follows the learning-data policy; deleting an account must cascade or anonymize owned sessions and artifacts.

## Migration

`apps/web/prisma/migrations/phase4_learning_artifacts.sql` creates the SQLite tables and indexes used by the web data layer. The Prisma models are also present in `apps/web/prisma/schema.prisma` so generated types stay aligned as persistence endpoints are added.

## Rollout sequence

1. Create a `LearningSession` when a meaningful session starts or completes.
2. Write a `SessionSummary` payload on completion.
3. Offer `RevisionArtifact` creation from the summary/result card.
4. Add list and detail endpoints scoped to the authenticated learner.
5. Add tutor and institution access only after relationship and aggregate-policy tests exist.
6. Backfill past-paper and retry attempts incrementally; do not block existing attempt records.
