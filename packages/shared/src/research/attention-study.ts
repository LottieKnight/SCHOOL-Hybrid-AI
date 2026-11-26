/**
 * Canonical vocabulary for the AURA Laboratory attention-study telemetry.
 *
 * Shared across web (the game client), mobile, and the API so every surface
 * emits and validates the *same* event names. Treat this file as the contract:
 * if you add an event type, add it here first.
 *
 * Background paradigm: selective-attention / inattentional-blindness
 * (Simons & Chabris, 1999; the "Monkey Business Illusion", 2010).
 * See docs/research/attention-study-telemetry.md for the full model.
 */

/** A single play-through of the game moves through these lifecycle states. */
export const RESEARCH_SESSION_STATUSES = [
  "in_progress",
  "completed",
  "abandoned",
  "withdrawn",
] as const;
export type ResearchSessionStatus = (typeof RESEARCH_SESSION_STATUSES)[number];

/**
 * Fine-grained events logged on the *experiment clock* (milliseconds from
 * `stimulus_onset`). This stream is the heart of the model: reaction time and
 * inattentional-blindness latency are derived from the gaps between these
 * timestamps, never from wall-clock differences.
 */
export const RESEARCH_TRIAL_EVENT_TYPES = [
  "stimulus_onset", // the clip starts — t0 for the experiment clock
  "stimulus_offset", // the clip ends
  "probe_shown", // a reaction-time probe is presented
  "probe_response", // participant responded to a probe (payload carries rt_ms)
  "anomaly_onset", // the unexpected event appears (e.g. the gorilla)
  "anomaly_offset", // the unexpected event leaves the scene
  "notice_flagged", // participant signalled they saw something unexpected
  "attention_check", // catch trial / engagement check
  "pass_tally_changed", // participant updated their running pass count
  "focus_lost", // tab/window blur — a data-quality signal
  "focus_gained", // tab/window focus returned
  "pause",
  "resume",
] as const;
export type ResearchTrialEventType = (typeof RESEARCH_TRIAL_EVENT_TYPES)[number];

/**
 * Keys for the critical (unexpected) events whose noticing we measure.
 * These are the "Observational Silence v1" original-stimulus events — an
 * abstract animation, not Simons' copyrighted footage. See
 * docs/research/stimulus-observational-silence-v1.md.
 */
export const DEFAULT_CRITICAL_EVENT_KEYS = [
  "intruder", // the unexpected magenta shape crossing the field
  "backdrop_shift", // the gradual background colour change
  "agent_exit", // a distractor agent leaves the scene
] as const;

/** Coarse, PII-minimised description of the playback environment. */
export interface ResearchDeviceContext {
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  inputType?: "mouse" | "touch" | "keyboard" | "unknown";
  refreshRateHz?: number;
  /** Coarse browser family only — e.g. "Chrome". Never the full UA string. */
  uaFamily?: string;
  platform?: "web" | "ios" | "android";
  prefersReducedMotion?: boolean;
}

/** One entry in a batched trial-event upload. */
export interface ResearchTrialEventInput {
  /** Monotonically increasing within a session; used for idempotent retries. */
  seq: number;
  eventType: ResearchTrialEventType;
  /** Milliseconds from `stimulus_onset` (the experiment clock). */
  eventTimeMs: number;
  /** ISO wall-clock timestamp, best-effort. */
  clientTs?: string;
  payload?: Record<string, unknown>;
}

/** The headline inattentional-blindness outcome for one critical event. */
export interface ResearchNoticingOutcomeInput {
  criticalEventKey: string;
  noticed: boolean;
  /** notice_flagged − anomaly_onset, in ms. Null if never noticed. */
  noticeLatencyMs?: number | null;
  /** Subjective confidence, 1–5. */
  confidence?: number | null;
  freeText?: string | null;
}

/** A single post-trial memory / recall probe response. */
export interface ResearchRecallResponseInput {
  promptKey: string;
  responseValue: unknown;
  isCorrect?: boolean | null;
  score?: number | null;
}
