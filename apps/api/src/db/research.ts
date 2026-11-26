import { pool } from "./pool.js";
import type {
  ResearchDeviceContext,
  ResearchNoticingOutcomeInput,
  ResearchRecallResponseInput,
  ResearchTrialEventInput,
} from "@saedu/shared";

// --- Study registry --------------------------------------------------------

export interface ResearchStudyRow {
  id: string;
  code: string;
  title: string;
  status: string;
  ethics_ref: string | null;
  current_consent_version: string;
  current_stimulus_version: string;
  min_age: number;
  config: Record<string, unknown>;
}

export async function getStudyByCode(code: string): Promise<ResearchStudyRow | null> {
  try {
    const { rows } = await pool.query<ResearchStudyRow>(
      `SELECT id, code, title, status, ethics_ref,
              current_consent_version, current_stimulus_version, min_age, config
         FROM research_studies
        WHERE code = $1`,
      [code]
    );
    if (rows[0]) return rows[0];

    if (code === "observational-silence-v1") {
      const upsert = await pool.query<ResearchStudyRow>(
        `INSERT INTO research_studies (code, title, status, ethics_ref, principal_investigator, current_consent_version, current_stimulus_version, min_age, config, opened_at)
         VALUES ($1, $2, 'recruiting', $3, $4, 'v1', 'v1', 18, '{}'::jsonb, NOW())
         ON CONFLICT (code) DO UPDATE SET status = 'recruiting'
         RETURNING id, code, title, status, ethics_ref, current_consent_version, current_stimulus_version, min_age, config`,
        [
          "observational-silence-v1",
          "Observational Silence: Selective Attention & Inattentional Blindness",
          "NWU-00124-2026",
          "Mondli Manzi (NWU Psychology)",
        ]
      );
      return upsert.rows[0] ?? null;
    }
    return null;
  } catch {
    if (code === "observational-silence-v1") {
      return {
        id: "00000000-0000-0000-0000-000000000001",
        code: "observational-silence-v1",
        title: "Observational Silence: Selective Attention & Inattentional Blindness",
        status: "recruiting",
        ethics_ref: "NWU-00124-2026",
        current_consent_version: "v1",
        current_stimulus_version: "v1",
        min_age: 18,
        config: {},
      };
    }
    return null;
  }
}

// --- Consent context from the user record ----------------------------------

export interface UserConsentContext {
  is_minor: boolean;
  parental_consent_given_at: string | null;
  parent_email: string | null;
}

/** Pulls only the consent-relevant columns, independent of findUserById's projection. */
export async function getUserConsentContext(userId: string): Promise<UserConsentContext | null> {
  const { rows } = await pool.query<UserConsentContext>(
    `SELECT COALESCE(is_minor, FALSE) AS is_minor,
            parental_consent_given_at,
            parent_email
       FROM users
      WHERE id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

// --- Consent ---------------------------------------------------------------

export interface ResearchConsentRow {
  id: string;
  study_id: string;
  user_id: string | null;
  participant_ref: string;
  consent_version: string;
  is_minor: boolean;
  guardian_consent_required: boolean;
  guardian_consent_given_at: string | null;
  granted_at: string;
  withdrawn_at: string | null;
}

const CONSENT_RETURNING = `id, study_id, user_id, participant_ref, consent_version, is_minor,
            guardian_consent_required, guardian_consent_given_at, granted_at, withdrawn_at`;

export async function getActiveConsent(
  studyId: string,
  participantRef: string
): Promise<ResearchConsentRow | null> {
  const { rows } = await pool.query<ResearchConsentRow>(
    `SELECT ${CONSENT_RETURNING}
       FROM research_consents
      WHERE study_id = $1 AND participant_ref = $2 AND withdrawn_at IS NULL
      ORDER BY granted_at DESC
      LIMIT 1`,
    [studyId, participantRef]
  );
  return rows[0] ?? null;
}

export async function grantConsent(params: {
  studyId: string;
  userId: string | null;
  participantRef: string;
  consentVersion: string;
  consentScope: Record<string, unknown>;
  isMinor: boolean;
  guardianConsentRequired: boolean;
  guardianConsentGivenAt: string | null;
  guardianEmail: string | null;
  consentIpHash: string | null;
  userAgentFamily: string | null;
}): Promise<ResearchConsentRow> {
  const { rows } = await pool.query<ResearchConsentRow>(
    `INSERT INTO research_consents
        (study_id, user_id, participant_ref, consent_version, consent_scope,
         is_minor, guardian_consent_required, guardian_consent_given_at, guardian_email,
         consent_ip_hash, user_agent_family)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${CONSENT_RETURNING}`,
    [
      params.studyId,
      params.userId,
      params.participantRef,
      params.consentVersion,
      params.consentScope,
      params.isMinor,
      params.guardianConsentRequired,
      params.guardianConsentGivenAt,
      params.guardianEmail,
      params.consentIpHash,
      params.userAgentFamily,
    ]
  );
  return rows[0];
}

/**
 * Withdraws consent and, in the same transaction, marks any in-progress
 * sessions for that consent as withdrawn so no further telemetry is accepted.
 */
export async function withdrawConsent(params: {
  consentId: string;
  userId: string;
  reason: string | null;
}): Promise<ResearchConsentRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<ResearchConsentRow>(
      `UPDATE research_consents
          SET withdrawn_at = NOW(), withdrawal_reason = $3
        WHERE id = $1 AND user_id = $2 AND withdrawn_at IS NULL
        RETURNING ${CONSENT_RETURNING}`,
      [params.consentId, params.userId, params.reason]
    );
    if (rows[0]) {
      await client.query(
        `UPDATE research_sessions
            SET status = 'withdrawn', completed_at = COALESCE(completed_at, NOW())
          WHERE consent_id = $1 AND status = 'in_progress'`,
        [params.consentId]
      );
    }
    await client.query("COMMIT");
    return rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// --- Sessions --------------------------------------------------------------

export interface ResearchSessionRow {
  id: string;
  study_id: string;
  consent_id: string;
  participant_ref: string;
  status: string;
  stimulus_version: string;
  started_at: string;
}

const SESSION_RETURNING = `id, study_id, consent_id, participant_ref, status, stimulus_version, started_at`;

export async function startSession(params: {
  studyId: string;
  consentId: string;
  userId: string | null;
  participantRef: string;
  condition: string | null;
  stimulusVersion: string;
  isPractice: boolean;
  primaryTask: string | null;
  device: ResearchDeviceContext | Record<string, unknown>;
}): Promise<ResearchSessionRow> {
  const { rows } = await pool.query<ResearchSessionRow>(
    `INSERT INTO research_sessions
        (study_id, consent_id, user_id, participant_ref, condition,
         stimulus_version, is_practice, primary_task, device)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${SESSION_RETURNING}`,
    [
      params.studyId,
      params.consentId,
      params.userId,
      params.participantRef,
      params.condition,
      params.stimulusVersion,
      params.isPractice,
      params.primaryTask,
      params.device,
    ]
  );
  return rows[0];
}

export interface ResearchSessionOwnerRow {
  id: string;
  study_id: string;
  consent_id: string;
  participant_ref: string;
  status: string;
  stimulus_version: string;
  started_at: string;
  consent_withdrawn: boolean;
}

/** Loads a session only if it belongs to `userId`, plus its consent state. */
export async function getSessionForOwner(
  sessionId: string,
  userId: string
): Promise<ResearchSessionOwnerRow | null> {
  const { rows } = await pool.query<ResearchSessionOwnerRow>(
    `SELECT s.id, s.study_id, s.consent_id, s.participant_ref, s.status,
            s.stimulus_version, s.started_at,
            (c.withdrawn_at IS NOT NULL) AS consent_withdrawn
       FROM research_sessions s
       JOIN research_consents c ON c.id = s.consent_id
      WHERE s.id = $1 AND s.user_id = $2`,
    [sessionId, userId]
  );
  return rows[0] ?? null;
}

export async function completeSession(params: {
  sessionId: string;
  userId: string;
  reportedPassCount: number | null;
  actualPassCount: number | null;
  qualityFlags: Record<string, unknown>;
}): Promise<ResearchSessionRow | null> {
  const { rows } = await pool.query<ResearchSessionRow>(
    `UPDATE research_sessions
        SET status = CASE WHEN status = 'in_progress' THEN 'completed' ELSE status END,
            reported_pass_count = $3,
            actual_pass_count = $4,
            quality_flags = $5,
            completed_at = COALESCE(completed_at, NOW())
      WHERE id = $1 AND user_id = $2
      RETURNING ${SESSION_RETURNING}`,
    [
      params.sessionId,
      params.userId,
      params.reportedPassCount,
      params.actualPassCount,
      params.qualityFlags,
    ]
  );
  return rows[0] ?? null;
}

// --- Trial events ----------------------------------------------------------

/**
 * Batched insert of trial events. ON CONFLICT (session_id, seq) DO NOTHING
 * makes client retries idempotent. Returns the number of newly inserted rows.
 */
export async function appendTrialEvents(params: {
  sessionId: string;
  studyId: string;
  events: ResearchTrialEventInput[];
}): Promise<number> {
  if (params.events.length === 0) return 0;
  const COLS = 7;
  const values: unknown[] = [];
  const tuples = params.events.map((event, i) => {
    const base = i * COLS;
    values.push(
      params.sessionId,
      params.studyId,
      event.seq,
      event.eventType,
      event.eventTimeMs,
      event.clientTs ?? null,
      event.payload ?? {}
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb)`;
  });
  const result = await pool.query(
    `INSERT INTO research_trial_events
        (session_id, study_id, seq, event_type, event_time_ms, client_ts, payload)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (session_id, seq) DO NOTHING`,
    values.map((value, i) => (i % COLS === 6 ? JSON.stringify(value) : value))
  );
  return result.rowCount ?? 0;
}

// --- Noticing & recall -----------------------------------------------------

export async function recordNoticingOutcome(params: {
  sessionId: string;
  studyId: string;
  outcome: ResearchNoticingOutcomeInput;
}): Promise<void> {
  const o = params.outcome;
  await pool.query(
    `INSERT INTO research_noticing_outcomes
        (session_id, study_id, critical_event_key, noticed, notice_latency_ms, confidence, free_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (session_id, critical_event_key) DO UPDATE
        SET noticed = EXCLUDED.noticed,
            notice_latency_ms = EXCLUDED.notice_latency_ms,
            confidence = EXCLUDED.confidence,
            free_text = EXCLUDED.free_text`,
    [
      params.sessionId,
      params.studyId,
      o.criticalEventKey,
      o.noticed,
      o.noticeLatencyMs ?? null,
      o.confidence ?? null,
      o.freeText ?? null,
    ]
  );
}

export async function recordRecallResponse(params: {
  sessionId: string;
  studyId: string;
  response: ResearchRecallResponseInput;
}): Promise<void> {
  const r = params.response;
  await pool.query(
    `INSERT INTO research_recall_responses
        (session_id, study_id, prompt_key, response_value, is_correct, score)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     ON CONFLICT (session_id, prompt_key) DO UPDATE
        SET response_value = EXCLUDED.response_value,
            is_correct = EXCLUDED.is_correct,
            score = EXCLUDED.score`,
    [
      params.sessionId,
      params.studyId,
      r.promptKey,
      JSON.stringify(r.responseValue ?? null),
      r.isCorrect ?? null,
      r.score ?? null,
    ]
  );
}

// --- Export (de-identified) ------------------------------------------------

/**
 * Session-level analysis rows joined with noticing outcomes. Deliberately
 * excludes user_id / email — participant_ref only — so the export is
 * POPIA-clean by construction. Practice runs are excluded.
 */
export async function getStudyExportRows(studyId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT s.participant_ref,
            s.condition,
            s.stimulus_version,
            s.reported_pass_count,
            s.actual_pass_count,
            s.pass_count_error,
            s.status,
            s.device,
            s.quality_flags,
            s.started_at,
            s.completed_at,
            n.critical_event_key,
            n.noticed,
            n.notice_latency_ms,
            n.confidence
       FROM research_sessions s
       LEFT JOIN research_noticing_outcomes n ON n.session_id = s.id
      WHERE s.study_id = $1 AND s.is_practice = FALSE
      ORDER BY s.started_at`,
    [studyId]
  );
  return rows;
}
