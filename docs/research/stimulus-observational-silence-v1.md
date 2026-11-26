# Stimulus Spec — "Observational Silence v1"

**Study:** Observational Silence (AURA Laboratory × Mondli Manzi, NWU)
**Paradigm:** sustained inattentional blindness (Simons & Chabris, 1999; *Monkey Business Illusion*, 2010)
**Stimulus type:** deterministic rendered animation (web `<canvas>` + React Native Skia) — **not** filmed video
**Version key:** `stimulus_version = 'v1'` (see migration `082`)

---

## 0. Why rendered, and why it's copyright-clean

The inattentional-blindness *method* — give a demanding selective-attention task,
introduce a fully-visible unexpected event, measure who misses it — is an idea, and
**ideas/methods are not copyrightable**. What *is* copyrighted is Simons' specific
**video recording**: those actors, that choreography, the gorilla-suit footage. So
we do not reuse or imitate his footage; we build an original animation with abstract
agents. This is standard practice and, as a bonus, a rendered stimulus gives us:

- **Frame-accurate timing** — `anomaly_onset`/`anomaly_offset` are emitted by the
  renderer at exact milliseconds, so `notice_latency_ms` is clean, not video-scrubbed.
- **Ground-truth pass count** — the renderer *knows* the true count, so
  `actual_pass_count` needs no human coding.
- **Counterbalancing for free** — target colour, intruder properties, path and pace
  are parameters → experimental conditions (`research_sessions.condition`).
- **Original by construction** — procedurally drawn shapes, generic colours, zero
  resemblance to any filmed work.
- **One spec, two platforms** — same parameters drive web and mobile.

---

## 1. Scene & agents

- **6 agents** ("orbs"), soft filled circles: **3 teal** (target team) + **3 amber**
  (distractor team). Abstract and neutral — no faces, no figures.
- **2 tokens** (small pale dots): a teal-team token and an amber-team token. A token
  is only ever passed **between same-colour agents**, exactly mirroring the two-ball,
  two-team structure of the original.
- **Backdrop:** neutral dark field with a soft vignette; one scripted hue shift late
  in the trial (a second critical event).

## 2. Primary task

> "Count the number of times the **teal** orbs pass their token to each other.
> Ignore the amber orbs."

Participants **count silently and report at the end** (no live tapping in the naive
block — tapping would change the attentional task). The renderer holds the
ground-truth count.

## 3. Default timeline (26 s)

| t (s) | Scripted moment | Telemetry emitted | `critical_event_key` |
|---|---|---|---|
| 0.0 | Animation begins | `stimulus_onset` | — |
| 0–26 | Passes ~every 1.4 s, alternating teams (~15 teal passes) | internal true count | — |
| 8.0 | Intruder (magenta 4-point "kite") enters from the right | `anomaly_onset` | `intruder` |
| 10.0 | Intruder reaches centre, gentle pulse + slow rotate | — | `intruder` |
| 12.5 | Intruder begins exit | — | `intruder` |
| 14.0 | Intruder fully off-screen (on screen ~6 s, crosses central third) | `anomaly_offset` | `intruder` |
| 18.0 | Backdrop hue begins shifting (e.g. cool → warm) | `anomaly_onset` | `backdrop_shift` |
| 19.5 | Backdrop shift complete | `anomaly_offset` | `backdrop_shift` |
| 21.0 | One **amber** agent quietly leaves the field | `anomaly_onset` | `agent_exit` |
| 26.0 | Animation ends → post-trial funnel | `stimulus_offset` | — |

Tunable in `research_studies.config`; timings above are v1 defaults.

## 4. Critical events

Three measurable unexpected events per trial, each a row in
`research_noticing_outcomes`:

| `critical_event_key` | What it is | Tests |
|---|---|---|
| `intruder` | unexpected magenta shape crossing centre | classic inattentional blindness |
| `backdrop_shift` | gradual background colour change | change blindness for gradual change |
| `agent_exit` | a distractor agent disappears | the *Monkey Business* "second change" effect |

> These three keys replace the placeholder `gorilla` / `curtain_color_change` /
> `player_exit` examples — update `DEFAULT_CRITICAL_EVENT_KEYS` in
> `@saedu/shared` to match.

## 5. Naive vs informed blocks — where `notice_latency_ms` comes from

The classic IB measure requires the participant **not** be told to watch for anything
(otherwise it isn't inattentional). So:

- **Block A — naive (run first, once per participant):** no notice prompt during the
  trial. After it ends, the post-trial funnel yields `noticed` (true/false);
  `notice_latency_ms` is **null** here by design. This is the gold-standard measure.
- **Block B — informed (optional second block):** the participant is now told an
  intruder may appear and presses **SPACE** when they see it →
  `notice_flagged` event → `notice_latency_ms = notice_flagged − anomaly_onset`.
  This mirrors *Monkey Business*: "now that you know about one change, do you catch
  the others?" Run new critical-event variants here so awareness of the intruder
  doesn't trivialise the block.

The schema supports both: `notice_latency_ms` is nullable.

## 6. Post-trial funnel (Simons procedure) → telemetry

Ask in this order, branching as shown. Map each answer to telemetry:

1. "How many teal passes did you count?" → `reported_pass_count` (on `/complete`)
2. "While counting, did you notice anything unusual?" (Y/N) → `intruder.noticed`
3. *(if No)* "Did you notice anything other than the orbs passing?" (Y/N)
4. *(if still No)* "Did you see a shape that wasn't an orb?" (Y/N) — the leading,
   last-resort question Simons used; a "No" here is a strong IB case
5. "How confident are you?" (1–5) → `intruder.confidence`
6. Recall probes (memory) → `research_recall_responses`:
   - "What colour was the background at the **end**?" → `backdrop_shift` recall
   - "Did all the orbs that started also finish?" → `agent_exit` recall
   - "If you saw an extra shape, what colour/shape was it?" → `intruder` recall detail

## 7. Conditions & counterbalancing (`research_sessions.condition`)

| Parameter | Levels | Why |
|---|---|---|
| `target_color` | teal · amber | control for colour-specific salience |
| `intruder_set_match` | target-matched · distractor-matched | replicates the white/black **attentional-set** effect (noticing rises when the intruder shares the attended colour) |
| `intruder_path` | central · peripheral | salience / eccentricity |
| `pace` | standard · fast | attentional load |

Assign randomly at enrolment; store the chosen cell in `condition` and the full
parameter set in the session's effective config.

## 8. Event-emission contract (renderer → API)

The renderer is the source of truth for the experiment clock. Anchor `t0` at
`stimulus_onset` using `performance.now()`; every event's `event_time_ms` is
`Math.round(now − t0)`.

| Scripted moment | `event_type` | payload |
|---|---|---|
| trial start | `stimulus_onset` | `{ stimulusVersion }` |
| each critical event start | `anomaly_onset` | `{ criticalEventKey }` |
| each critical event end | `anomaly_offset` | `{ criticalEventKey }` |
| RT probe shown (optional, §9) | `probe_shown` | `{ probeId }` |
| RT probe answered | `probe_response` | `{ probeId, rtMs, correct }` |
| participant flags intruder (Block B) | `notice_flagged` | `{ criticalEventKey }` |
| tab blur / focus | `focus_lost` / `focus_gained` | `{}` |
| trial end | `stimulus_offset` | `{}` |

Batch these to `POST /research/sessions/:id/events` (idempotent on `seq`). Internal
pass events stay client-side; only the final `actual_pass_count` is sent on
`/complete`.

## 9. Reaction-time probe channel (optional)

To measure processing speed **without** revealing the intruder: at a few scheduled
moments (kept clear of the 8–14 s intruder window), briefly outline a teal orb;
the participant presses a key as fast as possible. `rt_ms = probe_response −
probe_shown`. This gives a clean RT measure orthogonal to the noticing task.

## 10. Accessibility & data quality

- Capture `prefersReducedMotion` in `device`. Motion is intrinsic to IB, so the
  recommended default is to **exclude** reduced-motion sessions from the primary
  analysis (or treat as a flagged sensitivity condition) rather than serve a static
  variant that breaks the paradigm.
- Pause and emit `focus_lost` on `visibilitychange`; resume cleanly.
- Record a `clock_drift_ms` quality flag (compare `performance.now()` elapsed vs the
  number of animation frames) to catch throttled/background tabs.
- Enforce a minimum viewport so the central third is large enough to be unmissable
  *if attended*.

## 11. Originality checklist (attach to the REC protocol)

- [x] All shapes procedurally drawn in code — no third-party sprites or footage.
- [x] Generic colours; abstract orbs; no human figures, no animal, no gorilla.
- [x] Choreography authored from scratch (see `stimulus-prototype.html`).
- [x] No audio sampled from external sources.
- [x] Versioned as `stimulus_version = 'v1'`; any change bumps the version.

## 12. Reference parameters (drop into `research_studies.config`)

```json
{
  "stimulusVersion": "v1",
  "durationMs": 26000,
  "agents": { "targetColor": "teal", "targetCount": 3, "distractorCount": 3 },
  "passSchedule": { "intervalMs": 1400, "jitterMs": 250, "passDurationMs": 600 },
  "criticalEvents": [
    { "key": "intruder",       "onsetMs": 8000,  "offsetMs": 14000,
      "path": "central", "setMatch": "distractor" },
    { "key": "backdrop_shift", "onsetMs": 18000, "offsetMs": 19500 },
    { "key": "agent_exit",     "onsetMs": 21000, "offsetMs": 21000, "team": "amber" }
  ],
  "rtProbes": { "enabled": false, "windowsMs": [4000, 16000, 23000] },
  "blocks": ["naive", "informed"]
}
```

A working reference renderer (trajectories, timing, the funnel) lives alongside this
spec at `stimulus-prototype.html` — open it in a browser to see v1 run.

## 13. Design decisions (creative hand-off, applied)

Implemented in `apps/web/.../observational-silence/` and the stimulus engine.

- **Identity — "The Observatory":** navy + gold ("amapiano old-money"), Cormorant
  Garamond display + Geist body, an `○ ◇ ○` mark (observer → event → observation).
  Chrome is deliberately decoupled from the stimulus hues so brand gold/amber never
  competes with the in-field amber group.
- **Intruder is a condition, not a fixed colour.** Geometry/timing are identical
  across arms; only the hue changes (`INTRUDER_CONDITIONS`):
  - `magenta` — neutral/distinct baseline
  - `teal_matched` — matches the *attended* group (set-match → higher noticing; also a
    *camouflage* interpretation to pre-register)
  - `amber_matched` — matches the *ignored* group
  Assigned randomly at enrolment, recorded as `condition = naive_<arm>`.
- **Salience is a config object** (`sizeMult`, `rotationMult`, `opacity`), baseline
  locked. Do **not** raise size/opacity without re-validating the ~50% miss rate.
- **Graded funnel with level recording.** Screens escalate (unusual? → other than
  orbs? → a non-orb shape?); `noticed` plus the `level` (2 = spontaneous … 4 =
  prompted) are stored in the noticing record's free-text, so analysis can separate
  spontaneous from prompted noticing. Confidence is 1–5 (matches the DB CHECK).
- **Recall keys:** `background_colour_end`, `all_orbs_finished`, `intruder_colour`,
  `intruder_shape`.
- **`trial_render_quality`** (avgFps, droppedFrames, frameCount, clockDriftMs) +
  `deviceTier` are captured by the engine and written to
  `research_sessions.quality_flags`, so trials rendered on struggling devices can be
  flagged in analysis rather than silently contaminating timing data.
- **Ndebele/SA motifs are chrome-only** (consent, instructions, debrief) — never
  inside the trial field, where extra motion would compete with the intruder.
