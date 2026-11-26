import { pool } from "./pool.js";
import { decryptMessageBody, encryptMessageBody } from "../lib/messageEncryption.js";

export type ConversationType = "group" | "direct" | "channel";

export type ConversationParticipantRole =
  | "owner"
  | "editor"
  | "viewer"
  | "member"
  | "tutor"
  | "student";

export type ConversationRecord = {
  id: string;
  name: string;
  type: ConversationType;
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
  assignment_title: string | null;
  assignment_description: string | null;
  assignment_due_at: string | null;
  assignment_template: Record<string, unknown> | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
};

export type MessageAttachmentKind = "file" | "image" | "video" | "audio";

export type MessageAttachmentRecord = {
  id: string;
  message_id: string;
  conversation_id: string;
  uploader_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: MessageAttachmentKind;
  duration_seconds: number | null;
  scan_status?: "pending" | "clean" | "blocked";
  scan_reason?: string | null;
  scanned_at?: string | null;
  created_at: string;
};

export type MessageAttachmentFileRecord = MessageAttachmentRecord & {
  storage_path: string;
};

export type MessageReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type MessageReplyPreview = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type MessageRecord = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  pinned_at?: string | null;
  pinned_by?: string | null;
  parent_message_id?: string | null;
  thread_depth?: number;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  sender_name?: string;
  reply_to?: MessageReplyPreview | null;
  attachments?: MessageAttachmentRecord[];
  mention_user_ids?: string[];
  reactions?: MessageReactionSummary[];
  delivery_status?: "sending" | "failed" | "sent" | "delivered" | "read";
};

function decryptMessageRecord<T extends { body: string | null }>(row: T): T {
  return { ...row, body: decryptMessageBody(row.body) };
}

export type SavedMessageRecord = MessageRecord & {
  saved_at: string;
  conversation_name: string;
};

export type MessageActivityEventType =
  | "message_pinned"
  | "message_unpinned"
  | "conversation_archived"
  | "conversation_unarchived"
  | "participant_added"
  | "participant_removed"
  | "participant_left"
  | "channel_details_updated"
  | "channel_reminder_settings_updated"
  | "channel_notification_settings_updated";

export type ConversationActivityRecord = {
  id: string;
  conversation_id: string;
  actor_id: string | null;
  actor_name: string | null;
  event_type: MessageActivityEventType;
  message_id: string | null;
  message_body: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ConversationParticipantRecord = {
  user_id: string;
  email: string;
  name: string;
  role: ConversationParticipantRole;
};

export type FollowedUserRecord = {
  user_id: string;
  email: string;
  name: string;
  username: string | null;
};

export type InteractedUserRecord = FollowedUserRecord & {
  last_interaction_at: string;
  message_count: number;
};

export type WeeklyMessagingSnapshotRecord = {
  window_days: number;
  window_start: string;
  window_end: string;
  sent_messages: number;
  received_messages: number;
  active_conversations: number;
  active_direct_conversations: number;
  active_group_conversations: number;
  active_channel_conversations: number;
  collaborator_count: number;
  due_soon_channels: number;
  overdue_channels: number;
};

export type MentionNotificationRecord = {
  message_id: string;
  conversation_id: string;
  conversation_name: string;
  sender_id: string;
  sender_name: string;
  message_body: string | null;
  message_created_at: string;
  unread: boolean;
};

export type AssignmentReminderNotificationRecord = {
  id: string;
  conversation_id: string;
  conversation_name: string;
  reminder_kind: AssignmentReminderKind;
  assignment_title: string | null;
  assignment_due_at: string;
  source_sent_at: string;
  created_at: string;
  read_at: string | null;
  unread: boolean;
};

export type ConversationPresenceRecord = {
  conversation_id: string;
  user_id: string;
  is_online: boolean;
  last_active_at: string;
  last_typing_at: string | null;
  last_read_at: string | null;
};

export type AssignmentReminderMode = "off" | "72h" | "24h";
export type AssignmentReminderKind = "72h" | "24h" | "overdue";

export type AssignmentReminderDispatchRecord = {
  conversation_id: string;
  conversation_name: string;
  user_id: string;
  assignment_title: string | null;
  assignment_due_at: string;
  reminder_kind: AssignmentReminderKind;
  sent_at: string;
};

export type ConversationSettingsRecord = {
  conversation_id: string;
  user_id: string;
  muted_until: string | null;
  blocked: boolean;
  mention_notifications: boolean;
  assignment_reminder_mode: AssignmentReminderMode;
  assignment_reminder_snoozed_until: string | null;
  assignment_overdue_repeat_hours: number;
  channel_event_notifications: boolean;
  message_update_notifications: boolean;
  share_presence: boolean;
  share_typing: boolean;
  share_read_receipts: boolean;
  updated_at: string;
};

export type ConversationVisibilitySettingsRecord = {
  user_id: string;
  share_presence: boolean;
  share_typing: boolean;
  share_read_receipts: boolean;
};

type ConversationSummaryRecord = {
  id: string;
  type: ConversationType;
  archived_at: string | null;
  archived_by: string | null;
};

export type ConversationDetailsRecord = ConversationSummaryRecord & {
  name: string;
  assignment_title: string | null;
  assignment_description: string | null;
  assignment_due_at: string | null;
  assignment_template: Record<string, unknown> | null;
};

export async function listConversationsForUser(userId: string): Promise<ConversationRecord[]> {
  const result = await pool.query<ConversationRecord>(
    `SELECT c.id,
            c.name,
            c.type,
            c.created_at,
            c.archived_at,
            c.archived_by,
            c.assignment_title,
            c.assignment_description,
            c.assignment_due_at,
            c.assignment_template,
            m.body AS last_message,
            m.created_at AS last_message_at,
            COALESCE(unread.unread_count, 0)::int AS unread_count
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     LEFT JOIN conversation_presence self_presence
       ON self_presence.conversation_id = c.id
      AND self_presence.user_id = $1
     LEFT JOIN LATERAL (
       SELECT body, created_at
       FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) m ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM messages um
       WHERE um.conversation_id = c.id
         AND um.sender_id <> $1
         AND (
           self_presence.last_read_at IS NULL
           OR um.created_at > self_presence.last_read_at
         )
      ) unread ON true
     WHERE cp.user_id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM user_relationships rel
         JOIN conversation_participants cp_other
           ON cp_other.conversation_id = c.id
          AND cp_other.user_id <> $1
         WHERE c.type = 'direct'
           AND rel.relationship_type = 'blocked'
           AND (
             (rel.user_id = $1 AND rel.target_user_id = cp_other.user_id)
             OR
             (rel.user_id = cp_other.user_id AND rel.target_user_id = $1)
           )
       )
     ORDER BY m.created_at DESC NULLS LAST, c.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...row,
    last_message: decryptMessageBody(row.last_message ?? null),
  }));
}

export type ListMessagesOptions = {
  limit?: number;
  before?: string | null;
};

export async function listMessages(
  conversationId: string,
  options: ListMessagesOptions = {},
  viewerUserId?: string
): Promise<MessageRecord[]> {
  if (viewerUserId) {
    await markConversationMessagesDelivered(conversationId, viewerUserId);
  }

  const limit = Math.min(options.limit ?? 50, 201);
  const before = options.before ?? null;
  const result = await pool.query<MessageRecord>(
    `SELECT m.id,
            m.conversation_id,
            m.sender_id,
            m.body,
            m.created_at,
            m.pinned_at,
            m.pinned_by,
            m.parent_message_id,
            m.edited_at,
            m.deleted_at,
            m.deleted_by,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND ($2::timestamptz IS NULL OR m.created_at < $2)
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [conversationId, before, limit]
  );
  const rows = result.rows.reverse();
  if (rows.length === 0) return rows;
  return hydrateMessageRows(rows, viewerUserId);
}

export type ListSavedMessagesOptions = {
  limit?: number;
};

export async function listSavedMessagesForUser(
  userId: string,
  options: ListSavedMessagesOptions = {}
): Promise<SavedMessageRecord[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const result = await pool.query<
    MessageRecord & {
      saved_at: string;
      conversation_name: string;
    }
  >(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       m.body,
       m.created_at,
       m.pinned_at,
       m.pinned_by,
       m.parent_message_id,
       m.edited_at,
       m.deleted_at,
       m.deleted_by,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name,
       c.name AS conversation_name,
       usm.created_at AS saved_at
     FROM user_saved_messages usm
     JOIN messages m ON m.id = usm.message_id
     JOIN conversations c ON c.id = m.conversation_id
     JOIN conversation_participants cp
       ON cp.conversation_id = m.conversation_id
      AND cp.user_id = $1
     JOIN users u ON u.id = m.sender_id
     WHERE usm.user_id = $1
     ORDER BY usm.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  if (result.rows.length === 0) return [];
  const hydrated = await hydrateMessageRows(result.rows, userId);
  const hydratedById = new Map(hydrated.map((row) => [row.id, row]));
  const mapped: SavedMessageRecord[] = [];
  for (const row of result.rows) {
    const hydratedRow = hydratedById.get(row.id);
    if (!hydratedRow) continue;
    mapped.push({
      ...hydratedRow,
      saved_at: row.saved_at,
      conversation_name: row.conversation_name,
    });
  }
  return mapped;
}

export async function toggleSavedMessage(messageId: string, userId: string): Promise<{ saved: boolean; savedAt: string | null }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await client.query(
      `DELETE FROM user_saved_messages
       WHERE message_id = $1
         AND user_id = $2`,
      [messageId, userId]
    );

    if (removed.rowCount && removed.rowCount > 0) {
      await client.query("COMMIT");
      return { saved: false, savedAt: null };
    }

    const inserted = await client.query<{ created_at: string }>(
      `INSERT INTO user_saved_messages (message_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (message_id, user_id)
       DO UPDATE SET created_at = NOW()
       RETURNING created_at`,
      [messageId, userId]
    );
    await client.query("COMMIT");
    return {
      saved: true,
      savedAt: inserted.rows[0]?.created_at ?? new Date().toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type SearchConversationMessagesOptions = {
  limit?: number;
  fromUserId?: string | null;
  hasFiles?: boolean | null;
  before?: string | null;
  after?: string | null;
};

export async function searchConversationMessages(
  conversationId: string,
  query: string,
  options: SearchConversationMessagesOptions = {},
  viewerUserId?: string
): Promise<MessageRecord[]> {
  const normalized = query.trim();
  const hasFilters =
    Boolean(options.fromUserId) ||
    typeof options.hasFiles === "boolean" ||
    Boolean(options.before) ||
    Boolean(options.after);
  if (!normalized && !hasFilters) return [];

  if (viewerUserId) {
    await markConversationMessagesDelivered(conversationId, viewerUserId);
  }

  const limit = Math.min(options.limit ?? 25, 100);
  const search = `%${normalized || ""}%`;
  const candidateLimit = normalized ? Math.min(Math.max(limit * 10, 100), 500) : limit;
  const result = await pool.query<MessageRecord>(
    `SELECT m.id,
            m.conversation_id,
            m.sender_id,
            m.body,
            m.created_at,
            m.pinned_at,
            m.pinned_by,
            m.parent_message_id,
            m.edited_at,
            m.deleted_at,
            m.deleted_by,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND ($4::uuid IS NULL OR m.sender_id = $4::uuid)
       AND ($5::boolean IS NULL OR (
          CASE
            WHEN $5::boolean = true THEN EXISTS (
              SELECT 1 FROM message_attachments ma WHERE ma.message_id = m.id
            )
            ELSE NOT EXISTS (
              SELECT 1 FROM message_attachments ma WHERE ma.message_id = m.id
            )
          END
       ))
       AND ($6::timestamptz IS NULL OR m.created_at < $6::timestamptz)
       AND ($7::timestamptz IS NULL OR m.created_at > $7::timestamptz)
     ORDER BY
       (
         CASE
             WHEN EXISTS (
               SELECT 1
               FROM message_attachments ma
               WHERE ma.message_id = m.id
                 AND ma.file_name ILIKE $3
             )
             THEN 1
             ELSE 0
           END
       ) DESC,
       m.created_at DESC
     LIMIT $2`,
    [
      conversationId,
      candidateLimit,
      search,
      options.fromUserId ?? null,
      typeof options.hasFiles === "boolean" ? options.hasFiles : null,
      options.before ?? null,
      options.after ?? null,
    ]
  );

  const rows = result.rows;
  if (rows.length === 0) return [];
  const hydrated = await hydrateMessageRows(rows, viewerUserId);
  const needle = normalized.toLowerCase();
  return hydrated
    .filter((row) => !needle || row.body?.toLowerCase().includes(needle) || row.attachments?.some((attachment) => attachment.file_name.toLowerCase().includes(needle)))
    .slice(0, limit);
}

export type ListMessagesAroundOptions = {
  before?: number;
  after?: number;
};

export async function listMessagesAround(
  conversationId: string,
  anchorMessageId: string,
  options: ListMessagesAroundOptions = {},
  viewerUserId?: string
): Promise<{ messages: MessageRecord[]; anchorMessageId: string; hasBefore: boolean; hasAfter: boolean } | null> {
  if (viewerUserId) {
    await markConversationMessagesDelivered(conversationId, viewerUserId);
  }

  const beforeLimit = Math.min(Math.max(options.before ?? 20, 0), 100);
  const afterLimit = Math.min(Math.max(options.after ?? 40, 0), 120);

  const anchorResult = await pool.query<{ id: string; created_at: string }>(
    `SELECT id, created_at
     FROM messages
     WHERE conversation_id = $1
       AND id = $2
     LIMIT 1`,
    [conversationId, anchorMessageId]
  );
  const anchor = anchorResult.rows[0];
  if (!anchor) return null;

  const [beforeResult, afterResult, hasBeforeResult, hasAfterResult] = await Promise.all([
    pool.query<MessageRecord>(
      `SELECT m.id,
              m.conversation_id,
              m.sender_id,
              m.body,
              m.created_at,
              m.pinned_at,
              m.pinned_by,
              m.parent_message_id,
              m.edited_at,
              m.deleted_at,
              m.deleted_by,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
         AND (m.created_at, m.id) < ($2::timestamptz, $3::uuid)
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $4`,
      [conversationId, anchor.created_at, anchor.id, beforeLimit]
    ),
    pool.query<MessageRecord>(
      `SELECT m.id,
              m.conversation_id,
              m.sender_id,
              m.body,
              m.created_at,
              m.pinned_at,
              m.pinned_by,
              m.parent_message_id,
              m.edited_at,
              m.deleted_at,
              m.deleted_by,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
         AND (m.created_at, m.id) >= ($2::timestamptz, $3::uuid)
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT $4`,
      [conversationId, anchor.created_at, anchor.id, afterLimit + 1]
    ),
    pool.query<{ has_before: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM messages m
         WHERE m.conversation_id = $1
           AND (m.created_at, m.id) < ($2::timestamptz, $3::uuid)
         ORDER BY m.created_at DESC, m.id DESC
         OFFSET $4
         LIMIT 1
       ) AS has_before`,
      [conversationId, anchor.created_at, anchor.id, beforeLimit]
    ),
    pool.query<{ has_after: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM messages m
         WHERE m.conversation_id = $1
           AND (m.created_at, m.id) > ($2::timestamptz, $3::uuid)
         ORDER BY m.created_at ASC, m.id ASC
         OFFSET $4
         LIMIT 1
       ) AS has_after`,
      [conversationId, anchor.created_at, anchor.id, afterLimit]
    ),
  ]);

  const combined = [...beforeResult.rows.reverse(), ...afterResult.rows];
  const hydrated = combined.length ? await hydrateMessageRows(combined, viewerUserId) : [];
  return {
    messages: hydrated,
    anchorMessageId: anchor.id,
    hasBefore: Boolean(hasBeforeResult.rows[0]?.has_before),
    hasAfter: Boolean(hasAfterResult.rows[0]?.has_after),
  };
}

export type ListThreadMessagesOptions = {
  limit?: number;
};

export async function listThreadMessages(
  conversationId: string,
  messageId: string,
  options: ListThreadMessagesOptions = {},
  viewerUserId?: string
): Promise<{ rootMessageId: string; messages: MessageRecord[] } | null> {
  if (viewerUserId) {
    await markConversationMessagesDelivered(conversationId, viewerUserId);
  }

  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const result = await pool.query<MessageRecord & { root_message_id: string; thread_depth: number }>(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_message_id, created_at
       FROM messages
       WHERE conversation_id = $1
         AND id = $2
       UNION ALL
       SELECT parent.id, parent.parent_message_id, parent.created_at
       FROM messages parent
       JOIN ancestors child ON child.parent_message_id = parent.id
       WHERE parent.conversation_id = $1
     ),
     root AS (
       SELECT id
       FROM ancestors
       WHERE parent_message_id IS NULL
       ORDER BY created_at ASC, id ASC
       LIMIT 1
     ),
     thread AS (
       SELECT m.id, m.parent_message_id, m.created_at, 0::int AS depth
       FROM messages m
       JOIN root r ON r.id = m.id
       UNION ALL
       SELECT child.id, child.parent_message_id, child.created_at, thread.depth + 1
       FROM messages child
       JOIN thread ON thread.id = child.parent_message_id
       WHERE child.conversation_id = $1
     )
     SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       m.body,
       m.created_at,
       m.pinned_at,
       m.pinned_by,
       m.parent_message_id,
       thread.depth AS thread_depth,
       m.edited_at,
       m.deleted_at,
       m.deleted_by,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name,
       (SELECT id FROM root LIMIT 1) AS root_message_id
     FROM thread
     JOIN messages m ON m.id = thread.id
     JOIN users u ON u.id = m.sender_id
     ORDER BY
       CASE WHEN m.id = (SELECT id FROM root LIMIT 1) THEN 0 ELSE 1 END,
       m.created_at ASC,
       m.id ASC
     LIMIT $3`,
    [conversationId, messageId, limit]
  );

  if (result.rows.length === 0) return null;
  const rootMessageId = result.rows[0].root_message_id;
  if (!rootMessageId) return null;

  const hydrated = await hydrateMessageRows(result.rows, viewerUserId);
  return {
    rootMessageId,
    messages: hydrated,
  };
}

export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
    [conversationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getParticipantIds(conversationId: string): Promise<string[]> {
  const result = await pool.query<{ user_id: string }>(
    "SELECT user_id FROM conversation_participants WHERE conversation_id = $1",
    [conversationId]
  );
  return result.rows.map((row) => row.user_id);
}

export async function listConversationParticipants(conversationId: string): Promise<ConversationParticipantRecord[]> {
  const result = await pool.query<ConversationParticipantRecord>(
    `SELECT u.id AS user_id,
            u.email,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS name,
            cp.role
     FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.conversation_id = $1
     ORDER BY
       CASE cp.role
         WHEN 'owner' THEN 0
         WHEN 'editor' THEN 1
         WHEN 'viewer' THEN 2
         ELSE 3
       END,
       u.created_at ASC`,
    [conversationId]
  );
  return result.rows;
}

export async function touchConversationPresence(input: {
  conversationId: string;
  userId: string;
  isOnline?: boolean;
  touchActive?: boolean;
  touchTyping?: boolean;
  readAt?: string | null;
}) {
  const result = await pool.query<ConversationPresenceRecord>(
    `INSERT INTO conversation_presence (
       conversation_id,
       user_id,
       is_online,
       last_active_at,
       last_typing_at,
       last_read_at,
       updated_at
     )
     VALUES (
       $1,
       $2,
       COALESCE($3, false),
       CASE WHEN COALESCE($4, true) THEN NOW() ELSE NOW() END,
       CASE WHEN COALESCE($5, false) THEN NOW() ELSE NULL END,
       $6::timestamptz,
       NOW()
     )
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET
       is_online = COALESCE($3, conversation_presence.is_online),
       last_active_at = CASE WHEN COALESCE($4, false) THEN NOW() ELSE conversation_presence.last_active_at END,
       last_typing_at = CASE WHEN COALESCE($5, false) THEN NOW() ELSE conversation_presence.last_typing_at END,
       last_read_at = COALESCE($6::timestamptz, conversation_presence.last_read_at),
       updated_at = NOW()
     RETURNING conversation_id, user_id, is_online, last_active_at, last_typing_at, last_read_at`,
    [
      input.conversationId,
      input.userId,
      input.isOnline ?? null,
      input.touchActive ?? true,
      input.touchTyping ?? false,
      input.readAt ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function listConversationPresence(conversationId: string): Promise<ConversationPresenceRecord[]> {
  const result = await pool.query<ConversationPresenceRecord>(
    `SELECT conversation_id,
            user_id,
            is_online,
            last_active_at,
            last_typing_at,
            last_read_at
     FROM conversation_presence
     WHERE conversation_id = $1`,
    [conversationId]
  );
  return result.rows;
}

export async function listConversationVisibilitySettings(
  conversationId: string
): Promise<ConversationVisibilitySettingsRecord[]> {
  const result = await pool.query<ConversationVisibilitySettingsRecord>(
    `SELECT
       cp.user_id,
       COALESCE(cus.share_presence, true) AS share_presence,
       COALESCE(cus.share_typing, true) AS share_typing,
       COALESCE(cus.share_read_receipts, true) AS share_read_receipts
     FROM conversation_participants cp
     LEFT JOIN conversation_user_settings cus
       ON cus.conversation_id = cp.conversation_id
      AND cus.user_id = cp.user_id
     WHERE cp.conversation_id = $1`,
    [conversationId]
  );
  return result.rows;
}

export async function getConversationSettings(
  conversationId: string,
  userId: string
): Promise<ConversationSettingsRecord | null> {
  const result = await pool.query<ConversationSettingsRecord>(
    `SELECT
       conversation_id,
       user_id,
       muted_until,
       blocked,
       mention_notifications,
       assignment_reminder_mode,
       assignment_reminder_snoozed_until,
       assignment_overdue_repeat_hours,
       channel_event_notifications,
       message_update_notifications,
       share_presence,
       share_typing,
       share_read_receipts,
       updated_at
     FROM conversation_user_settings
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows[0] ?? null;
}

export async function upsertConversationSettings(input: {
  conversationId: string;
  userId: string;
  mutedUntil?: string | null;
  setMutedUntil?: boolean;
  blocked?: boolean;
  mentionNotifications?: boolean;
  assignmentReminderMode?: AssignmentReminderMode;
  assignmentReminderSnoozedUntil?: string | null;
  setAssignmentReminderSnoozedUntil?: boolean;
  assignmentOverdueRepeatHours?: number;
  channelEventNotifications?: boolean;
  messageUpdateNotifications?: boolean;
  sharePresence?: boolean;
  shareTyping?: boolean;
  shareReadReceipts?: boolean;
}) {
  const result = await pool.query<ConversationSettingsRecord>(
    `INSERT INTO conversation_user_settings (
       conversation_id,
       user_id,
       muted_until,
       blocked,
       mention_notifications,
       assignment_reminder_mode,
       assignment_reminder_snoozed_until,
       assignment_overdue_repeat_hours,
       channel_event_notifications,
       message_update_notifications,
       share_presence,
       share_typing,
       share_read_receipts,
       updated_at
     )
     VALUES (
       $1,
       $2,
       CASE WHEN $5::boolean THEN $3::timestamptz ELSE NULL END,
       COALESCE($4, false),
       COALESCE($6, true),
       COALESCE($7, '72h'),
       CASE WHEN $9::boolean THEN $8::timestamptz ELSE NULL END,
       COALESCE($10::int, 24),
       COALESCE($11, true),
       COALESCE($12, true),
       COALESCE($13, true),
       COALESCE($14, true),
       COALESCE($15, true),
       NOW()
     )
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET
       muted_until = CASE
         WHEN $5::boolean THEN $3::timestamptz
         ELSE conversation_user_settings.muted_until
       END,
       blocked = COALESCE($4, conversation_user_settings.blocked),
       mention_notifications = COALESCE($6, conversation_user_settings.mention_notifications),
       assignment_reminder_mode = COALESCE($7, conversation_user_settings.assignment_reminder_mode),
       assignment_reminder_snoozed_until = CASE
         WHEN $9::boolean THEN $8::timestamptz
         ELSE conversation_user_settings.assignment_reminder_snoozed_until
       END,
      assignment_overdue_repeat_hours = COALESCE(
        $10::int,
        conversation_user_settings.assignment_overdue_repeat_hours
      ),
      channel_event_notifications = COALESCE(
        $11,
        conversation_user_settings.channel_event_notifications
      ),
      message_update_notifications = COALESCE(
        $12,
        conversation_user_settings.message_update_notifications
      ),
      share_presence = COALESCE(
        $13,
        conversation_user_settings.share_presence
      ),
      share_typing = COALESCE(
        $14,
        conversation_user_settings.share_typing
      ),
      share_read_receipts = COALESCE(
        $15,
        conversation_user_settings.share_read_receipts
      ),
      updated_at = NOW()
     RETURNING
       conversation_id,
       user_id,
       muted_until,
       blocked,
       mention_notifications,
       assignment_reminder_mode,
       assignment_reminder_snoozed_until,
       assignment_overdue_repeat_hours,
       channel_event_notifications,
       message_update_notifications,
       share_presence,
       share_typing,
       share_read_receipts,
       updated_at`,
    [
      input.conversationId,
      input.userId,
      input.mutedUntil ?? null,
      input.blocked ?? null,
      input.setMutedUntil ?? false,
      input.mentionNotifications ?? null,
      input.assignmentReminderMode ?? null,
      input.assignmentReminderSnoozedUntil ?? null,
      input.setAssignmentReminderSnoozedUntil ?? false,
      input.assignmentOverdueRepeatHours ?? null,
      input.channelEventNotifications ?? null,
      input.messageUpdateNotifications ?? null,
      input.sharePresence ?? null,
      input.shareTyping ?? null,
      input.shareReadReceipts ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function claimDueAssignmentReminders(input?: {
  nowIso?: string;
  limit?: number;
}): Promise<AssignmentReminderDispatchRecord[]> {
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const limit = Math.max(1, Math.min(input?.limit ?? 300, 2000));
  const result = await pool.query<AssignmentReminderDispatchRecord>(
    `WITH base_rows AS (
       SELECT
         c.id AS conversation_id,
         c.name AS conversation_name,
         cp.user_id,
         c.assignment_title,
         c.assignment_due_at,
         settings.assignment_reminder_mode,
         settings.assignment_reminder_snoozed_until,
         COALESCE(settings.assignment_overdue_repeat_hours, 24)::int AS assignment_overdue_repeat_hours
       FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id
       JOIN conversation_user_settings settings
         ON settings.conversation_id = cp.conversation_id
        AND settings.user_id = cp.user_id
       WHERE c.type = 'channel'
         AND c.archived_at IS NULL
         AND c.assignment_due_at IS NOT NULL
         AND settings.blocked = false
         AND settings.assignment_reminder_mode <> 'off'
     ),
     reminder_windows AS (
       SELECT
         conversation_id,
         conversation_name,
         user_id,
         assignment_title,
         assignment_due_at,
         '72h'::text AS reminder_kind,
         assignment_overdue_repeat_hours
       FROM base_rows
       WHERE assignment_reminder_mode = '72h'
         AND (
           assignment_reminder_snoozed_until IS NULL
           OR assignment_reminder_snoozed_until <= $1::timestamptz
         )
         AND assignment_due_at > $1::timestamptz
         AND assignment_due_at <= ($1::timestamptz + INTERVAL '72 hours')
       UNION ALL
       SELECT
         conversation_id,
         conversation_name,
         user_id,
         assignment_title,
         assignment_due_at,
         '24h'::text AS reminder_kind,
         assignment_overdue_repeat_hours
       FROM base_rows
       WHERE assignment_reminder_mode = '24h'
         AND (
           assignment_reminder_snoozed_until IS NULL
           OR assignment_reminder_snoozed_until <= $1::timestamptz
         )
         AND assignment_due_at > $1::timestamptz
         AND assignment_due_at <= ($1::timestamptz + INTERVAL '24 hours')
       UNION ALL
       SELECT
         conversation_id,
         conversation_name,
         user_id,
         assignment_title,
         assignment_due_at,
         'overdue'::text AS reminder_kind,
         assignment_overdue_repeat_hours
       FROM base_rows
       WHERE (
           assignment_reminder_snoozed_until IS NULL
           OR assignment_reminder_snoozed_until <= $1::timestamptz
         )
         AND assignment_due_at <= $1::timestamptz
     ),
     pending_windows AS (
       SELECT
         reminder_windows.conversation_id,
         reminder_windows.conversation_name,
         reminder_windows.user_id,
         reminder_windows.assignment_title,
         reminder_windows.assignment_due_at,
         reminder_windows.reminder_kind,
         reminder_windows.assignment_overdue_repeat_hours
       FROM reminder_windows
       LEFT JOIN assignment_reminder_deliveries delivered
         ON delivered.conversation_id = reminder_windows.conversation_id
        AND delivered.user_id = reminder_windows.user_id
        AND delivered.reminder_kind = reminder_windows.reminder_kind
        AND delivered.assignment_due_at = reminder_windows.assignment_due_at
       WHERE (
           (
             reminder_windows.reminder_kind IN ('72h', '24h')
             AND delivered.conversation_id IS NULL
           )
           OR (
             reminder_windows.reminder_kind = 'overdue'
             AND (
               delivered.conversation_id IS NULL
               OR delivered.sent_at
                 <= (
                   $1::timestamptz
                   - (reminder_windows.assignment_overdue_repeat_hours::text || ' hours')::interval
                 )
             )
           )
         )
     ),
     limited_windows AS (
       SELECT
         conversation_id,
         conversation_name,
         user_id,
         assignment_title,
         assignment_due_at,
         reminder_kind,
         assignment_overdue_repeat_hours
       FROM pending_windows
       ORDER BY assignment_due_at ASC, conversation_id, user_id, reminder_kind
       LIMIT $2
     ),
     inserted AS (
       INSERT INTO assignment_reminder_deliveries (
         conversation_id,
         user_id,
         reminder_kind,
         assignment_due_at,
         sent_at,
         overdue_repeat_hours_snapshot
       )
       SELECT
         conversation_id,
         user_id,
         reminder_kind,
         assignment_due_at,
         $1::timestamptz,
         assignment_overdue_repeat_hours
       FROM limited_windows
       ON CONFLICT (conversation_id, user_id, reminder_kind, assignment_due_at)
       DO UPDATE
         SET
           sent_at = EXCLUDED.sent_at,
           overdue_repeat_hours_snapshot = EXCLUDED.overdue_repeat_hours_snapshot
       WHERE
         EXCLUDED.reminder_kind = 'overdue'
         AND assignment_reminder_deliveries.reminder_kind = 'overdue'
         AND assignment_reminder_deliveries.sent_at <= (
           EXCLUDED.sent_at
           - (EXCLUDED.overdue_repeat_hours_snapshot::text || ' hours')::interval
         )
       RETURNING conversation_id, user_id, reminder_kind, assignment_due_at, sent_at
     )
     SELECT
       inserted.conversation_id,
       limited_windows.conversation_name,
       inserted.user_id,
       limited_windows.assignment_title,
       inserted.assignment_due_at,
       inserted.reminder_kind::text AS reminder_kind,
       inserted.sent_at
     FROM inserted
     JOIN limited_windows
       ON limited_windows.conversation_id = inserted.conversation_id
      AND limited_windows.user_id = inserted.user_id
      AND limited_windows.assignment_due_at = inserted.assignment_due_at
      AND limited_windows.reminder_kind = inserted.reminder_kind
     ORDER BY inserted.assignment_due_at ASC, inserted.conversation_id, inserted.user_id`,
    [nowIso, limit]
  );
  return result.rows;
}

export async function storeAssignmentReminderNotifications(reminders: AssignmentReminderDispatchRecord[]) {
  if (!reminders.length) return;
  const rows = reminders.map((reminder) => ({
    user_id: reminder.user_id,
    conversation_id: reminder.conversation_id,
    reminder_kind: reminder.reminder_kind,
    assignment_title: reminder.assignment_title,
    assignment_due_at: reminder.assignment_due_at,
    source_sent_at: reminder.sent_at,
  }));
  await pool.query(
    `WITH input AS (
       SELECT *
       FROM jsonb_to_recordset($1::jsonb) AS x(
         user_id uuid,
         conversation_id uuid,
         reminder_kind text,
         assignment_title text,
         assignment_due_at timestamptz,
         source_sent_at timestamptz
       )
     )
     INSERT INTO assignment_reminder_notifications (
       user_id,
       conversation_id,
       reminder_kind,
       assignment_title,
       assignment_due_at,
       source_sent_at
     )
     SELECT
       user_id,
       conversation_id,
       reminder_kind,
       assignment_title,
       assignment_due_at,
       source_sent_at
     FROM input
     ON CONFLICT (user_id, conversation_id, reminder_kind, assignment_due_at)
     DO UPDATE
       SET
         assignment_title = EXCLUDED.assignment_title,
         source_sent_at = EXCLUDED.source_sent_at,
         read_at = NULL,
         created_at = NOW()
     WHERE EXCLUDED.reminder_kind = 'overdue'`,
    [JSON.stringify(rows)]
  );
}

export async function getMessageById(messageId: string): Promise<MessageRecord | null> {
  const result = await pool.query<MessageRecord>(
    `SELECT m.id,
            m.conversation_id,
            m.sender_id,
            m.body,
            m.created_at,
            m.pinned_at,
            m.pinned_by,
            m.parent_message_id,
            m.edited_at,
            m.deleted_at,
            m.deleted_by,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name,
            COALESCE(
              (
                SELECT ARRAY_AGG(mm.mentioned_user_id::text)
                FROM message_mentions mm
                WHERE mm.message_id = m.id
              ),
              ARRAY[]::text[]
            ) AS mention_user_ids
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1
     LIMIT 1`,
    [messageId]
  );
  return result.rows[0] ? decryptMessageRecord(result.rows[0]) : null;
}

export async function createMessageReport(messageId: string, reporterId: string, reason: string) {
  const result = await pool.query(
    `INSERT INTO message_reports (message_id, reporter_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, reporter_id)
     DO UPDATE SET reason = EXCLUDED.reason, created_at = NOW()
     RETURNING *`,
    [messageId, reporterId, reason]
  );
  return result.rows[0] ?? null;
}

export async function editMessageBody(
  messageId: string,
  senderId: string,
  body: string,
  options?: { mentionUserIds?: string[] }
): Promise<MessageRecord | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<MessageRecord>(
      `UPDATE messages m
       SET body = $3,
           edited_at = NOW()
       FROM users u
       WHERE m.id = $1
         AND m.sender_id = $2
         AND m.deleted_at IS NULL
         AND u.id = m.sender_id
       RETURNING
         m.id,
         m.conversation_id,
         m.sender_id,
         m.body,
         m.created_at,
         m.pinned_at,
         m.pinned_by,
         m.parent_message_id,
         m.edited_at,
         m.deleted_at,
         m.deleted_by,
         COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name`,
      [messageId, senderId, encryptMessageBody(body)]
    );
    const message = result.rows[0] ?? null;
    if (!message) {
      await client.query("ROLLBACK");
      return null;
    }

    const participantsResult = await client.query<{ user_id: string }>(
      `SELECT user_id
       FROM conversation_participants
       WHERE conversation_id = $1`,
      [message.conversation_id]
    );
    const recipientIds = participantsResult.rows
      .map((row) => row.user_id)
      .filter((participantId) => participantId !== senderId);
    const mentionUserIds = Array.from(new Set(options?.mentionUserIds ?? [])).filter((id) =>
      recipientIds.includes(id)
    );

    await client.query(`DELETE FROM message_mentions WHERE message_id = $1`, [messageId]);
    if (mentionUserIds.length > 0) {
      await client.query(
        `INSERT INTO message_mentions (message_id, conversation_id, mentioned_user_id)
         SELECT $1::uuid, $2::uuid, UNNEST($3::uuid[])
         ON CONFLICT (message_id, mentioned_user_id) DO NOTHING`,
        [message.id, message.conversation_id, mentionUserIds]
      );
    }

    await client.query("COMMIT");
    const hydrated = await hydrateMessageRows([message], senderId);
    return hydrated[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteMessage(messageId: string, senderId: string): Promise<MessageRecord | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<MessageRecord>(
      `UPDATE messages m
       SET body = $3,
           edited_at = COALESCE(m.edited_at, NOW()),
           deleted_at = COALESCE(m.deleted_at, NOW()),
           deleted_by = $2
       FROM users u
       WHERE m.id = $1
         AND m.sender_id = $2
         AND m.deleted_at IS NULL
         AND u.id = m.sender_id
       RETURNING
         m.id,
         m.conversation_id,
         m.sender_id,
         m.body,
         m.created_at,
         m.pinned_at,
         m.pinned_by,
         m.parent_message_id,
         m.edited_at,
         m.deleted_at,
         m.deleted_by,
         COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name`,
      [messageId, senderId, encryptMessageBody("[message deleted]")]
    );
    const message = result.rows[0] ?? null;
    if (!message) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(`DELETE FROM message_mentions WHERE message_id = $1`, [messageId]);
    await client.query("COMMIT");
    const hydrated = await hydrateMessageRows([message], senderId);
    return hydrated[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleMessageReaction(
  messageId: string,
  conversationId: string,
  userId: string,
  emoji: string
): Promise<{ message: MessageRecord | null; reacted: boolean }> {
  const normalizedEmoji = emoji.trim();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await client.query(
      `DELETE FROM message_reactions
       WHERE message_id = $1
         AND conversation_id = $2
         AND user_id = $3
         AND emoji = $4`,
      [messageId, conversationId, userId, normalizedEmoji]
    );

    let reacted = false;
    if (removed.rowCount === 0) {
      await client.query(
        `INSERT INTO message_reactions (message_id, conversation_id, user_id, emoji)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [messageId, conversationId, userId, normalizedEmoji]
      );
      reacted = true;
    }

    const messageResult = await client.query<MessageRecord>(
      `SELECT m.id,
              m.conversation_id,
              m.sender_id,
              m.body,
              m.created_at,
              m.pinned_at,
              m.pinned_by,
              m.parent_message_id,
              m.edited_at,
              m.deleted_at,
              m.deleted_by,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1
         AND m.conversation_id = $2
       LIMIT 1`,
      [messageId, conversationId]
    );
    const message = messageResult.rows[0] ?? null;
    await client.query("COMMIT");

    if (!message) {
      return { message: null, reacted };
    }
    const hydrated = await hydrateMessageRows([message], userId);
    return { message: hydrated[0] ?? null, reacted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type ListPinnedMessagesOptions = {
  limit?: number;
};

export async function listPinnedMessages(
  conversationId: string,
  options: ListPinnedMessagesOptions = {},
  viewerUserId?: string
): Promise<MessageRecord[]> {
  if (viewerUserId) {
    await markConversationMessagesDelivered(conversationId, viewerUserId);
  }

  const limit = Math.min(options.limit ?? 25, 100);
  const result = await pool.query<MessageRecord>(
    `SELECT m.id,
            m.conversation_id,
            m.sender_id,
            m.body,
            m.created_at,
            m.pinned_at,
            m.pinned_by,
            m.parent_message_id,
            m.edited_at,
            m.deleted_at,
            m.deleted_by,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND m.pinned_at IS NOT NULL
     ORDER BY m.pinned_at DESC, m.created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );

  if (result.rows.length === 0) return [];
  return hydrateMessageRows(result.rows, viewerUserId);
}

export async function pinMessage(messageId: string, pinnedByUserId: string): Promise<MessageRecord | null> {
  const result = await pool.query<MessageRecord>(
    `UPDATE messages m
     SET pinned_at = COALESCE(m.pinned_at, NOW()),
         pinned_by = $2
     FROM users u
     WHERE m.id = $1
       AND u.id = m.sender_id
       RETURNING
       m.id,
       m.conversation_id,
       m.sender_id,
       m.body,
       m.created_at,
       m.pinned_at,
       m.pinned_by,
       m.parent_message_id,
       m.edited_at,
       m.deleted_at,
       m.deleted_by,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name`,
    [messageId, pinnedByUserId]
  );

  const message = result.rows[0] ?? null;
  if (!message) return null;
  const hydrated = await hydrateMessageRows([message], pinnedByUserId);
  return hydrated[0] ?? null;
}

export async function unpinMessage(messageId: string, viewerUserId?: string): Promise<MessageRecord | null> {
  const result = await pool.query<MessageRecord>(
    `UPDATE messages m
     SET pinned_at = NULL,
         pinned_by = NULL
     FROM users u
     WHERE m.id = $1
       AND u.id = m.sender_id
       RETURNING
       m.id,
       m.conversation_id,
       m.sender_id,
       m.body,
       m.created_at,
       m.pinned_at,
       m.pinned_by,
       m.parent_message_id,
       m.edited_at,
       m.deleted_at,
       m.deleted_by,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name`,
    [messageId]
  );

  const message = result.rows[0] ?? null;
  if (!message) return null;
  const hydrated = await hydrateMessageRows([message], viewerUserId);
  return hydrated[0] ?? null;
}

export type ConversationArchiveRecord = {
  id: string;
  type: ConversationType;
  archived_at: string | null;
  archived_by: string | null;
};

export type ChannelConversationDetailsRecord = {
  id: string;
  name: string;
  type: ConversationType;
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
  assignment_title: string | null;
  assignment_description: string | null;
  assignment_due_at: string | null;
  assignment_template: Record<string, unknown> | null;
};

export async function archiveConversation(
  conversationId: string,
  archivedByUserId: string
): Promise<ConversationArchiveRecord | null> {
  const result = await pool.query<ConversationArchiveRecord>(
    `UPDATE conversations
     SET archived_at = COALESCE(archived_at, NOW()),
         archived_by = $2
     WHERE id = $1
     RETURNING id, type, archived_at, archived_by`,
    [conversationId, archivedByUserId]
  );
  return result.rows[0] ?? null;
}

export async function unarchiveConversation(conversationId: string): Promise<ConversationArchiveRecord | null> {
  const result = await pool.query<ConversationArchiveRecord>(
    `UPDATE conversations
     SET archived_at = NULL,
         archived_by = NULL
     WHERE id = $1
     RETURNING id, type, archived_at, archived_by`,
    [conversationId]
  );
  return result.rows[0] ?? null;
}

export async function updateChannelConversationDetails(
  conversationId: string,
  updates: {
    name?: string;
    assignmentTitle?: string;
    assignmentDescription?: string | null;
    assignmentDueAt?: string | null;
    assignmentTemplate?: Record<string, unknown> | null;
  }
): Promise<ChannelConversationDetailsRecord | null> {
  const setName = updates.name !== undefined;
  const setAssignmentTitle = updates.assignmentTitle !== undefined;
  const setAssignmentDescription = updates.assignmentDescription !== undefined;
  const setAssignmentDueAt = updates.assignmentDueAt !== undefined;
  const setAssignmentTemplate = updates.assignmentTemplate !== undefined;

  const result = await pool.query<ChannelConversationDetailsRecord>(
    `UPDATE conversations
     SET name = CASE WHEN $2::boolean THEN $3 ELSE name END,
         assignment_title = CASE WHEN $4::boolean THEN $5 ELSE assignment_title END,
         assignment_description = CASE WHEN $6::boolean THEN $7 ELSE assignment_description END,
         assignment_due_at = CASE WHEN $8::boolean THEN $9 ELSE assignment_due_at END,
         assignment_template = CASE WHEN $10::boolean THEN $11::jsonb ELSE assignment_template END
     WHERE id = $1
       AND type = 'channel'
     RETURNING
       id,
       name,
       type,
       created_at,
       archived_at,
       archived_by,
       assignment_title,
       assignment_description,
       assignment_due_at,
       assignment_template`,
    [
      conversationId,
      setName,
      updates.name ?? null,
      setAssignmentTitle,
      updates.assignmentTitle ?? null,
      setAssignmentDescription,
      updates.assignmentDescription ?? null,
      setAssignmentDueAt,
      updates.assignmentDueAt ?? null,
      setAssignmentTemplate,
      updates.assignmentTemplate !== undefined ? JSON.stringify(updates.assignmentTemplate) : null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function createConversation(
  name: string,
  type: ConversationType,
  participantIds: string[],
  options?: {
    assignmentTitle?: string | null;
    assignmentDescription?: string | null;
    assignmentDueAt?: string | null;
    assignmentTemplate?: Record<string, unknown> | null;
    createdByUserId?: string | null;
  }
): Promise<ConversationRecord> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const convResult = await client.query<ConversationRecord>(
      `INSERT INTO conversations (
         name,
         type,
         assignment_title,
         assignment_description,
         assignment_due_at,
         assignment_template
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING
         id,
         name,
         type,
         created_at,
         archived_at,
         archived_by,
         assignment_title,
         assignment_description,
         assignment_due_at,
         assignment_template`,
      [
        name,
        type,
        options?.assignmentTitle ?? null,
        options?.assignmentDescription ?? null,
        options?.assignmentDueAt ?? null,
        options?.assignmentTemplate ? JSON.stringify(options.assignmentTemplate) : null,
      ]
    );
    const conversation = convResult.rows[0];
    for (const userId of participantIds) {
      let participantRole: ConversationParticipantRole = "member";
      if (type === "channel") {
        participantRole = userId === options?.createdByUserId ? "owner" : "editor";
      }

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET role = EXCLUDED.role`,
        [conversation.id, userId, participantRole]
      );
      await client.query(
        `INSERT INTO conversation_presence (
           conversation_id,
           user_id,
           is_online,
           last_active_at,
           last_read_at,
           updated_at
         )
         VALUES ($1, $2, false, NOW(), NOW(), NOW())
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversation.id, userId]
      );
      await client.query(
        `INSERT INTO conversation_user_settings (
           conversation_id,
           user_id,
           blocked,
           mention_notifications,
           assignment_reminder_mode,
           assignment_reminder_snoozed_until,
           assignment_overdue_repeat_hours,
           channel_event_notifications,
           message_update_notifications,
           share_presence,
           share_typing,
           share_read_receipts,
           updated_at
         )
         VALUES ($1, $2, false, true, '72h', NULL, 24, true, true, true, true, true, NOW())
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversation.id, userId]
      );
    }
    await client.query("COMMIT");
    return conversation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function addParticipant(
  conversationId: string,
  userId: string,
  role: ConversationParticipantRole = "member"
) {
  await pool.query(
    `INSERT INTO conversation_participants (conversation_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET role = EXCLUDED.role`,
    [conversationId, userId, role]
  );
  await pool.query(
    `INSERT INTO conversation_presence (
       conversation_id,
       user_id,
       is_online,
       last_active_at,
       last_read_at,
       updated_at
     )
     VALUES ($1, $2, false, NOW(), NOW(), NOW())
     ON CONFLICT (conversation_id, user_id) DO NOTHING`,
    [conversationId, userId]
  );
  await pool.query(
    `INSERT INTO conversation_user_settings (
       conversation_id,
       user_id,
       blocked,
       mention_notifications,
       assignment_reminder_mode,
       assignment_reminder_snoozed_until,
       assignment_overdue_repeat_hours,
       channel_event_notifications,
       message_update_notifications,
       share_presence,
       share_typing,
       share_read_receipts,
       updated_at
     )
     VALUES ($1, $2, false, true, '72h', NULL, 24, true, true, true, true, true, NOW())
     ON CONFLICT (conversation_id, user_id) DO NOTHING`,
    [conversationId, userId]
  );
}

export async function removeParticipant(conversationId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removedResult = await client.query<{
      conversation_id: string;
      user_id: string;
      role: ConversationParticipantRole;
    }>(
      `DELETE FROM conversation_participants
       WHERE conversation_id = $1
         AND user_id = $2
       RETURNING conversation_id, user_id, role`,
      [conversationId, userId]
    );
    const removed = removedResult.rows[0] ?? null;
    if (!removed) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `DELETE FROM conversation_presence
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, userId]
    );
    await client.query(
      `DELETE FROM conversation_user_settings
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, userId]
    );

    await client.query("COMMIT");
    return removed;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getConversationById(conversationId: string): Promise<ConversationSummaryRecord | null> {
  const result = await pool.query<ConversationSummaryRecord>(
    `SELECT id, type, archived_at, archived_by
     FROM conversations
     WHERE id = $1
     LIMIT 1`,
    [conversationId]
  );
  return result.rows[0] ?? null;
}

export async function getConversationDetailsById(
  conversationId: string
): Promise<ConversationDetailsRecord | null> {
  const result = await pool.query<ConversationDetailsRecord>(
    `SELECT
       id,
       name,
       type,
       archived_at,
       archived_by,
       assignment_title,
       assignment_description,
       assignment_due_at,
       assignment_template
     FROM conversations
     WHERE id = $1
     LIMIT 1`,
    [conversationId]
  );
  return result.rows[0] ?? null;
}

export async function getConversationParticipantRole(
  conversationId: string,
  userId: string
): Promise<ConversationParticipantRole | null> {
  const result = await pool.query<{ role: ConversationParticipantRole }>(
    `SELECT role
     FROM conversation_participants
     WHERE conversation_id = $1
       AND user_id = $2
     LIMIT 1`,
    [conversationId, userId]
  );
  return result.rows[0]?.role ?? null;
}

export async function countConversationParticipantsByRole(
  conversationId: string,
  role: ConversationParticipantRole
): Promise<number> {
  const result = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM conversation_participants
     WHERE conversation_id = $1
       AND role = $2`,
    [conversationId, role]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function updateConversationParticipantRole(
  conversationId: string,
  userId: string,
  role: ConversationParticipantRole
) {
  const result = await pool.query<{ conversation_id: string; user_id: string; role: ConversationParticipantRole }>(
    `UPDATE conversation_participants
     SET role = $3
     WHERE conversation_id = $1
       AND user_id = $2
     RETURNING conversation_id, user_id, role`,
    [conversationId, userId, role]
  );
  return result.rows[0] ?? null;
}

export async function createMessage(
  conversationId: string,
  senderId: string,
  body: string | null,
  options?: {
    mentionUserIds?: string[];
    parentMessageId?: string | null;
  }
): Promise<MessageRecord> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let replyTo: MessageReplyPreview | null = null;
    if (options?.parentMessageId) {
      const parentResult = await client.query<{
        id: string;
        sender_id: string;
        sender_name: string;
        body: string | null;
        deleted_at: string | null;
        created_at: string;
      }>(
        `SELECT
           m.id,
           m.sender_id,
           COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name,
           m.body,
           m.deleted_at,
           m.created_at
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.id = $1
           AND m.conversation_id = $2
         LIMIT 1`,
        [options.parentMessageId, conversationId]
      );
      const parent = parentResult.rows[0];
      if (!parent) {
        throw new Error("Reply target not found in this conversation.");
      }
      replyTo = {
        id: parent.id,
        sender_id: parent.sender_id,
        sender_name: parent.sender_name,
        body: decryptMessageBody(parent.body),
        deleted_at: parent.deleted_at,
        created_at: parent.created_at,
      };
    }
    const result = await client.query<MessageRecord>(
       `WITH inserted AS (
         INSERT INTO messages (conversation_id, sender_id, body, parent_message_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, conversation_id, sender_id, body, created_at, pinned_at, pinned_by, parent_message_id, edited_at, deleted_at, deleted_by
       )
       SELECT inserted.id,
              inserted.conversation_id,
              inserted.sender_id,
              inserted.body,
              inserted.created_at,
              inserted.pinned_at,
              inserted.pinned_by,
              inserted.parent_message_id,
              inserted.edited_at,
              inserted.deleted_at,
              inserted.deleted_by,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name
       FROM inserted
       JOIN users u ON u.id = inserted.sender_id`,
      [conversationId, senderId, encryptMessageBody(body), options?.parentMessageId ?? null]
    );
    const message = result.rows[0];

    const participantsResult = await client.query<{ user_id: string }>(
      `SELECT user_id
       FROM conversation_participants
       WHERE conversation_id = $1`,
      [conversationId]
    );
    const recipientIds = participantsResult.rows
      .map((row) => row.user_id)
      .filter((participantId) => participantId !== senderId);

    if (recipientIds.length > 0) {
      await client.query(
        `INSERT INTO message_receipts (message_id, conversation_id, recipient_id, updated_at)
         SELECT $1::uuid, $2::uuid, UNNEST($3::uuid[]), NOW()
         ON CONFLICT (message_id, recipient_id)
         DO UPDATE SET updated_at = NOW()`,
        [message.id, conversationId, recipientIds]
      );
    }

    const mentionUserIds = Array.from(new Set(options?.mentionUserIds ?? [])).filter((id) =>
      recipientIds.includes(id)
    );
    if (mentionUserIds.length > 0) {
      await client.query(
        `INSERT INTO message_mentions (message_id, conversation_id, mentioned_user_id)
         SELECT $1::uuid, $2::uuid, UNNEST($3::uuid[])
         ON CONFLICT (message_id, mentioned_user_id) DO NOTHING`,
        [message.id, conversationId, mentionUserIds]
      );
    }

    await client.query("COMMIT");
    return {
      ...decryptMessageRecord(message),
      reply_to: replyTo,
      attachments: [],
      mention_user_ids: mentionUserIds,
      delivery_status: "sent",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createMessageAttachment(input: {
  messageId: string;
  conversationId: string;
  uploaderId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  kind: MessageAttachmentKind;
  durationSeconds?: number | null;
  scanStatus?: "pending" | "clean" | "blocked";
  scanReason?: string | null;
  scannedAt?: string | null;
}): Promise<MessageAttachmentRecord> {
  const result = await pool.query<MessageAttachmentRecord>(
    `INSERT INTO message_attachments (
       message_id,
       conversation_id,
       uploader_id,
       file_name,
       storage_path,
       mime_type,
       size_bytes,
       kind,
       duration_seconds,
       scan_status,
       scan_reason,
       scanned_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING
       id,
       message_id,
       conversation_id,
       uploader_id,
       file_name,
       mime_type,
       size_bytes::double precision AS size_bytes,
       kind,
       duration_seconds::double precision AS duration_seconds,
       scan_status,
       scan_reason,
       scanned_at,
       created_at`,
    [
      input.messageId,
      input.conversationId,
      input.uploaderId,
      input.fileName,
      input.storagePath,
      input.mimeType,
      input.sizeBytes,
      input.kind,
      input.durationSeconds ?? null,
      input.scanStatus ?? "pending",
      input.scanReason ?? null,
      input.scannedAt ?? null,
    ]
  );
  return result.rows[0];
}

export async function setMessageAttachmentScanResult(input: {
  attachmentId: string;
  scanStatus: "pending" | "clean" | "blocked";
  scanReason?: string | null;
  scannedAt?: string | null;
}) {
  const result = await pool.query<MessageAttachmentRecord>(
    `UPDATE message_attachments
     SET scan_status = $2,
         scan_reason = $3,
         scanned_at = COALESCE($4::timestamptz, NOW())
     WHERE id = $1
     RETURNING
       id,
       message_id,
       conversation_id,
       uploader_id,
       file_name,
       mime_type,
       size_bytes::double precision AS size_bytes,
       kind,
       duration_seconds::double precision AS duration_seconds,
       scan_status,
       scan_reason,
       scanned_at,
       created_at`,
    [
      input.attachmentId,
      input.scanStatus,
      input.scanReason ?? null,
      input.scannedAt ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function getMessageAttachmentById(
  attachmentId: string
): Promise<MessageAttachmentFileRecord | null> {
  const result = await pool.query<MessageAttachmentFileRecord>(
    `SELECT
       id,
       message_id,
       conversation_id,
       uploader_id,
       file_name,
       storage_path,
       mime_type,
       size_bytes::double precision AS size_bytes,
       kind,
       duration_seconds::double precision AS duration_seconds,
       scan_status,
       scan_reason,
       scanned_at,
       created_at
     FROM message_attachments
     WHERE id = $1
     LIMIT 1`,
    [attachmentId]
  );
  return result.rows[0] ?? null;
}

export async function listFollowedUsers(
  userId: string,
  query: string,
  limit = 20,
  offset = 0,
  role = "learner"
): Promise<FollowedUserRecord[]> {
  const normalized = query.trim();
  const search = `%${normalized}%`;
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const safeOffset = Math.max(0, Math.floor(offset));
  const normalizedRole = role.trim().toLowerCase();
  const result = await pool.query<FollowedUserRecord>(
    `WITH peer_activity AS (
       SELECT
         cp_other.user_id,
         MAX(m.created_at) AS last_interaction_at,
         COUNT(*)::int AS message_count
       FROM conversations c
       JOIN conversation_participants cp_self
         ON cp_self.conversation_id = c.id
        AND cp_self.user_id = $1
       JOIN conversation_participants cp_other
         ON cp_other.conversation_id = c.id
        AND cp_other.user_id <> $1
       JOIN messages m ON m.conversation_id = c.id
       WHERE m.created_at >= NOW() - INTERVAL '90 days'
         AND (m.sender_id = $1 OR m.sender_id = cp_other.user_id)
       GROUP BY cp_other.user_id
     )
     SELECT
       u.id AS user_id,
       u.email,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS name,
       up.username
     FROM friends f
     JOIN users u ON u.id = f.friend_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN peer_activity pa ON pa.user_id = u.id
     WHERE f.user_id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM user_relationships rel
         WHERE rel.relationship_type = 'blocked'
           AND (
             (rel.user_id = $1 AND rel.target_user_id = u.id)
             OR
             (rel.user_id = u.id AND rel.target_user_id = $1)
           )
       )
        AND (
          $2::text = ''
          OR u.email ILIKE $3
         OR COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) ILIKE $3
         OR COALESCE(up.username, '') ILIKE $3
       )
     ORDER BY (
       CASE
         WHEN $6::text = 'tutor' THEN (
           CASE WHEN $2::text <> '' AND LOWER(COALESCE(up.username, '')) = LOWER($2::text) THEN 180 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(COALESCE(up.username, '')) LIKE LOWER($2::text) || '%' THEN 60 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)) LIKE LOWER($2::text) || '%' THEN 45 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(u.email) LIKE LOWER($2::text) || '%' THEN 35 ELSE 0 END
           + LEAST(COALESCE(pa.message_count, 0), 30) * 4
           + CASE
               WHEN pa.last_interaction_at >= NOW() - INTERVAL '7 days' THEN 40
               WHEN pa.last_interaction_at >= NOW() - INTERVAL '30 days' THEN 20
               ELSE 0
             END
         )
         WHEN $6::text = 'admin' THEN (
           CASE WHEN $2::text <> '' AND LOWER(COALESCE(up.username, '')) = LOWER($2::text) THEN 180 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(COALESCE(up.username, '')) LIKE LOWER($2::text) || '%' THEN 55 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)) LIKE LOWER($2::text) || '%' THEN 45 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(u.email) LIKE LOWER($2::text) || '%' THEN 35 ELSE 0 END
           + LEAST(COALESCE(pa.message_count, 0), 30) * 3
           + CASE
               WHEN pa.last_interaction_at >= NOW() - INTERVAL '7 days' THEN 30
               WHEN pa.last_interaction_at >= NOW() - INTERVAL '30 days' THEN 15
               ELSE 0
             END
         )
         ELSE (
           CASE WHEN $2::text <> '' AND LOWER(COALESCE(up.username, '')) = LOWER($2::text) THEN 180 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(COALESCE(up.username, '')) LIKE LOWER($2::text) || '%' THEN 60 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)) LIKE LOWER($2::text) || '%' THEN 40 ELSE 0 END
           + CASE WHEN $2::text <> '' AND LOWER(u.email) LIKE LOWER($2::text) || '%' THEN 30 ELSE 0 END
           + LEAST(COALESCE(pa.message_count, 0), 30) * 3
           + CASE
               WHEN pa.last_interaction_at >= NOW() - INTERVAL '7 days' THEN 35
               WHEN pa.last_interaction_at >= NOW() - INTERVAL '30 days' THEN 18
               ELSE 0
             END
         )
       END
     ) DESC,
     COALESCE(pa.last_interaction_at, TO_TIMESTAMP(0)) DESC,
     name ASC
     LIMIT $4
     OFFSET $5`,
    [userId, normalized, search, safeLimit, safeOffset, normalizedRole]
  );
  return result.rows;
}

export async function listInteractedUsers(
  userId: string,
  limit = 50,
  offset = 0,
  query = "",
  role = "learner"
): Promise<InteractedUserRecord[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safeOffset = Math.max(0, Math.floor(offset));
  const normalized = query.trim();
  const search = `%${normalized}%`;
  const normalizedRole = role.trim().toLowerCase();
  const result = await pool.query<InteractedUserRecord>(
    `WITH peer_messages AS (
       SELECT
         cp_other.user_id,
         MAX(m.created_at) AS last_interaction_at,
         COUNT(*)::int AS message_count
       FROM conversations c
       JOIN conversation_participants cp_self
         ON cp_self.conversation_id = c.id
        AND cp_self.user_id = $1
       JOIN conversation_participants cp_other
         ON cp_other.conversation_id = c.id
        AND cp_other.user_id <> $1
       JOIN messages m ON m.conversation_id = c.id
       WHERE m.sender_id = $1 OR m.sender_id = cp_other.user_id
       GROUP BY cp_other.user_id
     )
     SELECT
       pm.user_id,
       u.email,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS name,
       up.username,
       pm.last_interaction_at,
       pm.message_count
     FROM peer_messages pm
     JOIN users u ON u.id = pm.user_id
     LEFT JOIN user_profiles up ON up.user_id = pm.user_id
     WHERE NOT EXISTS (
       SELECT 1
       FROM user_relationships rel
       WHERE rel.relationship_type = 'blocked'
         AND (
           (rel.user_id = $1 AND rel.target_user_id = pm.user_id)
           OR
           (rel.user_id = pm.user_id AND rel.target_user_id = $1)
         )
     )
       AND (
         $4::text = ''
         OR u.email ILIKE $5
         OR COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) ILIKE $5
         OR COALESCE(up.username, '') ILIKE $5
       )
     ORDER BY (
       CASE
         WHEN $6::text = 'tutor' THEN (
           LEAST(pm.message_count, 60) * 4
           + CASE
               WHEN pm.last_interaction_at >= NOW() - INTERVAL '7 days' THEN 60
               WHEN pm.last_interaction_at >= NOW() - INTERVAL '30 days' THEN 30
               ELSE 0
             END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(up.username, '')) = LOWER($4::text) THEN 140 ELSE 0 END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(up.username, '')) LIKE LOWER($4::text) || '%' THEN 55 ELSE 0 END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)) LIKE LOWER($4::text) || '%' THEN 45 ELSE 0 END
         )
         WHEN $6::text = 'admin' THEN (
           LEAST(pm.message_count, 60) * 3
           + CASE
               WHEN pm.last_interaction_at >= NOW() - INTERVAL '7 days' THEN 45
               WHEN pm.last_interaction_at >= NOW() - INTERVAL '30 days' THEN 24
               ELSE 0
             END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(up.username, '')) = LOWER($4::text) THEN 140 ELSE 0 END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(up.username, '')) LIKE LOWER($4::text) || '%' THEN 50 ELSE 0 END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)) LIKE LOWER($4::text) || '%' THEN 40 ELSE 0 END
         )
         ELSE (
           LEAST(pm.message_count, 60) * 3
           + CASE
               WHEN pm.last_interaction_at >= NOW() - INTERVAL '7 days' THEN 50
               WHEN pm.last_interaction_at >= NOW() - INTERVAL '30 days' THEN 26
               ELSE 0
             END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(up.username, '')) = LOWER($4::text) THEN 140 ELSE 0 END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(up.username, '')) LIKE LOWER($4::text) || '%' THEN 52 ELSE 0 END
           + CASE WHEN $4::text <> '' AND LOWER(COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)) LIKE LOWER($4::text) || '%' THEN 42 ELSE 0 END
         )
       END
     ) DESC,
     pm.last_interaction_at DESC
     LIMIT $2
     OFFSET $3`,
    [userId, safeLimit, safeOffset, normalized, search, normalizedRole]
  );
  return result.rows;
}

export async function getWeeklyMessagingSnapshot(
  userId: string,
  options?: { windowDays?: number }
): Promise<WeeklyMessagingSnapshotRecord> {
  const requestedWindowDays = options?.windowDays ?? 7;
  const windowDays = Math.min(Math.max(Math.floor(requestedWindowDays), 1), 30);
  const result = await pool.query<WeeklyMessagingSnapshotRecord>(
    `WITH bounds AS (
       SELECT
         NOW() AS window_end,
         NOW() - ($2::int * INTERVAL '1 day') AS window_start
     ),
     user_conversation_messages AS (
       SELECT
         c.id AS conversation_id,
         c.type,
         COUNT(*) FILTER (WHERE m.sender_id = $1)::int AS sent_count,
         COUNT(*) FILTER (WHERE m.sender_id <> $1)::int AS received_count
       FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id
        AND cp.user_id = $1
       JOIN messages m ON m.conversation_id = c.id
       JOIN bounds b ON true
       WHERE m.created_at >= b.window_start
         AND m.created_at <= b.window_end
       GROUP BY c.id, c.type
     ),
     collaborator_aggregate AS (
       SELECT COUNT(DISTINCT m.sender_id)::int AS collaborator_count
       FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id
        AND cp.user_id = $1
       JOIN messages m ON m.conversation_id = c.id
       JOIN bounds b ON true
       WHERE m.created_at >= b.window_start
         AND m.created_at <= b.window_end
         AND m.sender_id <> $1
     ),
     channel_due_aggregate AS (
       SELECT
         COUNT(*) FILTER (
           WHERE c.assignment_due_at IS NOT NULL
             AND c.assignment_due_at >= NOW()
             AND c.assignment_due_at <= NOW() + INTERVAL '72 hours'
             AND c.archived_at IS NULL
         )::int AS due_soon_channels,
         COUNT(*) FILTER (
           WHERE c.assignment_due_at IS NOT NULL
             AND c.assignment_due_at < NOW()
             AND c.archived_at IS NULL
         )::int AS overdue_channels
       FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id
        AND cp.user_id = $1
       WHERE c.type = 'channel'
     )
     SELECT
       $2::int AS window_days,
       (SELECT window_start FROM bounds) AS window_start,
       (SELECT window_end FROM bounds) AS window_end,
       COALESCE(SUM(ucm.sent_count), 0)::int AS sent_messages,
       COALESCE(SUM(ucm.received_count), 0)::int AS received_messages,
       COUNT(ucm.conversation_id)::int AS active_conversations,
       COALESCE(SUM(CASE WHEN ucm.type = 'direct' THEN 1 ELSE 0 END), 0)::int AS active_direct_conversations,
       COALESCE(SUM(CASE WHEN ucm.type = 'group' THEN 1 ELSE 0 END), 0)::int AS active_group_conversations,
       COALESCE(SUM(CASE WHEN ucm.type = 'channel' THEN 1 ELSE 0 END), 0)::int AS active_channel_conversations,
       COALESCE((SELECT collaborator_count FROM collaborator_aggregate), 0)::int AS collaborator_count,
       COALESCE((SELECT due_soon_channels FROM channel_due_aggregate), 0)::int AS due_soon_channels,
       COALESCE((SELECT overdue_channels FROM channel_due_aggregate), 0)::int AS overdue_channels
     FROM user_conversation_messages ucm`,
    [userId, windowDays]
  );
  return (
    result.rows[0] ?? {
      window_days: windowDays,
      window_start: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString(),
      window_end: new Date().toISOString(),
      sent_messages: 0,
      received_messages: 0,
      active_conversations: 0,
      active_direct_conversations: 0,
      active_group_conversations: 0,
      active_channel_conversations: 0,
      collaborator_count: 0,
      due_soon_channels: 0,
      overdue_channels: 0,
    }
  );
}

export async function countUnreadMentionNotifications(userId: string): Promise<number> {
  const result = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM message_mentions mm
     JOIN messages m ON m.id = mm.message_id
     JOIN conversation_participants cp
       ON cp.conversation_id = mm.conversation_id
      AND cp.user_id = $1
     LEFT JOIN message_receipts mr
       ON mr.message_id = mm.message_id
      AND mr.recipient_id = $1
     WHERE mm.mentioned_user_id = $1
       AND m.sender_id <> $1
       AND mr.read_at IS NULL`,
    [userId]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function listMentionNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<MentionNotificationRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  const unreadOnly = options?.unreadOnly ?? false;
  const result = await pool.query<MentionNotificationRecord>(
    `SELECT
       mm.message_id,
       mm.conversation_id,
       c.name AS conversation_name,
       m.sender_id,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS sender_name,
       m.body AS message_body,
       m.created_at AS message_created_at,
       (mr.read_at IS NULL) AS unread
     FROM message_mentions mm
     JOIN messages m ON m.id = mm.message_id
     JOIN conversations c ON c.id = mm.conversation_id
     JOIN users u ON u.id = m.sender_id
     JOIN conversation_participants cp
       ON cp.conversation_id = mm.conversation_id
      AND cp.user_id = $1
     LEFT JOIN message_receipts mr
       ON mr.message_id = mm.message_id
      AND mr.recipient_id = $1
     WHERE mm.mentioned_user_id = $1
       AND m.sender_id <> $1
       AND ($2::boolean = false OR mr.read_at IS NULL)
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [userId, unreadOnly, limit]
  );
  return result.rows.map((row) => ({
    ...row,
    message_body: decryptMessageBody(row.message_body),
  }));
}

export async function countUnreadAssignmentReminderNotifications(userId: string): Promise<number> {
  const result = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM assignment_reminder_notifications arn
     JOIN conversation_participants cp
       ON cp.conversation_id = arn.conversation_id
      AND cp.user_id = $1
     WHERE arn.user_id = $1
       AND arn.read_at IS NULL`,
    [userId]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function listAssignmentReminderNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<AssignmentReminderNotificationRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const unreadOnly = options?.unreadOnly ?? false;
  const result = await pool.query<AssignmentReminderNotificationRecord>(
    `SELECT
       arn.id,
       arn.conversation_id,
       c.name AS conversation_name,
       arn.reminder_kind::text AS reminder_kind,
       arn.assignment_title,
       arn.assignment_due_at,
       arn.source_sent_at,
       arn.created_at,
       arn.read_at,
       (arn.read_at IS NULL) AS unread
     FROM assignment_reminder_notifications arn
     JOIN conversations c ON c.id = arn.conversation_id
     JOIN conversation_participants cp
       ON cp.conversation_id = arn.conversation_id
      AND cp.user_id = $1
     WHERE arn.user_id = $1
       AND ($2::boolean = false OR arn.read_at IS NULL)
     ORDER BY arn.created_at DESC
     LIMIT $3`,
    [userId, unreadOnly, limit]
  );
  return result.rows;
}

export async function markAssignmentReminderNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `UPDATE assignment_reminder_notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1
       AND id = $2
     RETURNING id`,
    [userId, notificationId]
  );
  return Boolean(result.rows[0]?.id);
}

export async function markAllAssignmentReminderNotificationsRead(userId: string): Promise<number> {
  const result = await pool.query<{ updated_count: number }>(
    `WITH updated AS (
       UPDATE assignment_reminder_notifications
       SET read_at = NOW()
       WHERE user_id = $1
         AND read_at IS NULL
       RETURNING id
     )
     SELECT COUNT(*)::int AS updated_count
     FROM updated`,
    [userId]
  );
  return Number(result.rows[0]?.updated_count ?? 0);
}

export async function getFirstUnreadMessageId(
  conversationId: string,
  recipientId: string
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT m.id
     FROM messages m
     JOIN message_receipts mr
       ON mr.message_id = m.id
      AND mr.recipient_id = $2
     WHERE m.conversation_id = $1
       AND m.sender_id <> $2
       AND mr.read_at IS NULL
     ORDER BY m.created_at ASC, m.id ASC
     LIMIT 1`,
    [conversationId, recipientId]
  );
  return result.rows[0]?.id ?? null;
}

export async function createMessageActivityEvent(input: {
  conversationId: string;
  actorId: string | null;
  eventType: MessageActivityEventType;
  messageId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const result = await pool.query<ConversationActivityRecord>(
    `INSERT INTO message_activity_events (
       conversation_id,
       actor_id,
       event_type,
       message_id,
       metadata
     )
     VALUES ($1, $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb))
     RETURNING
       id,
       conversation_id,
       actor_id,
       NULL::text AS actor_name,
       event_type,
       message_id,
       NULL::text AS message_body,
       metadata,
       created_at`,
    [
      input.conversationId,
      input.actorId,
      input.eventType,
      input.messageId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function listConversationActivityEvents(
  conversationId: string,
  options?: { limit?: number }
): Promise<ConversationActivityRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const result = await pool.query<ConversationActivityRecord>(
    `SELECT
       e.id,
       e.conversation_id,
       e.actor_id,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS actor_name,
       e.event_type,
       e.message_id,
       m.body AS message_body,
       e.metadata,
       e.created_at
     FROM message_activity_events e
     LEFT JOIN users u ON u.id = e.actor_id
     LEFT JOIN messages m ON m.id = e.message_id
     WHERE e.conversation_id = $1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows.map((row) => ({
    ...row,
    message_body: decryptMessageBody(row.message_body),
  }));
}

export async function resolveMentionTargets(conversationId: string, handles: string[]) {
  const normalized = Array.from(
    new Set(
      handles
        .map((handle) => handle.trim().toLowerCase())
        .filter((handle) => handle.length >= 2)
    )
  );
  if (!normalized.length) return [];

  const result = await pool.query<{ user_id: string; username: string | null }>(
    `SELECT cp.user_id,
            up.username
     FROM conversation_participants cp
     LEFT JOIN user_profiles up ON up.user_id = cp.user_id
     WHERE cp.conversation_id = $1
       AND up.username IS NOT NULL
       AND LOWER(up.username) = ANY($2::text[])`,
    [conversationId, normalized]
  );
  return result.rows;
}

export async function markConversationMessagesRead(conversationId: string, recipientId: string, readAt?: string) {
  await pool.query(
    `UPDATE message_receipts mr
     SET delivered_at = COALESCE(mr.delivered_at, COALESCE($3::timestamptz, NOW())),
         read_at = COALESCE(mr.read_at, COALESCE($3::timestamptz, NOW())),
         updated_at = NOW()
     FROM messages m
     WHERE mr.message_id = m.id
       AND mr.recipient_id = $2
       AND m.conversation_id = $1
       AND m.sender_id <> $2`,
    [conversationId, recipientId, readAt ?? null]
  );
}

export async function findDirectConversationBetweenUsers(
  userAId: string,
  userBId: string
): Promise<ConversationRecord | null> {
  const result = await pool.query<ConversationRecord>(
    `SELECT c.id,
            c.name,
            c.type,
            c.created_at,
            c.archived_at,
            c.archived_by,
            c.assignment_title,
            c.assignment_description,
            c.assignment_due_at,
            c.assignment_template,
            m.body AS last_message,
            m.created_at AS last_message_at,
            0::int AS unread_count
     FROM conversations c
     JOIN conversation_participants cp_self ON cp_self.conversation_id = c.id AND cp_self.user_id = $1
     JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id = $2
     LEFT JOIN LATERAL (
       SELECT body, created_at
       FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) m ON true
     WHERE c.type = 'direct'
       AND (
         SELECT COUNT(*)::int
         FROM conversation_participants cp
         WHERE cp.conversation_id = c.id
       ) = 2
     ORDER BY m.created_at DESC NULLS LAST, c.created_at DESC
     LIMIT 1`,
    [userAId, userBId]
  );
  return result.rows[0]
    ? { ...result.rows[0], last_message: decryptMessageBody(result.rows[0].last_message ?? null) }
    : null;
}

export async function getDirectConversationPeerUserId(conversationId: string, userId: string) {
  const result = await pool.query<{ peer_user_id: string }>(
    `SELECT cp_other.user_id AS peer_user_id
     FROM conversations c
     JOIN conversation_participants cp_self
       ON cp_self.conversation_id = c.id
      AND cp_self.user_id = $2
     JOIN conversation_participants cp_other
       ON cp_other.conversation_id = c.id
      AND cp_other.user_id <> $2
     WHERE c.id = $1
       AND c.type = 'direct'
       AND (
         SELECT COUNT(*)::int
         FROM conversation_participants cp
         WHERE cp.conversation_id = c.id
       ) = 2
     LIMIT 1`,
    [conversationId, userId]
  );
  return result.rows[0]?.peer_user_id ?? null;
}

async function hydrateMessageRows(rows: MessageRecord[], viewerUserId?: string): Promise<MessageRecord[]> {
  if (rows.length === 0) return [];

  const messageIds = rows.map((row) => row.id);
  const [attachments, mentions, deliveryStatuses, reactionsByMessage, replyByMessage] = await Promise.all([
    listAttachmentsForMessageIds(messageIds),
    listMentionUserIdsByMessageIds(messageIds),
    viewerUserId ? listDeliveryStatusForSenderMessages(messageIds, viewerUserId) : Promise.resolve(new Map()),
    listReactionSummaryForMessageIds(messageIds, viewerUserId),
    listReplyPreviewForMessageIds(messageIds),
  ]);

  const attachmentsByMessage = new Map<string, MessageAttachmentRecord[]>();
  for (const attachment of attachments) {
    const list = attachmentsByMessage.get(attachment.message_id) ?? [];
    list.push(attachment);
    attachmentsByMessage.set(attachment.message_id, list);
  }

  return rows.map((row) => ({
    ...decryptMessageRecord(row),
    attachments: attachmentsByMessage.get(row.id) ?? [],
    mention_user_ids: mentions.get(row.id) ?? [],
    reactions: reactionsByMessage.get(row.id) ?? [],
    reply_to: replyByMessage.get(row.id) ?? null,
    delivery_status: deliveryStatuses.get(row.id),
  }));
}

async function markConversationMessagesDelivered(conversationId: string, recipientId: string) {
  await pool.query(
    `UPDATE message_receipts mr
     SET delivered_at = COALESCE(mr.delivered_at, NOW()),
         updated_at = NOW()
     FROM messages m
     WHERE mr.message_id = m.id
       AND mr.recipient_id = $2
       AND m.conversation_id = $1
       AND m.sender_id <> $2
       AND mr.delivered_at IS NULL`,
    [conversationId, recipientId]
  );
}

async function listMentionUserIdsByMessageIds(messageIds: string[]): Promise<Map<string, string[]>> {
  if (!messageIds.length) return new Map();
  const result = await pool.query<{ message_id: string; mentioned_user_id: string }>(
    `SELECT message_id, mentioned_user_id
     FROM message_mentions
     WHERE message_id = ANY($1::uuid[])`,
    [messageIds]
  );

  const mapped = new Map<string, string[]>();
  for (const row of result.rows) {
    const bucket = mapped.get(row.message_id) ?? [];
    bucket.push(row.mentioned_user_id);
    mapped.set(row.message_id, bucket);
  }
  return mapped;
}

async function listDeliveryStatusForSenderMessages(
  messageIds: string[],
  senderId: string
): Promise<Map<string, "sent" | "delivered" | "read">> {
  if (!messageIds.length) return new Map();
  const result = await pool.query<{ message_id: string; delivery_status: "sent" | "delivered" | "read" | null }>(
    `SELECT
       m.id AS message_id,
       CASE
         WHEN COUNT(mr.message_id) = 0 THEN NULL
         WHEN COUNT(*) FILTER (WHERE mr.read_at IS NOT NULL) = COUNT(mr.message_id) THEN 'read'
         WHEN COUNT(*) FILTER (WHERE mr.delivered_at IS NOT NULL) > 0 THEN 'delivered'
         ELSE 'sent'
       END AS delivery_status
     FROM messages m
     LEFT JOIN message_receipts mr ON mr.message_id = m.id
     WHERE m.id = ANY($1::uuid[])
       AND m.sender_id = $2
     GROUP BY m.id`,
    [messageIds, senderId]
  );

  const mapped = new Map<string, "sent" | "delivered" | "read">();
  for (const row of result.rows) {
    if (!row.delivery_status) continue;
    mapped.set(row.message_id, row.delivery_status);
  }
  return mapped;
}

async function listAttachmentsForMessageIds(messageIds: string[]): Promise<MessageAttachmentRecord[]> {
  if (!messageIds.length) return [];
  const result = await pool.query<MessageAttachmentRecord>(
    `SELECT
       id,
       message_id,
       conversation_id,
       uploader_id,
       file_name,
       mime_type,
       size_bytes::double precision AS size_bytes,
       kind,
       duration_seconds::double precision AS duration_seconds,
       scan_status,
       scan_reason,
       scanned_at,
       created_at
     FROM message_attachments
     WHERE message_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [messageIds]
  );
  return result.rows;
}

async function listReactionSummaryForMessageIds(
  messageIds: string[],
  viewerUserId?: string
): Promise<Map<string, MessageReactionSummary[]>> {
  if (!messageIds.length) return new Map();
  const result = await pool.query<{
    message_id: string;
    emoji: string;
    count: number;
    reacted: boolean;
  }>(
    `SELECT
       mr.message_id,
       mr.emoji,
       COUNT(*)::int AS count,
       BOOL_OR(mr.user_id = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)) AS reacted
     FROM message_reactions mr
     WHERE mr.message_id = ANY($1::uuid[])
     GROUP BY mr.message_id, mr.emoji
     ORDER BY mr.message_id, COUNT(*) DESC, mr.emoji ASC`,
    [messageIds, viewerUserId ?? null]
  );

  const mapped = new Map<string, MessageReactionSummary[]>();
  for (const row of result.rows) {
    const bucket = mapped.get(row.message_id) ?? [];
    bucket.push({
      emoji: row.emoji,
      count: Number(row.count || 0),
      reacted: Boolean(row.reacted),
    });
    mapped.set(row.message_id, bucket);
  }
  return mapped;
}

async function listReplyPreviewForMessageIds(
  messageIds: string[]
): Promise<Map<string, MessageReplyPreview | null>> {
  if (!messageIds.length) return new Map();
  const result = await pool.query<{
    message_id: string;
    reply_message_id: string;
    reply_sender_id: string;
    reply_sender_name: string;
    reply_body: string | null;
    reply_deleted_at: string | null;
    reply_created_at: string;
  }>(
    `SELECT
       child.id AS message_id,
       parent.id AS reply_message_id,
       parent.sender_id AS reply_sender_id,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS reply_sender_name,
       parent.body AS reply_body,
       parent.deleted_at AS reply_deleted_at,
       parent.created_at AS reply_created_at
     FROM messages child
     JOIN messages parent ON parent.id = child.parent_message_id
     JOIN users u ON u.id = parent.sender_id
     WHERE child.id = ANY($1::uuid[])`,
    [messageIds]
  );

  const mapped = new Map<string, MessageReplyPreview | null>();
  for (const row of result.rows) {
    mapped.set(row.message_id, {
      id: row.reply_message_id,
      sender_id: row.reply_sender_id,
      sender_name: row.reply_sender_name,
      body: decryptMessageBody(row.reply_body),
      deleted_at: row.reply_deleted_at,
      created_at: row.reply_created_at,
    });
  }
  return mapped;
}
