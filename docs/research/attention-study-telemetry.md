# Attention-Study Telemetry — Data & Event Model

**Owner:** AURA AI Laboratory · **Platform:** SCHOOL (Game Center)
**Study #1:** "Observational Silence" — selective attention & inattentional blindness
**Paradigm:** Simons & Chabris (1999), *Gorillas in our midst*; the *Monkey Business Illusion* (2010)

This document describes the telemetry schema added in migration
`082_research_attention_study.sql`, the API that ingests it, and how it maps to
the research constructs. It is written to double as the data-management section
of an NWU Research Ethics Committee (REC) protocol.

> **Gate before any real data:** REC clearance + a supervisor of record, a
> POPIA-compliant consent flow, and an **original** stimulus (do not reuse
> Simons' copyrighted video). This schema enforces consent and withdrawal; it
> does not grant ethics approval.

---

## 1. Design goals

1. **Study-agnostic.** A `research_studies` registry means study #2 reuses the
   same pipeline — this is the research flywheel, not a one-off table.
2. **POPIA by construction.** Consent is study-scoped, versioned and revocable;
   telemetry is keyed to a pseudonymous `participant_ref`; `user_id` is
   `ON DELETE SET NULL` and cleared by the existing anonymisation cron
   (migration `077`). No raw IP or full user-agent is stored.
3. **Minors handled, not ignored.** Enrolment reuses `users.is_minor`,
   `users.parental_consent_given_at`, `users.parent_email` (migrations 073/078).
   Adult-only studies (`min_age >= 18`) reject minors; otherwise a recorded
   guardian consent is required first.
4. **A real experiment clock.** Reaction time and noticing latency are derived
   from millisecond offsets in an append-only event stream, never from
   wall-clock differences.

---

## 2. Tables

| Table | Grain | Captures |
|---|---|---|
| `research_studies` | one row per study | registry, ethics ref, PI, consent/stimulus versions, age gate, config |
| `research_consents` | one per participant × study (active) | consent flag + **version**, scope, minor/guardian state, **withdrawal**, salted IP hash |
| `research_sessions` | one play-through | condition, stimulus version, **reported vs actual pass count** (+ generated `pass_count_error`), **device**, quality flags, status, **timestamps** |
| `research_trial_events` | one per event | the experiment-clock stream: `event_type`, `event_time_ms`, payload |
| `research_noticing_outcomes` | one per critical event × session | **`noticed` bool + `notice_latency_ms`** + confidence (the inattentional-blindness measure) |
| `research_recall_responses` | one per probe × session | post-trial **memory** answers, optional correctness/score |

Every child table carries a denormalised `study_id` so exports and analytics
never need to walk back up through sessions.

---

## 3. Construct → metric mapping

| Construct (your words) | Established construct | Where it lives |
|---|---|---|
| Attention | Selective attention | `research_sessions.pass_count_error` |
| Directed attention | Sustained attention / control | accuracy stability + `focus_lost`/`focus_gained` events |
| Reaction time | Processing speed | `probe_response.event_time_ms − probe_shown.event_time_ms` |
| Focus | Engagement under load | `quality_flags` + probe RT variance |
| Memory | Incidental recall | `research_recall_responses` |
| **Observational silence** | **Inattentional blindness** | `research_noticing_outcomes.noticed` + `notice_latency_ms` + `confidence` |

> Define *observational silence* operationally in the protocol, e.g.: "a
> measurable state in which a fully visible critical stimulus fails to enter
> reportable awareness while attention is committed elsewhere, indexed by
> noticing rate, confidence, and incidental recall." That ties your coinage to a
> replicated phenomenon so reviewers accept it.

---

## 4. A session timeline (the event stream)

```
seq  event_type          event_time_ms   meaning
0    stimulus_onset       0               clip starts — t0 for the clock
1    pass_tally_changed   2310            participant counted a pass
2    anomaly_onset        8000            the gorilla enters
3    notice_flagged       9450            participant flags "I saw something"  → latency = 1450 ms
4    anomaly_offset       12000           the gorilla leaves
5    probe_shown          15000           RT probe appears
6    probe_response       15380           responded                            → RT = 380 ms
7    stimulus_offset      30000           clip ends
```

After the clip, the client posts the summary measures:
- `POST /noticing` → `{ criticalEventKey: "gorilla", noticed: true, noticeLatencyMs: 1450, confidence: 4 }`
- `POST /recall`   → `{ promptKey: "shirt_colour_of_gorilla", responseValue: "black", isCorrect: true }`
- `POST /complete` → `{ reportedPassCount: 15, actualPassCount: 16 }` (server stores `pass_count_error = 1`)

The client computes latencies from its own monotonic clock and the server
stores them; the raw event stream lets you **recompute or audit** every derived
value later.

---

## 5. API (all under the existing Fastify app)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /research/:studyCode/consent` | user | Grant/confirm consent (enforces age + guardian gate) |
| `POST /research/consent/:consentId/withdraw` | user | Withdraw; halts in-progress sessions |
| `POST /research/:studyCode/sessions` | user | Start a play-through (requires active consent) |
| `POST /research/sessions/:id/events` | user | Batched trial events (idempotent on `seq`) |
| `POST /research/sessions/:id/noticing` | user | Record a noticing outcome |
| `POST /research/sessions/:id/recall` | user | Record a recall response |
| `POST /research/sessions/:id/complete` | user | Finalise with pass counts |
| `GET  /admin/research/:studyCode/export` | admin | De-identified analysis rows (no `user_id`/email) |

Event names and payload shapes are the single source of truth in
`@saedu/shared` → `research/attention-study.ts`, imported by both the API
(Zod validation) and the game client.

---

## 6. Seeding study #1

```sql
INSERT INTO research_studies (code, title, principal_investigator, ethics_ref,
                              status, min_age, current_consent_version, current_stimulus_version)
VALUES ('observational-silence-v1',
        'Observational Silence: selective attention & inattentional blindness',
        'Mondli Manzi (NWU Psychology)',
        'NWU-REC-XXXX-XXX',          -- fill in after clearance
        'recruiting', 18, 'v1', 'v1');
```

Set `status = 'recruiting'` only once REC clearance and the consent copy are in.

---

## 7. Example analysis queries

```sql
-- Inattentional-blindness rate for the gorilla (the headline number)
SELECT AVG((NOT noticed)::int)::numeric(4,3) AS blindness_rate
FROM research_noticing_outcomes n
JOIN research_sessions s ON s.id = n.session_id
WHERE s.study_id = $1 AND s.is_practice = FALSE AND n.critical_event_key = 'gorilla';

-- Does engagement (low pass-count error) predict blindness?
SELECT s.pass_count_error, AVG((NOT n.noticed)::int)::numeric(4,3) AS blindness_rate
FROM research_sessions s
JOIN research_noticing_outcomes n ON n.session_id = s.id AND n.critical_event_key = 'gorilla'
WHERE s.study_id = $1 AND s.is_practice = FALSE
GROUP BY s.pass_count_error ORDER BY s.pass_count_error;
```

---

## 8. What the client must emit (web / mobile)

- Use a **monotonic clock** (`performance.now()`) for `event_time_ms`, anchored
  at `stimulus_onset`.
- **Batch** events (e.g. flush every ~2 s or 50 events) to `/events`; `seq` makes
  retries safe.
- Emit `focus_lost` / `focus_gained` on `visibilitychange` — these become
  `quality_flags` and let you exclude distracted runs.
- Send only the coarse `device` context; never the full user-agent string.

---

## 9. Open items before launch

- [ ] REC protocol + supervisor sign-off (NWU); put the clearance no. in `ethics_ref`.
- [ ] POPIA consent + minor-assent copy; store the agreed scope in `consent_scope`.
- [ ] Original stimulus (avoid Simons' copyrighted clip); version it as `stimulus_version`.
- [ ] Add a secret salt (config/env) to `participantRef`/`hashIp` so refs aren't guessable.
- [ ] Pre-register hypotheses on OSF before opening `status = 'recruiting'`.
- [ ] Rebuild `@saedu/shared` (it now exports the event vocabulary) so the API and clients resolve the new types.
```
