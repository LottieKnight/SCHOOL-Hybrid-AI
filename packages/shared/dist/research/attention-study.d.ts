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
export declare const RESEARCH_SESSION_STATUSES: readonly ["in_progress", "completed", "abandoned", "withdrawn"];
export type ResearchSessionStatus = (typeof RESEARCH_SESSION_STATUSES)[number];
/**
 * Fine-grained events logged on the *experiment clock* (milliseconds from
 * `stimulus_onset`). This stream is the heart of the model: reaction time and
 * inattentional-blindness latency are derived from the gaps between these
 * timestamps, never from wall-clock differences.
 */
export declare const RESEARCH_TRIAL_EVENT_TYPES: readonly ["stimulus_onset", "stimulus_offset", "probe_shown", "probe_response", "anomaly_onset", "anomaly_offset", "notice_flagged", "attention_check", "pass_tally_changed", "focus_lost", "focus_gained", "pause", "resume"];
export type ResearchTrialEventType = (typeof RESEARCH_TRIAL_EVENT_TYPES)[number];
/**
 * Keys for the critical (unexpected) events whose noticing we measure.
 * These are the "Observational Silence v1" original-stimulus events — an
 * abstract animation, not Simons' copyrighted footage. See
 * docs/research/stimulus-observational-silence-v1.md.
 */
export declare const DEFAULT_CRITICAL_EVENT_KEYS: readonly ["intruder", "backdrop_shift", "agent_exit"];
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
//# sourceMappingURL=attention-study.d.ts.map