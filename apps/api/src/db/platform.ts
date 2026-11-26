import { createHash } from "node:crypto";
import { pool } from "./pool.js";

export type ModerationEventStatus = "new" | "in_review" | "resolved";
export type ModerationActionType =
  | "note"
  | "warn"
  | "mute"
  | "suspend"
  | "dismiss"
  | "assign"
  | "status_change";

export type TrustEventNoteRecord = {
  id: string;
  trust_event_id: string;
  admin_id: string;
  admin_name: string;
  action_type: ModerationActionType;
  note: string;
  created_at: string;
};

export type TrustEventLiteRecord = {
  id: string;
  actor_id: string;
  status: ModerationEventStatus;
  assigned_admin_id: string | null;
};

export type ConversationAttachmentQuotaRecord = {
  conversation_id: string;
  max_bytes: number;
  retention_days: number;
  updated_by: string | null;
  updated_at: string;
};

export type ConversationAttachmentUsageRecord = {
  total_bytes: number;
  attachment_count: number;
};

export type MessageUploadSessionRecord = {
  id: string;
  conversation_id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  total_bytes: number;
  uploaded_bytes: number;
  temp_storage_path: string;
  status: "open" | "completed" | "aborted" | "expired";
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ChannelTaskRecord = {
  id: string;
  conversation_id: string;
  created_by: string;
  assignee_id: string | null;
  linked_message_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  due_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ChannelAssessmentRecord = {
  id: string;
  conversation_id: string;
  created_by: string;
  title: string;
  instructions: string | null;
  questions_json: Record<string, unknown>[] | Record<string, unknown>;
  max_score: number;
  published_at: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChannelAssessmentAttemptRecord = {
  id: string;
  assessment_id: string;
  conversation_id: string;
  learner_id: string;
  answers_json: Record<string, unknown>;
  score: number | null;
  submitted_at: string;
  graded_at: string | null;
  graded_by: string | null;
};

export type LearnerBaselineAssessmentRecord = {
  learner_id: string;
  subject: string | null;
  grade: number | null;
  score_percent: number;
  confidence: "low" | "medium" | "high";
  details_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LearnerTopicMasteryRecord = {
  learner_id: string;
  subject: string;
  grade: number;
  topic_tag: string;
  mastery_score: number;
  attempts: number;
  updated_at: string;
};

export type GuardianLinkRecord = {
  id: string;
  guardian_user_id: string;
  learner_user_id: string;
  relation: string;
  created_at: string;
  accepted_at: string | null;
};

export type AuthLoginAlertRecord = {
  id: string;
  user_id: string;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  risk_level: "info" | "warn" | "high";
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

export type FeatureFlagRecord = {
  flag_key: string;
  description: string | null;
  enabled: boolean;
  rollout_percent: number;
  kill_switch: boolean;
  allow_roles: string[];
  metadata: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type FeatureFlagAuditRecord = {
  id: string;
  flag_key: string;
  actor_id: string | null;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  created_at: string;
};

function normalizeRolloutPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), 100);
}

function toCohortPercent(value: string) {
  const digest = createHash("sha1").update(value).digest("hex").slice(0, 8);
  const numeric = Number.parseInt(digest, 16);
  if (!Number.isFinite(numeric)) return 0;
  return numeric % 100;
}

export async function setTrustEventWorkflow(input: {
  eventId: string;
  status?: ModerationEventStatus;
  assignedAdminId?: string | null;
  resolved?: boolean;
}) {
  const result = await pool.query(
    `UPDATE trust_events
     SET status = COALESCE($2::text, status),
         assigned_admin_id = COALESCE($3::uuid, assigned_admin_id),
         resolved_at = CASE
           WHEN $4::boolean = true THEN NOW()
           WHEN $2::text = 'resolved' THEN COALESCE(resolved_at, NOW())
           ELSE resolved_at
         END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, assigned_admin_id, resolved_at, updated_at`,
    [input.eventId, input.status ?? null, input.assignedAdminId ?? null, input.resolved ?? false]
  );
  return result.rows[0] ?? null;
}

export async function getTrustEventById(eventId: string) {
  const result = await pool.query<TrustEventLiteRecord>(
    `SELECT id, actor_id, status, assigned_admin_id
     FROM trust_events
     WHERE id = $1
     LIMIT 1`,
    [eventId]
  );
  return result.rows[0] ?? null;
}

export async function addTrustEventNote(input: {
  trustEventId: string;
  adminId: string;
  note: string;
  actionType?: ModerationActionType;
}) {
  const result = await pool.query<TrustEventNoteRecord>(
    `INSERT INTO trust_event_notes (trust_event_id, admin_id, note, action_type)
     VALUES ($1, $2, $3, $4)
     RETURNING
       id,
       trust_event_id,
       admin_id,
       ''::text AS admin_name,
       action_type,
       note,
       created_at`,
    [input.trustEventId, input.adminId, input.note, input.actionType ?? "note"]
  );
  return result.rows[0] ?? null;
}

export async function listTrustEventNotes(trustEventId: string, limit = 50) {
  const bounded = Math.min(Math.max(limit, 1), 200);
  const result = await pool.query<TrustEventNoteRecord>(
    `SELECT
       n.id,
       n.trust_event_id,
       n.admin_id,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS admin_name,
       n.action_type,
       n.note,
       n.created_at
     FROM trust_event_notes n
     JOIN users u ON u.id = n.admin_id
     WHERE n.trust_event_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [trustEventId, bounded]
  );
  return result.rows;
}

export async function createUserSuspension(input: {
  userId: string;
  reason: string;
  suspendedBy: string;
  endsAt?: string | null;
}) {
  const result = await pool.query(
    `INSERT INTO user_suspensions (user_id, reason, suspended_by, ends_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, reason, suspended_by, starts_at, ends_at, created_at, revoked_at`,
    [input.userId, input.reason, input.suspendedBy, input.endsAt ?? null]
  );
  return result.rows[0] ?? null;
}

export async function getActiveUserSuspension(userId: string) {
  const result = await pool.query(
    `SELECT id, user_id, reason, suspended_by, starts_at, ends_at, created_at, revoked_at
     FROM user_suspensions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND starts_at <= NOW()
       AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY starts_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function revokeActiveUserSuspensions(userId: string) {
  await pool.query(
    `UPDATE user_suspensions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND (ends_at IS NULL OR ends_at > NOW())`,
    [userId]
  );
}

export async function getConversationAttachmentQuota(conversationId: string) {
  const result = await pool.query<ConversationAttachmentQuotaRecord>(
    `SELECT conversation_id, max_bytes, retention_days, updated_by, updated_at
     FROM conversation_attachment_quotas
     WHERE conversation_id = $1`,
    [conversationId]
  );
  return (
    result.rows[0] ?? {
      conversation_id: conversationId,
      max_bytes: 250 * 1024 * 1024,
      retention_days: 30,
      updated_by: null,
      updated_at: new Date().toISOString(),
    }
  );
}

export async function upsertConversationAttachmentQuota(input: {
  conversationId: string;
  maxBytes: number;
  retentionDays: number;
  updatedBy: string;
}) {
  const result = await pool.query<ConversationAttachmentQuotaRecord>(
    `INSERT INTO conversation_attachment_quotas (
       conversation_id, max_bytes, retention_days, updated_by, updated_at
     )
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (conversation_id)
     DO UPDATE SET
       max_bytes = EXCLUDED.max_bytes,
       retention_days = EXCLUDED.retention_days,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING conversation_id, max_bytes, retention_days, updated_by, updated_at`,
    [input.conversationId, Math.max(1, Math.floor(input.maxBytes)), Math.max(1, Math.floor(input.retentionDays)), input.updatedBy]
  );
  return result.rows[0] ?? null;
}

export async function getConversationAttachmentUsage(conversationId: string): Promise<ConversationAttachmentUsageRecord> {
  const result = await pool.query<{ total_bytes: number; attachment_count: number }>(
    `SELECT
       COALESCE(SUM(size_bytes), 0)::bigint AS total_bytes,
       COUNT(*)::int AS attachment_count
     FROM message_attachments
     WHERE conversation_id = $1`,
    [conversationId]
  );
  return {
    total_bytes: Number(result.rows[0]?.total_bytes ?? 0),
    attachment_count: Number(result.rows[0]?.attachment_count ?? 0),
  };
}

export async function createMessageUploadSession(input: {
  conversationId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
  tempStoragePath: string;
}) {
  const result = await pool.query<MessageUploadSessionRecord>(
    `INSERT INTO message_upload_sessions (
       conversation_id, user_id, file_name, mime_type, total_bytes, temp_storage_path
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING
       id, conversation_id, user_id, file_name, mime_type, total_bytes, uploaded_bytes,
       temp_storage_path, status, expires_at, created_at, updated_at`,
    [
      input.conversationId,
      input.userId,
      input.fileName,
      input.mimeType,
      Math.max(1, Math.floor(input.totalBytes)),
      input.tempStoragePath,
    ]
  );
  return result.rows[0] ?? null;
}

export async function getMessageUploadSession(uploadId: string) {
  const result = await pool.query<MessageUploadSessionRecord>(
    `SELECT
       id, conversation_id, user_id, file_name, mime_type, total_bytes, uploaded_bytes,
       temp_storage_path, status, expires_at, created_at, updated_at
     FROM message_upload_sessions
     WHERE id = $1
     LIMIT 1`,
    [uploadId]
  );
  return result.rows[0] ?? null;
}

export async function updateMessageUploadSessionProgress(input: {
  uploadId: string;
  uploadedBytes: number;
}) {
  const result = await pool.query<MessageUploadSessionRecord>(
    `UPDATE message_upload_sessions
     SET uploaded_bytes = GREATEST(0, LEAST(total_bytes, $2)),
         updated_at = NOW()
     WHERE id = $1
     RETURNING
       id, conversation_id, user_id, file_name, mime_type, total_bytes, uploaded_bytes,
       temp_storage_path, status, expires_at, created_at, updated_at`,
    [input.uploadId, Math.max(0, Math.floor(input.uploadedBytes))]
  );
  return result.rows[0] ?? null;
}

export async function completeMessageUploadSession(uploadId: string) {
  const result = await pool.query<MessageUploadSessionRecord>(
    `UPDATE message_upload_sessions
     SET status = 'completed',
         uploaded_bytes = total_bytes,
         updated_at = NOW()
     WHERE id = $1
     RETURNING
       id, conversation_id, user_id, file_name, mime_type, total_bytes, uploaded_bytes,
       temp_storage_path, status, expires_at, created_at, updated_at`,
    [uploadId]
  );
  return result.rows[0] ?? null;
}

export async function setMessageUploadSessionStatus(input: {
  uploadId: string;
  status: "open" | "completed" | "aborted" | "expired";
  uploadedBytes?: number;
}) {
  const result = await pool.query<MessageUploadSessionRecord>(
    `UPDATE message_upload_sessions
     SET status = $2,
         uploaded_bytes = COALESCE($3::bigint, uploaded_bytes),
         updated_at = NOW()
     WHERE id = $1
     RETURNING
       id, conversation_id, user_id, file_name, mime_type, total_bytes, uploaded_bytes,
       temp_storage_path, status, expires_at, created_at, updated_at`,
    [
      input.uploadId,
      input.status,
      Number.isFinite(input.uploadedBytes) ? Math.max(0, Math.floor(input.uploadedBytes as number)) : null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function listChannelTasks(conversationId: string, limit = 120) {
  const bounded = Math.min(Math.max(limit, 1), 300);
  const result = await pool.query<ChannelTaskRecord>(
    `SELECT
       id,
       conversation_id,
       created_by,
       assignee_id,
       linked_message_id,
       title,
       description,
       status,
       due_at,
       created_at,
       updated_at,
       completed_at
     FROM channel_tasks
     WHERE conversation_id = $1
     ORDER BY
       CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
       due_at ASC NULLS LAST,
       created_at DESC
     LIMIT $2`,
    [conversationId, bounded]
  );
  return result.rows;
}

export async function createChannelTask(input: {
  conversationId: string;
  createdBy: string;
  assigneeId?: string | null;
  linkedMessageId?: string | null;
  title: string;
  description?: string | null;
  dueAt?: string | null;
}) {
  const result = await pool.query<ChannelTaskRecord>(
    `INSERT INTO channel_tasks (
       conversation_id, created_by, assignee_id, linked_message_id, title, description, due_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id,
       conversation_id,
       created_by,
       assignee_id,
       linked_message_id,
       title,
       description,
       status,
       due_at,
       created_at,
       updated_at,
       completed_at`,
    [
      input.conversationId,
      input.createdBy,
      input.assigneeId ?? null,
      input.linkedMessageId ?? null,
      input.title.trim(),
      input.description?.trim() || null,
      input.dueAt ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function updateChannelTask(input: {
  taskId: string;
  status?: "todo" | "in_progress" | "done";
  assigneeId?: string | null;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
}) {
  const result = await pool.query<ChannelTaskRecord>(
    `UPDATE channel_tasks
     SET status = COALESCE($2::text, status),
         assignee_id = COALESCE($3::uuid, assignee_id),
         title = COALESCE(NULLIF(TRIM($4::text), ''), title),
         description = COALESCE($5::text, description),
         due_at = COALESCE($6::timestamptz, due_at),
         completed_at = CASE
           WHEN COALESCE($2::text, status) = 'done' THEN COALESCE(completed_at, NOW())
           WHEN COALESCE($2::text, status) <> 'done' THEN NULL
           ELSE completed_at
         END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING
       id,
       conversation_id,
       created_by,
       assignee_id,
       linked_message_id,
       title,
       description,
       status,
       due_at,
       created_at,
       updated_at,
       completed_at`,
    [input.taskId, input.status ?? null, input.assigneeId ?? null, input.title ?? null, input.description ?? null, input.dueAt ?? null]
  );
  return result.rows[0] ?? null;
}

export async function listChannelAssessments(conversationId: string, limit = 50) {
  const bounded = Math.min(Math.max(limit, 1), 100);
  const result = await pool.query<ChannelAssessmentRecord>(
    `SELECT
       id,
       conversation_id,
       created_by,
       title,
       instructions,
       questions_json,
       max_score,
       published_at,
       due_at,
       created_at,
       updated_at
     FROM channel_assessments
     WHERE conversation_id = $1
     ORDER BY published_at DESC
     LIMIT $2`,
    [conversationId, bounded]
  );
  return result.rows;
}

export async function createChannelAssessment(input: {
  conversationId: string;
  createdBy: string;
  title: string;
  instructions?: string | null;
  questionsJson: Record<string, unknown>[] | Record<string, unknown>;
  maxScore?: number;
  dueAt?: string | null;
}) {
  const result = await pool.query<ChannelAssessmentRecord>(
    `INSERT INTO channel_assessments (
       conversation_id, created_by, title, instructions, questions_json, max_score, due_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING
       id,
       conversation_id,
       created_by,
       title,
       instructions,
       questions_json,
       max_score,
       published_at,
       due_at,
       created_at,
       updated_at`,
    [
      input.conversationId,
      input.createdBy,
      input.title.trim(),
      input.instructions?.trim() || null,
      JSON.stringify(input.questionsJson ?? []),
      Number.isFinite(input.maxScore) ? Number(input.maxScore) : 100,
      input.dueAt ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function submitChannelAssessmentAttempt(input: {
  assessmentId: string;
  conversationId: string;
  learnerId: string;
  answersJson: Record<string, unknown>;
  score?: number | null;
}) {
  const result = await pool.query<ChannelAssessmentAttemptRecord>(
    `INSERT INTO channel_assessment_attempts (
       assessment_id, conversation_id, learner_id, answers_json, score, graded_at
     )
     VALUES ($1, $2, $3, $4::jsonb, $5, CASE WHEN $5 IS NULL THEN NULL ELSE NOW() END)
     RETURNING
       id, assessment_id, conversation_id, learner_id, answers_json, score, submitted_at, graded_at, graded_by`,
    [
      input.assessmentId,
      input.conversationId,
      input.learnerId,
      JSON.stringify(input.answersJson ?? {}),
      input.score ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function upsertLearnerBaselineAssessment(input: {
  learnerId: string;
  subject?: string | null;
  grade?: number | null;
  scorePercent: number;
  confidence: "low" | "medium" | "high";
  detailsJson?: Record<string, unknown>;
}) {
  const result = await pool.query<LearnerBaselineAssessmentRecord>(
    `INSERT INTO learner_baseline_assessments (
       learner_id, subject, grade, score_percent, confidence, details_json, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
     ON CONFLICT (learner_id)
     DO UPDATE SET
       subject = EXCLUDED.subject,
       grade = EXCLUDED.grade,
       score_percent = EXCLUDED.score_percent,
       confidence = EXCLUDED.confidence,
       details_json = EXCLUDED.details_json,
       updated_at = NOW()
     RETURNING learner_id, subject, grade, score_percent, confidence, details_json, created_at, updated_at`,
    [
      input.learnerId,
      input.subject ?? null,
      input.grade ?? null,
      Math.min(Math.max(input.scorePercent, 0), 100),
      input.confidence,
      JSON.stringify(input.detailsJson ?? {}),
    ]
  );
  return result.rows[0] ?? null;
}

export async function getLearnerBaselineAssessment(learnerId: string) {
  const result = await pool.query<LearnerBaselineAssessmentRecord>(
    `SELECT learner_id, subject, grade, score_percent, confidence, details_json, created_at, updated_at
     FROM learner_baseline_assessments
     WHERE learner_id = $1`,
    [learnerId]
  );
  return result.rows[0] ?? null;
}

export async function upsertLearnerTopicMastery(input: {
  learnerId: string;
  subject: string;
  grade: number;
  topicTag: string;
  masteryScore: number;
  attemptsDelta?: number;
}) {
  const score = Math.min(Math.max(input.masteryScore, 0), 100);
  const attemptsDelta = Number.isFinite(input.attemptsDelta) ? Math.max(0, Math.floor(input.attemptsDelta || 0)) : 1;
  const result = await pool.query<LearnerTopicMasteryRecord>(
    `INSERT INTO learner_topic_mastery (
       learner_id, subject, grade, topic_tag, mastery_score, attempts, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (learner_id, subject, grade, topic_tag)
     DO UPDATE SET
       mastery_score = ROUND(((learner_topic_mastery.mastery_score * learner_topic_mastery.attempts) + ($5 * $6))
         / GREATEST(learner_topic_mastery.attempts + $6, 1), 2),
       attempts = learner_topic_mastery.attempts + $6,
       updated_at = NOW()
     RETURNING learner_id, subject, grade, topic_tag, mastery_score, attempts, updated_at`,
    [input.learnerId, input.subject, input.grade, input.topicTag, score, attemptsDelta]
  );
  return result.rows[0] ?? null;
}

export async function listLearnerTopicMastery(input: {
  learnerId: string;
  subject?: string;
  grade?: number;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 250);
  const result = await pool.query<LearnerTopicMasteryRecord>(
    `SELECT learner_id, subject, grade, topic_tag, mastery_score, attempts, updated_at
     FROM learner_topic_mastery
     WHERE learner_id = $1
       AND ($2::text IS NULL OR subject = $2)
       AND ($3::int IS NULL OR grade = $3)
     ORDER BY mastery_score ASC, attempts DESC, updated_at DESC
     LIMIT $4`,
    [input.learnerId, input.subject ?? null, input.grade ?? null, limit]
  );
  return result.rows;
}

export async function getAdaptiveLessonPath(input: { learnerId: string; limit?: number }) {
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 40);
  const result = await pool.query(
    `WITH low_mastery AS (
       SELECT subject, grade, topic_tag, mastery_score, attempts
       FROM learner_topic_mastery
       WHERE learner_id = $1
       ORDER BY mastery_score ASC, attempts DESC, updated_at DESC
       LIMIT $2
     ),
     low_recommendations AS (
       SELECT lesson_key,
              subject,
              grade,
              AVG(score_percent)::float AS avg_score,
              COUNT(*)::int AS attempts
       FROM quiz_attempts_v2
       WHERE learner_id = $1
       GROUP BY lesson_key, subject, grade
       HAVING AVG(score_percent) < 80
       ORDER BY avg_score ASC, attempts DESC
       LIMIT $2
     )
     SELECT
       COALESCE(lr.lesson_key, CONCAT('practice-', REPLACE(lm.topic_tag, ' ', '-'))) AS lesson_key,
       COALESCE(lr.subject, lm.subject) AS subject,
       COALESCE(lr.grade, lm.grade) AS grade,
       COALESCE(lr.avg_score, lm.mastery_score)::float AS score_signal,
       CASE
         WHEN lr.lesson_key IS NOT NULL THEN 'quiz performance'
         ELSE 'topic mastery'
       END AS reason
     FROM low_mastery lm
     FULL OUTER JOIN low_recommendations lr
       ON lr.subject = lm.subject
      AND lr.grade = lm.grade
     ORDER BY score_signal ASC
     LIMIT $2`,
    [input.learnerId, limit]
  );
  return result.rows.map((row) => ({
    lessonKey: String(row.lesson_key),
    subject: String(row.subject),
    grade: Number(row.grade),
    scoreSignal: Number(row.score_signal),
    reason: String(row.reason),
  }));
}

export async function createGuardianLink(input: {
  guardianUserId: string;
  learnerUserId: string;
  relation?: string;
  accepted?: boolean;
}) {
  const result = await pool.query<GuardianLinkRecord>(
    `INSERT INTO guardian_links (
       guardian_user_id, learner_user_id, relation, accepted_at
     )
     VALUES ($1, $2, $3, CASE WHEN $4::boolean THEN NOW() ELSE NULL END)
     ON CONFLICT (guardian_user_id, learner_user_id)
     DO UPDATE SET
       relation = EXCLUDED.relation,
       accepted_at = COALESCE(guardian_links.accepted_at, EXCLUDED.accepted_at)
     RETURNING id, guardian_user_id, learner_user_id, relation, created_at, accepted_at`,
    [input.guardianUserId, input.learnerUserId, input.relation?.trim() || "guardian", Boolean(input.accepted)]
  );
  return result.rows[0] ?? null;
}

export async function listGuardianLinksByGuardian(guardianUserId: string) {
  const result = await pool.query<GuardianLinkRecord>(
    `SELECT id, guardian_user_id, learner_user_id, relation, created_at, accepted_at
     FROM guardian_links
     WHERE guardian_user_id = $1
     ORDER BY created_at DESC`,
    [guardianUserId]
  );
  return result.rows;
}

export async function createAuthLoginAlert(input: {
  userId: string;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  riskLevel?: "info" | "warn" | "high";
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const result = await pool.query<AuthLoginAlertRecord>(
    `INSERT INTO auth_login_alerts (
       user_id, session_id, ip_address, user_agent, risk_level, reason, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING
       id, user_id, session_id, ip_address, user_agent, risk_level, reason, metadata, created_at, read_at`,
    [
      input.userId,
      input.sessionId ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.riskLevel ?? "info",
      input.reason,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return result.rows[0] ?? null;
}

export async function listAuthLoginAlerts(userId: string, limit = 30) {
  const bounded = Math.min(Math.max(limit, 1), 200);
  const result = await pool.query<AuthLoginAlertRecord>(
    `SELECT
       id, user_id, session_id, ip_address, user_agent, risk_level, reason, metadata, created_at, read_at
     FROM auth_login_alerts
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, bounded]
  );
  return result.rows;
}

export async function markAuthLoginAlertsRead(userId: string) {
  await pool.query(
    `UPDATE auth_login_alerts
     SET read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1`,
    [userId]
  );
}

export async function listFeatureFlags() {
  const result = await pool.query<FeatureFlagRecord>(
    `SELECT
       flag_key,
       description,
       enabled,
       rollout_percent,
       kill_switch,
       allow_roles,
       metadata,
       updated_by,
       updated_at,
       created_at
     FROM feature_flags
     ORDER BY flag_key ASC`
  );
  return result.rows;
}

export async function upsertFeatureFlag(input: {
  flagKey: string;
  description?: string | null;
  enabled?: boolean;
  rolloutPercent?: number;
  killSwitch?: boolean;
  allowRoles?: string[];
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}) {
  const rolloutPercent = normalizeRolloutPercent(input.rolloutPercent ?? 0);
  const result = await pool.query<FeatureFlagRecord>(
    `INSERT INTO feature_flags (
       flag_key, description, enabled, rollout_percent, kill_switch, allow_roles, metadata, updated_by, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())
     ON CONFLICT (flag_key)
     DO UPDATE SET
       description = EXCLUDED.description,
       enabled = EXCLUDED.enabled,
       rollout_percent = EXCLUDED.rollout_percent,
       kill_switch = EXCLUDED.kill_switch,
       allow_roles = EXCLUDED.allow_roles,
       metadata = EXCLUDED.metadata,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING
       flag_key,
       description,
       enabled,
       rollout_percent,
       kill_switch,
       allow_roles,
       metadata,
       updated_by,
       updated_at,
       created_at`,
    [
      input.flagKey.trim(),
      input.description ?? null,
      Boolean(input.enabled),
      rolloutPercent,
      Boolean(input.killSwitch),
      input.allowRoles ?? [],
      JSON.stringify(input.metadata ?? {}),
      input.actorId ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function createFeatureFlagAudit(input: {
  flagKey: string;
  actorId?: string | null;
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
}) {
  const result = await pool.query<FeatureFlagAuditRecord>(
    `INSERT INTO feature_flag_audits (flag_key, actor_id, before_json, after_json)
     VALUES ($1, $2, $3::jsonb, $4::jsonb)
     RETURNING id, flag_key, actor_id, before_json, after_json, created_at`,
    [input.flagKey, input.actorId ?? null, JSON.stringify(input.beforeJson), JSON.stringify(input.afterJson)]
  );
  return result.rows[0] ?? null;
}

export async function listFeatureFlagAudits(flagKey: string, limit = 40) {
  const bounded = Math.min(Math.max(limit, 1), 200);
  const result = await pool.query<FeatureFlagAuditRecord>(
    `SELECT id, flag_key, actor_id, before_json, after_json, created_at
     FROM feature_flag_audits
     WHERE flag_key = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [flagKey, bounded]
  );
  return result.rows;
}

export async function evaluateFeatureFlag(input: {
  flagKey: string;
  userId: string;
  role?: string | null;
}) {
  const result = await pool.query<FeatureFlagRecord>(
    `SELECT
       flag_key,
       description,
       enabled,
       rollout_percent,
       kill_switch,
       allow_roles,
       metadata,
       updated_by,
       updated_at,
       created_at
     FROM feature_flags
     WHERE flag_key = $1
     LIMIT 1`,
    [input.flagKey]
  );
  const flag = result.rows[0];
  if (!flag) return { enabled: false, reason: "missing" as const, flag: null };
  if (flag.kill_switch) return { enabled: false, reason: "kill_switch" as const, flag };
  if (!flag.enabled) return { enabled: false, reason: "disabled" as const, flag };

  const role = (input.role ?? "").trim().toLowerCase();
  if (flag.allow_roles.length > 0 && role && !flag.allow_roles.includes(role)) {
    return { enabled: false, reason: "role_not_allowed" as const, flag };
  }

  const cohort = toCohortPercent(`${flag.flag_key}|${input.userId}`);
  if (cohort >= normalizeRolloutPercent(flag.rollout_percent)) {
    return { enabled: false, reason: "outside_rollout" as const, flag };
  }
  return { enabled: true, reason: "enabled" as const, flag };
}
