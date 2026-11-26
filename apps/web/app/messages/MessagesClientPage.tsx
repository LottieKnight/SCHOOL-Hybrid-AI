"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { isLiteModeEnabled } from "@/lib/liteMode";
import {
  getModerationEventTarget,
  type ModerationEventSeverity,
  type ModerationEventSeverityFilter,
  type ModerationEventType,
  type ModerationEventTypeFilter,
} from "@/lib/moderationEvents";
import { ComposerPanel } from "@/components/messages/ComposerPanel";
import { ConversationListPanel } from "@/components/messages/ConversationListPanel";
import { ThreadViewPanel } from "@/components/messages/ThreadViewPanel";
import styles from "./page.module.css";

const MessageAttachmentList = dynamic(
  () => import("@/components/messages/MessageAttachmentList").then((mod) => mod.MessageAttachmentList),
  {
    ssr: false,
    loading: () => <p className={styles.status}>Loading attachments...</p>,
  }
);

const ModerationFeedPanel = dynamic(
  () => import("@/components/messages/ModerationFeedPanel").then((mod) => mod.ModerationFeedPanel),
  {
    ssr: false,
    loading: () => <p className={styles.status}>Loading moderation tools...</p>,
  }
);

type Conversation = {
  id: string;
  name: string;
  type: "group" | "direct" | "channel";
  created_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  assignment_title?: string | null;
  assignment_description?: string | null;
  assignment_due_at?: string | null;
  assignment_template?: AssignmentTemplate | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
};

type MessageAttachment = {
  id: string;
  message_id: string;
  conversation_id: string;
  uploader_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: "file" | "image" | "video" | "audio";
  duration_seconds: number | null;
  created_at: string;
  scan_status?: "pending" | "clean" | "blocked";
  scan_reason?: string | null;
  scanned_at?: string | null;
  url?: string;
};

type MessageReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

type MessageReplyPreview = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string | null;
  deleted_at: string | null;
  created_at: string;
};

type Message = {
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
  attachments?: MessageAttachment[];
  mention_user_ids?: string[];
  reactions?: MessageReaction[];
  status?: "sending" | "failed" | "sent" | "delivered" | "read";
  delivery_status?: "sent" | "delivered" | "read";
};

type SavedMessage = Message & {
  saved_at: string;
  conversation_name: string;
};

type ConversationParticipant = {
  user_id: string;
  email: string;
  name: string;
  role: "owner" | "editor" | "viewer" | "member" | "tutor" | "student";
};

type ConversationSettings = {
  conversation_id: string;
  user_id: string;
  muted_until: string | null;
  blocked: boolean;
  mention_notifications: boolean;
  assignment_reminder_mode: "off" | "72h" | "24h";
  assignment_reminder_snoozed_until: string | null;
  assignment_overdue_repeat_hours: number;
  channel_event_notifications: boolean;
  message_update_notifications: boolean;
  share_presence: boolean;
  share_typing: boolean;
  share_read_receipts: boolean;
};

type ConversationPresence = {
  conversation_id: string;
  user_id: string;
  is_online: boolean;
  last_active_at: string;
  last_typing_at: string | null;
  last_read_at: string | null;
};

type DirectoryUser = {
  user_id: string;
  email: string;
  name: string;
  username: string | null;
  school_name?: string | null;
};

type InteractedUser = DirectoryUser & {
  last_interaction_at: string;
  message_count: number;
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

type WeeklyMessagingSnapshot = {
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  sentMessages: number;
  receivedMessages: number;
  activeConversations: number;
  activeDirectConversations: number;
  activeGroupConversations: number;
  activeChannelConversations: number;
  collaboratorCount: number;
  dueSoonChannels: number;
  overdueChannels: number;
  unreadMentions: number;
  unreadAssignmentReminders: number;
  unreadConversations: number;
};

type ModerationEvent = {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_name: string;
  session_id: string | null;
  type: ModerationEventType;
  severity: ModerationEventSeverity;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type ExplainableInsightCard = {
  id: string;
  title: string;
  value: string;
  reason: string;
  tone: "neutral" | "good" | "warn";
};

type MessageEventPayload = {
  event: "message";
  conversationId: string;
  participants: string[];
  message: Message;
};

type TypingEventPayload = {
  event: "typing";
  conversationId: string;
  participants: string[];
  userId: string;
  isTyping: boolean;
  at: string;
};

type ReadEventPayload = {
  event: "read";
  conversationId: string;
  userId: string;
  readAt: string;
};

type PresenceEventPayload = {
  event: "presence";
  conversationId: string;
  participants: string[];
  userId: string;
  isOnline: boolean;
  lastActiveAt: string;
};

type PinEventPayload = {
  event: "pin";
  conversationId: string;
  participants: string[];
  userId: string;
  pinned: boolean;
  message: Message;
};

type ArchiveEventPayload = {
  event: "archive";
  conversationId: string;
  participants: string[];
  userId: string;
  archived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
};

type ParticipantEventPayload = {
  event: "participant";
  conversationId: string;
  participants: string[];
  actorId: string;
  targetUserId: string;
  action: "added" | "removed" | "left";
  role?: "owner" | "editor" | "viewer" | "member" | "tutor" | "student" | null;
};

type ConversationUpdateEventPayload = {
  event: "conversation";
  conversationId: string;
  participants: string[];
  userId: string;
  kind: "channel_details_updated";
  conversation: Conversation;
};

type MessageUpdateEventPayload = {
  event: "message_update";
  conversationId: string;
  participants: string[];
  userId: string;
  kind: "edited" | "deleted" | "reaction";
  emoji?: string;
  reacted?: boolean;
  message: Message;
};

type AssignmentReminderEventPayload = {
  event: "assignment_reminder";
  conversationId: string;
  participants: string[];
  userId: string;
  conversationName: string;
  assignmentTitle: string | null;
  assignmentDueAt: string;
  reminderKind: "72h" | "24h" | "overdue";
};

type AssignmentTemplate = {
  templateId?: string;
  checklist?: string[];
  milestones?: Array<{ title: string; dueAt?: string }>;
  rubric?: Array<{ criterion: string; description?: string; weight?: number }>;
};

type MentionNotification = {
  message_id: string;
  conversation_id: string;
  conversation_name: string;
  sender_id: string;
  sender_name: string;
  message_body: string | null;
  message_created_at: string;
  unread: boolean;
};

type AssignmentReminderNotification = {
  id: string;
  conversation_id: string;
  conversation_name: string;
  reminder_kind: "72h" | "24h" | "overdue";
  assignment_title: string | null;
  assignment_due_at: string;
  source_sent_at: string;
  created_at: string;
  read_at: string | null;
  unread: boolean;
};

type ConversationActivityEvent = {
  id: string;
  conversation_id: string;
  actor_id: string | null;
  actor_name: string | null;
  event_type:
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
  message_id: string | null;
  message_body: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type FailedSendItem = {
  id: string;
  conversationId: string;
  conversationName: string;
  body: string;
  files: File[];
  durationSeconds: number | null;
  replyToMessageId?: string | null;
  replyTo?: MessageReplyPreview | null;
  attempts: number;
  lastError: string;
  optimisticMessageId?: string;
  createdAt: string;
};

type PersistedFailedSendItem = Omit<FailedSendItem, "files"> & {
  files: [];
};

type RoleWidgetAction =
  | "create_group"
  | "create_channel"
  | "focus_directory"
  | "focus_followed"
  | "open_moderation"
  | "open_due_channel"
  | "open_mentions"
  | "open_assignment_reminders";

type RoleQuickWidget = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  action: RoleWidgetAction;
  enabled?: boolean;
};

type UserSearchCacheScope = "directory" | "followed" | "interacted";

type UserSearchCachePayload = {
  users: DirectoryUser[];
  hasMore: boolean;
  nextCursor: string | null;
};

type UserSearchCacheEntry = UserSearchCachePayload & {
  cachedAt: number;
};

type AttachmentQuotaState = {
  quota: {
    max_bytes: number;
    retention_days: number;
    updated_at?: string;
    updated_by?: string | null;
  };
  usage: {
    totalBytes: number;
    attachmentCount: number;
  };
  remainingBytes: number;
};

type ChannelTask = {
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

type ChannelAssessment = {
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

const MAX_FILES_PER_MESSAGE = 4;
const MAX_MESSAGE_BODY_LENGTH = 2000;
const MAX_CLIENT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_PERSISTED_FAILED_SENDS = 50;
const USER_SEARCH_CACHE_TTL_MS = 20_000;
const USER_SEARCH_CACHE_MAX_ENTRIES = 120;
const MESSAGE_SEARCH_HISTORY_LIMIT = 8;
const SSE_RECONNECT_BASE_DELAY_MS = 1000;
const SSE_RECONNECT_MAX_DELAY_MS = 15000;
const FAILED_SENDS_STORAGE_KEY_PREFIX = "saedu:messages:failed-sends";
const CONVERSATION_FILTER_PREFS_STORAGE_KEY_PREFIX = "saedu:messages:conversation-filters";
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "🤝"];
const QUICK_REPLY_TEMPLATES = [
  "Thanks, I will work on this and update you shortly.",
  "Can you share the exact question you are stuck on?",
  "Let's break it into steps and solve it together.",
  "Good progress so far. Keep going.",
  "I'll review this and get back to you in 10 minutes.",
];
const MESSAGE_SEARCH_QUICK_FILTERS = [
  { label: "Has files", token: "has:file" },
  { label: "From me", token: "from:me" },
  { label: "Today", token: `after:${new Date().toISOString().slice(0, 10)}` },
  { label: "Before today", token: `before:${new Date().toISOString().slice(0, 10)}` },
];
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
]);

const toTempId = () => `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const DUE_SOON_WINDOW_MS = 72 * 60 * 60 * 1000;
const ASSIGNMENT_REMINDER_WINDOWS_MS: Record<Exclude<ConversationSettings["assignment_reminder_mode"], "off">, number> = {
  "72h": 72 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const buildFailedSendsStorageKey = (userId: string) => `${FAILED_SENDS_STORAGE_KEY_PREFIX}:${userId}`;
const buildConversationFilterPrefsStorageKey = (userId: string) =>
  `${CONVERSATION_FILTER_PREFS_STORAGE_KEY_PREFIX}:${userId}`;
const buildMessageSearchHistoryStorageKey = (userId: string, conversationId: string) =>
  `saedu:messages:search-history:${userId}:${conversationId}`;

const mergeSearchToken = (query: string, token: string) => {
  const normalizedToken = token.trim();
  if (!normalizedToken) return query;
  const parts = query
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.includes(normalizedToken)) return query;
  return [...parts, normalizedToken].join(" ");
};

const parseSearchTokenFromMe = (query: string, userId: string | null | undefined) => {
  if (!userId) return query;
  return query.replace(/\bfrom:me\b/gi, `from:${userId}`);
};

const toUserDisplayName = (
  userId: string | null | undefined,
  participants: ConversationParticipant[],
  selfUserId: string | null | undefined
) => {
  if (!userId) return "Unassigned";
  if (userId === selfUserId) return "You";
  return participants.find((participant) => participant.user_id === userId)?.name || userId.slice(0, 8);
};

const normalizeUserSearchCacheQuery = (value: string) => value.trim().replace(/^@+/, "").toLowerCase();

const buildUserSearchCacheKey = (
  scope: UserSearchCacheScope,
  query: string,
  cursor?: string | null
) => `${scope}|${normalizeUserSearchCacheQuery(query)}|${cursor || "start"}`;

const readUserSearchCache = (
  cache: Map<string, UserSearchCacheEntry>,
  scope: UserSearchCacheScope,
  query: string,
  cursor?: string | null
): UserSearchCachePayload | null => {
  const key = buildUserSearchCacheKey(scope, query, cursor);
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > USER_SEARCH_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return {
    users: cached.users,
    hasMore: cached.hasMore,
    nextCursor: cached.nextCursor,
  };
};

const writeUserSearchCache = (
  cache: Map<string, UserSearchCacheEntry>,
  scope: UserSearchCacheScope,
  query: string,
  cursor: string | null | undefined,
  payload: UserSearchCachePayload
) => {
  const key = buildUserSearchCacheKey(scope, query, cursor);
  cache.set(key, {
    ...payload,
    cachedAt: Date.now(),
  });
  while (cache.size > USER_SEARCH_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
};

const parseStoredReplyPreview = (value: unknown): MessageReplyPreview | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.sender_id !== "string" || !raw.sender_id) return null;
  if (typeof raw.sender_name !== "string" || !raw.sender_name) return null;
  if (!(raw.body === null || typeof raw.body === "string")) return null;
  if (!(raw.deleted_at === null || typeof raw.deleted_at === "string")) return null;
  if (typeof raw.created_at !== "string" || !raw.created_at) return null;
  return {
    id: raw.id,
    sender_id: raw.sender_id,
    sender_name: raw.sender_name,
    body: raw.body,
    deleted_at: raw.deleted_at,
    created_at: raw.created_at,
  };
};

const toPersistedFailedSends = (items: FailedSendItem[]): PersistedFailedSendItem[] =>
  items
    .filter((item) => item.files.length === 0 && item.body.trim().length > 0)
    .slice(0, MAX_PERSISTED_FAILED_SENDS)
    .map((item) => ({
      ...item,
      files: [],
      durationSeconds: null,
    }));

const fromPersistedFailedSends = (value: unknown): FailedSendItem[] => {
  if (!Array.isArray(value)) return [];
  const restored: FailedSendItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.id !== "string" || !raw.id) continue;
    if (typeof raw.conversationId !== "string" || !raw.conversationId) continue;
    if (typeof raw.conversationName !== "string" || !raw.conversationName) continue;
    if (typeof raw.body !== "string" || raw.body.trim().length === 0) continue;
    const attempts = Number(raw.attempts);
    const durationSeconds =
      raw.durationSeconds === null || raw.durationSeconds === undefined
        ? null
        : Number(raw.durationSeconds);
    const optimisticMessageId =
      typeof raw.optimisticMessageId === "string" && raw.optimisticMessageId
        ? raw.optimisticMessageId
        : undefined;
    restored.push({
      id: raw.id,
      conversationId: raw.conversationId,
      conversationName: raw.conversationName,
      body: raw.body,
      files: [],
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      replyToMessageId:
        raw.replyToMessageId === null || typeof raw.replyToMessageId === "string"
          ? (raw.replyToMessageId ?? null)
          : null,
      replyTo: parseStoredReplyPreview(raw.replyTo),
      attempts: Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 1,
      lastError:
        typeof raw.lastError === "string" && raw.lastError.trim().length > 0
          ? raw.lastError
          : "Retry pending.",
      optimisticMessageId,
      createdAt:
        typeof raw.createdAt === "string" && raw.createdAt
          ? raw.createdAt
          : new Date().toISOString(),
    });
  }
  return restored.slice(0, MAX_PERSISTED_FAILED_SENDS);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toRelativeDurationShort = (deltaMs: number) => {
  const absoluteMs = Math.abs(deltaMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absoluteMs >= dayMs) return `${Math.max(1, Math.round(absoluteMs / dayMs))}d`;
  if (absoluteMs >= hourMs) return `${Math.max(1, Math.round(absoluteMs / hourMs))}h`;
  return `${Math.max(1, Math.round(absoluteMs / minuteMs))}m`;
};

const getChannelDueInfo = (dueAt?: string | null, nowMs = Date.now()) => {
  if (!dueAt) return { state: "none" as const, label: null };
  const dueAtMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueAtMs)) return { state: "none" as const, label: null };
  const deltaMs = dueAtMs - nowMs;
  if (deltaMs < 0) {
    return { state: "overdue" as const, label: `Overdue ${toRelativeDurationShort(deltaMs)}` };
  }
  if (deltaMs <= DUE_SOON_WINDOW_MS) {
    return { state: "due_soon" as const, label: `Due in ${toRelativeDurationShort(deltaMs)}` };
  }
  return {
    state: "upcoming" as const,
    label: `Due ${formatDateTime(dueAt)}`,
  };
};

const getChannelReminderInfo = (
  dueAt: string | null | undefined,
  mode: ConversationSettings["assignment_reminder_mode"] | undefined,
  nowMs = Date.now()
) => {
  if (!dueAt || !mode || mode === "off") return null;
  const dueAtMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueAtMs)) return null;
  const deltaMs = dueAtMs - nowMs;
  if (deltaMs < 0) {
    return {
      level: "overdue" as const,
      message: `Assignment overdue by ${toRelativeDurationShort(deltaMs)}.`,
    };
  }
  const thresholdMs = ASSIGNMENT_REMINDER_WINDOWS_MS[mode];
  if (deltaMs <= thresholdMs) {
    return {
      level: "soon" as const,
      message: `Assignment due in ${toRelativeDurationShort(deltaMs)}.`,
    };
  }
  return null;
};

const getAssignmentReminderNotice = (payload: AssignmentReminderEventPayload) => {
  const assignmentName = payload.assignmentTitle?.trim() || "Assignment";
  const conversationName = payload.conversationName?.trim() || "channel";
  if (payload.reminderKind === "overdue") {
    return `${assignmentName} in ${conversationName} is overdue.`;
  }
  if (payload.reminderKind === "24h") {
    return `${assignmentName} in ${conversationName} is due in 24h.`;
  }
  return `${assignmentName} in ${conversationName} is due in 72h.`;
};

const getReminderKindLabel = (kind: AssignmentReminderNotification["reminder_kind"]) => {
  if (kind === "overdue") return "Overdue";
  if (kind === "24h") return "Due in 24h";
  return "Due in 72h";
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const formatTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatBytes = (sizeBytes: number) => {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = sizeBytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const toAttachmentExtension = (fileName: string) => {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx).toLowerCase();
};

const isAllowedAttachmentFile = (file: File) => {
  const ext = toAttachmentExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")) return true;
  return ALLOWED_ATTACHMENT_EXTENSIONS.has(ext);
};

const toAttachmentSignature = (file: File) => `${file.name}|${file.size}|${file.type}`;

const isMessageMediaAttachment = (attachment: MessageAttachment) =>
  attachment.kind === "image" || attachment.kind === "video" || attachment.kind === "audio";

const getAssessmentDueState = (dueAt?: string | null, nowMs = Date.now()) => {
  if (!dueAt) return { state: "none" as const, label: "No due date" };
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return { state: "none" as const, label: "No due date" };
  const delta = dueMs - nowMs;
  if (delta < 0) return { state: "overdue" as const, label: `Overdue ${toRelativeDurationShort(delta)}` };
  if (delta <= DUE_SOON_WINDOW_MS) return { state: "due_soon" as const, label: `Due in ${toRelativeDurationShort(delta)}` };
  return { state: "upcoming" as const, label: `Due ${formatDateTime(dueAt)}` };
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const attachmentScanLabel = (attachment: MessageAttachment) => {
  if (attachment.scan_status === "blocked") {
    return `Blocked${attachment.scan_reason ? `: ${attachment.scan_reason}` : ""}`;
  }
  if (attachment.scan_status === "pending") return "Scan pending";
  if (attachment.scan_status === "clean") return "Scanned";
  return null;
};

const sortConversations = (items: Conversation[]) =>
  [...items].sort((a, b) => {
    const aArchived = Boolean(a.archived_at);
    const bArchived = Boolean(b.archived_at);
    if (aArchived !== bArchived) return aArchived ? 1 : -1;
    const aTime = new Date(a.last_message_at || a.created_at).getTime();
    const bTime = new Date(b.last_message_at || b.created_at).getTime();
    return bTime - aTime;
  });

const sortPinnedMessages = (items: Message[]) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a.pinned_at || a.created_at).getTime();
    const bTime = new Date(b.pinned_at || b.created_at).getTime();
    return bTime - aTime;
  });

const summarizeMessage = (message: Pick<Message, "body" | "attachments">) => {
  const body = message.body?.trim();
  if (body) return body;
  const attachments = message.attachments || [];
  if (!attachments.length) return "Attachment";
  if (attachments.length > 1) return `${attachments.length} attachments`;
  const kind = attachments[0]?.kind;
  if (kind === "audio") return "Voice note";
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  return "File";
};

const toReplyPreview = (message: Message): MessageReplyPreview => ({
  id: message.id,
  sender_id: message.sender_id,
  sender_name: message.sender_name || "Participant",
  body: message.body,
  deleted_at: message.deleted_at || null,
  created_at: message.created_at,
});

const summarizeReplyPreview = (reply: MessageReplyPreview | null | undefined) => {
  if (!reply) return "";
  if (reply.deleted_at) return "Message deleted";
  const body = reply.body?.trim();
  return body || "Attachment";
};

const syncReplyPreviewReferences = (messages: Message[], updatedMessage: Message): Message[] => {
  const preview = toReplyPreview(updatedMessage);
  return messages.map((message) =>
    message.reply_to?.id === updatedMessage.id ? { ...message, reply_to: preview } : message
  );
};

const syncSavedMessagesWithUpdate = (messages: SavedMessage[], updatedMessage: Message): SavedMessage[] => {
  const preview = toReplyPreview(updatedMessage);
  return messages.map((message) => {
    let next = message;
    if (message.id === updatedMessage.id) {
      next = { ...message, ...updatedMessage };
    }
    if (next.reply_to?.id === updatedMessage.id) {
      next = { ...next, reply_to: preview };
    }
    return next;
  });
};

const countRepliesByParent = (items: Message[]) => {
  const counts = new Map<string, number>();
  for (const message of items) {
    const parentId = message.parent_message_id;
    if (!parentId) continue;
    counts.set(parentId, (counts.get(parentId) || 0) + 1);
  }
  return counts;
};

const toPresenceByUserId = (presenceRows: ConversationPresence[]) => {
  const mapped: Record<string, ConversationPresence> = {};
  for (const row of presenceRows || []) {
    mapped[row.user_id] = row;
  }
  return mapped;
};

const normalizeConversationSettings = (settings: ConversationSettings | null | undefined) => {
  if (!settings) return null;
  const reminderMode = settings.assignment_reminder_mode;
  const repeatHours = Number(settings.assignment_overdue_repeat_hours || 24);
  return {
    ...settings,
    assignment_reminder_mode:
      reminderMode === "off" || reminderMode === "24h" || reminderMode === "72h" ? reminderMode : "72h",
    assignment_reminder_snoozed_until: settings.assignment_reminder_snoozed_until || null,
    assignment_overdue_repeat_hours:
      Number.isFinite(repeatHours) && repeatHours >= 6 && repeatHours <= 168 ? repeatHours : 24,
    channel_event_notifications: settings.channel_event_notifications !== false,
    message_update_notifications: settings.message_update_notifications !== false,
    share_presence: settings.share_presence !== false,
    share_typing: settings.share_typing !== false,
    share_read_receipts: settings.share_read_receipts !== false,
  };
};

const toMetadataObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toChangedFields = (metadata: Record<string, unknown> | null) => {
  const raw = metadata?.changedFields;
  if (!Array.isArray(raw)) return [] as string[];
  return raw.filter((field): field is string => typeof field === "string");
};

const channelFieldLabel = (field: string) => {
  if (field === "name") return "channel name";
  if (field === "assignmentTitle") return "assignment title";
  if (field === "assignmentDescription") return "assignment description";
  if (field === "assignmentDueAt") return "due date";
  if (field === "assignmentTemplate") return "template";
  return field;
};

const reminderFieldLabel = (field: string) => {
  if (field === "assignmentReminderMode") return "reminder mode";
  if (field === "assignmentReminderSnoozedUntil") return "snooze window";
  if (field === "assignmentOverdueRepeatHours") return "overdue cadence";
  return field;
};

const notificationFieldLabel = (field: string) => {
  if (field === "channelEventNotifications") return "channel event alerts";
  if (field === "messageUpdateNotifications") return "message update alerts";
  if (field === "sharePresence") return "presence sharing";
  if (field === "shareTyping") return "typing sharing";
  if (field === "shareReadReceipts") return "read receipt sharing";
  return field;
};

const displayReminderModeValue = (value: unknown) => {
  if (value === "off") return "off";
  if (value === "24h") return "24h before due";
  if (value === "72h") return "72h before due";
  return displayMetadataText(value);
};

const displayMetadataText = (value: unknown) => {
  if (typeof value === "string") return value.trim() || "none";
  if (value === null || value === undefined) return "none";
  return String(value);
};

const displayEnabled = (value: unknown) => (value === false ? "off" : "on");

const displayMetadataDueAt = (value: unknown) => {
  if (typeof value !== "string" || !value) return "none";
  return formatDateTime(value);
};

const summarizeActivityEvent = (event: ConversationActivityEvent, selfUserId?: string) => {
  const actor = event.actor_id && selfUserId && event.actor_id === selfUserId ? "You" : event.actor_name || "Someone";
  const targetUserName =
    event.metadata && typeof event.metadata.targetUserName === "string"
      ? event.metadata.targetUserName
      : event.metadata && typeof event.metadata.targetUserId === "string"
      ? "a participant"
      : "a participant";
  if (event.event_type === "message_pinned") return `${actor} pinned a message`;
  if (event.event_type === "message_unpinned") return `${actor} unpinned a message`;
  if (event.event_type === "conversation_archived") return `${actor} archived the channel`;
  if (event.event_type === "participant_added") return `${actor} added ${targetUserName}`;
  if (event.event_type === "participant_removed") return `${actor} removed ${targetUserName}`;
  if (event.event_type === "participant_left") return `${actor} left the conversation`;
  if (event.event_type === "channel_details_updated") {
    const metadata = toMetadataObject(event.metadata);
    const changedFields = toChangedFields(metadata);
    if (!changedFields.length) return `${actor} updated channel assignment details`;
    const labels = changedFields.map(channelFieldLabel);
    return `${actor} updated ${labels.join(", ")}`;
  }
  if (event.event_type === "channel_reminder_settings_updated") {
    const metadata = toMetadataObject(event.metadata);
    const changedFields = toChangedFields(metadata);
    if (!changedFields.length) return `${actor} updated assignment reminder settings`;
    const labels = changedFields.map(reminderFieldLabel);
    return `${actor} updated ${labels.join(", ")}`;
  }
  if (event.event_type === "channel_notification_settings_updated") {
    const metadata = toMetadataObject(event.metadata);
    const changedFields = toChangedFields(metadata);
    if (!changedFields.length) return `${actor} updated notification and privacy settings`;
    const labels = changedFields.map(notificationFieldLabel);
    return `${actor} updated ${labels.join(", ")}`;
  }
  return `${actor} unarchived the channel`;
};

const summarizeActivityDetails = (event: ConversationActivityEvent) => {
  if (
    event.event_type !== "channel_details_updated" &&
    event.event_type !== "channel_reminder_settings_updated" &&
    event.event_type !== "channel_notification_settings_updated"
  ) {
    return event.message_body || null;
  }

  const metadata = toMetadataObject(event.metadata);
  const changedFields = toChangedFields(metadata);
  const before = toMetadataObject(metadata?.before);
  const after = toMetadataObject(metadata?.after);
  if (!changedFields.length || !before || !after) return null;

  const details: string[] = [];
  if (event.event_type === "channel_details_updated") {
    if (changedFields.includes("name")) {
      details.push(`Name: ${displayMetadataText(before.name)} -> ${displayMetadataText(after.name)}`);
    }
    if (changedFields.includes("assignmentTitle")) {
      details.push(
        `Title: ${displayMetadataText(before.assignmentTitle)} -> ${displayMetadataText(after.assignmentTitle)}`
      );
    }
    if (changedFields.includes("assignmentDescription")) {
      details.push(
        `Description: ${displayMetadataText(before.assignmentDescription)} -> ${displayMetadataText(
          after.assignmentDescription
        )}`
      );
    }
    if (changedFields.includes("assignmentDueAt")) {
      details.push(
        `Due: ${displayMetadataDueAt(before.assignmentDueAt)} -> ${displayMetadataDueAt(after.assignmentDueAt)}`
      );
    }
    if (changedFields.includes("assignmentTemplate")) {
      details.push(
        `Template: ${displayMetadataText(before.assignmentTemplateId)} -> ${displayMetadataText(
          after.assignmentTemplateId
        )}`
      );
    }
  } else if (event.event_type === "channel_reminder_settings_updated") {
    if (changedFields.includes("assignmentReminderMode")) {
      details.push(
        `Mode: ${displayReminderModeValue(before.assignmentReminderMode)} -> ${displayReminderModeValue(
          after.assignmentReminderMode
        )}`
      );
    }
    if (changedFields.includes("assignmentReminderSnoozedUntil")) {
      details.push(
        `Snooze: ${displayMetadataDueAt(before.assignmentReminderSnoozedUntil)} -> ${displayMetadataDueAt(
          after.assignmentReminderSnoozedUntil
        )}`
      );
    }
    if (changedFields.includes("assignmentOverdueRepeatHours")) {
      details.push(
        `Overdue cadence: ${displayMetadataText(before.assignmentOverdueRepeatHours)}h -> ${displayMetadataText(
          after.assignmentOverdueRepeatHours
        )}h`
      );
    }
  } else {
    if (changedFields.includes("channelEventNotifications")) {
      details.push(
        `Channel alerts: ${displayEnabled(before.channelEventNotifications)} -> ${displayEnabled(
          after.channelEventNotifications
        )}`
      );
    }
    if (changedFields.includes("messageUpdateNotifications")) {
      details.push(
        `Message alerts: ${displayEnabled(before.messageUpdateNotifications)} -> ${displayEnabled(
          after.messageUpdateNotifications
        )}`
      );
    }
    if (changedFields.includes("sharePresence")) {
      details.push(
        `Presence: ${displayEnabled(before.sharePresence)} -> ${displayEnabled(after.sharePresence)}`
      );
    }
    if (changedFields.includes("shareTyping")) {
      details.push(`Typing: ${displayEnabled(before.shareTyping)} -> ${displayEnabled(after.shareTyping)}`);
    }
    if (changedFields.includes("shareReadReceipts")) {
      details.push(
        `Read receipts: ${displayEnabled(before.shareReadReceipts)} -> ${displayEnabled(
          after.shareReadReceipts
        )}`
      );
    }
  }

  return details.length ? details.join(" | ") : null;
};

const mentionTokenPattern = /(@[a-zA-Z0-9._-]{2,24})/g;

const roleLabel = (role: ConversationParticipant["role"]) => {
  if (role === "owner") return "Owner";
  if (role === "editor") return "Editor";
  if (role === "viewer") return "Viewer";
  if (role === "member") return "Member";
  if (role === "tutor") return "Tutor";
  return "Student";
};

const CHANNEL_TEMPLATE_PRESETS: Record<
  string,
  {
    label: string;
    description: string;
    checklist: string[];
    rubric: Array<{ criterion: string; description: string; weight: number }>;
  }
> = {
  research_report: {
    label: "Research Report",
    description: "Investigate the topic, evaluate sources, and submit a structured report.",
    checklist: [
      "Define scope and key questions",
      "Collect 3-5 credible sources",
      "Draft report structure",
      "Write findings and citations",
      "Peer-review and final edit",
    ],
    rubric: [
      { criterion: "Research quality", description: "Depth and reliability of sources", weight: 35 },
      { criterion: "Analysis", description: "Strength of reasoning and conclusions", weight: 35 },
      { criterion: "Writing clarity", description: "Structure, grammar, and readability", weight: 20 },
      { criterion: "Citations", description: "Correct referencing and attribution", weight: 10 },
    ],
  },
  presentation: {
    label: "Presentation Deck",
    description: "Create a concise presentation with speaking notes and team roles.",
    checklist: [
      "Define slide outline",
      "Assign speaking roles",
      "Create visual aids",
      "Rehearse with timer",
      "Finalize delivery notes",
    ],
    rubric: [
      { criterion: "Content accuracy", description: "Correctness and relevance", weight: 35 },
      { criterion: "Story flow", description: "Clear narrative and structure", weight: 25 },
      { criterion: "Visual design", description: "Readable and engaging slides", weight: 20 },
      { criterion: "Delivery", description: "Confidence and timing", weight: 20 },
    ],
  },
  lab_practical: {
    label: "Lab Practical",
    description: "Plan and execute the practical with method, results, and reflection.",
    checklist: [
      "State hypothesis",
      "Prepare apparatus and safety checks",
      "Run experiment and collect data",
      "Plot/organize results",
      "Write conclusion and improvements",
    ],
    rubric: [
      { criterion: "Method", description: "Procedure clarity and controls", weight: 30 },
      { criterion: "Data quality", description: "Accuracy and completeness", weight: 30 },
      { criterion: "Interpretation", description: "Result analysis and validity", weight: 25 },
      { criterion: "Safety and teamwork", description: "Safe and collaborative execution", weight: 15 },
    ],
  },
  group_project: {
    label: "Group Project",
    description: "Deliver a collaborative project with milestones and shared ownership.",
    checklist: [
      "Define deliverables and owner per task",
      "Create implementation timeline",
      "Build first draft/prototype",
      "Run peer QA review",
      "Submit final artifact and retrospective",
    ],
    rubric: [
      { criterion: "Problem solving", description: "Creativity and practical value", weight: 30 },
      { criterion: "Execution", description: "Completeness and technical quality", weight: 35 },
      { criterion: "Collaboration", description: "Coordination and role ownership", weight: 20 },
      { criterion: "Reflection", description: "Lessons learned and improvements", weight: 15 },
    ],
  },
};

const KEEP_CURRENT_TEMPLATE_OPTION = "keep_current";

const buildTemplateMilestones = (dueAtIso?: string | null) => {
  if (!dueAtIso) return undefined;
  const dueDate = new Date(dueAtIso);
  if (Number.isNaN(dueDate.getTime())) return undefined;
  return [
    {
      title: "Draft complete",
      dueAt: new Date(dueDate.getTime() - 72 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: "Peer review complete",
      dueAt: new Date(dueDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

const buildChannelAssignmentTemplate = (
  templateId: string,
  options?: { dueAtIso?: string | null }
): AssignmentTemplate | undefined => {
  const preset = CHANNEL_TEMPLATE_PRESETS[templateId];
  if (!preset) return undefined;
  return {
    templateId,
    checklist: preset.checklist,
    rubric: preset.rubric,
    milestones: buildTemplateMilestones(options?.dueAtIso ?? null),
  };
};

function MessagesPageClient() {
  const { session, loading: sessionLoading } = useSession();
  const apiBase = API_BASE;
  const searchParams = useSearchParams();
  const [liteModeEnabled, setLiteModeEnabled] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, ConversationPresence>>({});
  const [typingByUserId, setTypingByUserId] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<ConversationSettings | null>(null);

  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryResults, setDirectoryResults] = useState<DirectoryUser[]>([]);
  const [searchingDirectory, setSearchingDirectory] = useState(false);
  const [directoryResultsHasMore, setDirectoryResultsHasMore] = useState(false);
  const [directoryResultsNextCursor, setDirectoryResultsNextCursor] = useState<string | null>(null);
  const [followedSearch, setFollowedSearch] = useState("");
  const [followedResults, setFollowedResults] = useState<DirectoryUser[]>([]);
  const [searchingFollowed, setSearchingFollowed] = useState(false);
  const [followedResultsHasMore, setFollowedResultsHasMore] = useState(false);
  const [followedResultsNextCursor, setFollowedResultsNextCursor] = useState<string | null>(null);
  const [interactedSearch, setInteractedSearch] = useState("");
  const [interactedUsers, setInteractedUsers] = useState<InteractedUser[]>([]);
  const [interactedUsersHasMore, setInteractedUsersHasMore] = useState(false);
  const [interactedUsersNextCursor, setInteractedUsersNextCursor] = useState<string | null>(null);
  const [openingDirectUserId, setOpeningDirectUserId] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const [mentionsUnreadOnly, setMentionsUnreadOnly] = useState(true);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [mentionsUnreadCount, setMentionsUnreadCount] = useState(0);
  const [openingMentionMessageId, setOpeningMentionMessageId] = useState<string | null>(null);
  const [assignmentReminders, setAssignmentReminders] = useState<AssignmentReminderNotification[]>([]);
  const [assignmentRemindersUnreadOnly, setAssignmentRemindersUnreadOnly] = useState(true);
  const [loadingAssignmentReminders, setLoadingAssignmentReminders] = useState(false);
  const [assignmentRemindersUnreadCount, setAssignmentRemindersUnreadCount] = useState(0);
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklyMessagingSnapshot | null>(null);
  const [loadingWeeklySnapshot, setLoadingWeeklySnapshot] = useState(false);
  const [moderationEvents, setModerationEvents] = useState<ModerationEvent[]>([]);
  const [loadingModerationEvents, setLoadingModerationEvents] = useState(false);
  const [moderationTypeFilter, setModerationTypeFilter] = useState<ModerationEventTypeFilter>("all");
  const [moderationSeverityFilter, setModerationSeverityFilter] = useState<ModerationEventSeverityFilter>("all");
  const [showModerationTools, setShowModerationTools] = useState(false);
  const [openingModerationEventId, setOpeningModerationEventId] = useState<string | null>(null);
  const [openingAssignmentReminderId, setOpeningAssignmentReminderId] = useState<string | null>(null);
  const [markingAllAssignmentRemindersRead, setMarkingAllAssignmentRemindersRead] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [loadingSavedMessages, setLoadingSavedMessages] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [threadRootMessageId, setThreadRootMessageId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingPins, setLoadingPins] = useState(false);
  const [pinningMessageId, setPinningMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [savingEditMessageId, setSavingEditMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportingUserId, setReportingUserId] = useState<string | null>(null);
  const [reactingMessageKey, setReactingMessageKey] = useState<string | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [forwardTargetConversationId, setForwardTargetConversationId] = useState<string>("");
  const [forwardNote, setForwardNote] = useState("");
  const [forwardingMessage, setForwardingMessage] = useState(false);
  const [togglingArchive, setTogglingArchive] = useState(false);
  const [showArchivedConversations, setShowArchivedConversations] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [conversationTypeFilter, setConversationTypeFilter] = useState<"all" | "direct" | "group" | "channel">(
    "all"
  );
  const [conversationSortMode, setConversationSortMode] = useState<"recent" | "unread" | "name" | "due_risk">(
    "recent"
  );
  const [conversationUnreadOnly, setConversationUnreadOnly] = useState(false);
  const [conversationDueFilter, setConversationDueFilter] = useState<
    "all" | "due_soon" | "overdue" | "no_due"
  >("all");
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [unreadBoundaryMessageId, setUnreadBoundaryMessageId] = useState<string | null>(null);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<ConversationActivityEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ConversationActivityEvent["event_type"] | "all">("all");
  const [pinnedSearchQuery, setPinnedSearchQuery] = useState("");
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const [messageTimelineFilter, setMessageTimelineFilter] = useState<"all" | "media" | "attachments">("all");

  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState<"group" | "channel">("group");
  const [newName, setNewName] = useState("");
  const [newParticipants, setNewParticipants] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [assignmentTemplateId, setAssignmentTemplateId] = useState<string>("none");
  const [editingAssignmentDetails, setEditingAssignmentDetails] = useState(false);
  const [editChannelName, setEditChannelName] = useState("");
  const [editAssignmentTitle, setEditAssignmentTitle] = useState("");
  const [editAssignmentDescription, setEditAssignmentDescription] = useState("");
  const [editAssignmentDueAt, setEditAssignmentDueAt] = useState("");
  const [editAssignmentTemplateId, setEditAssignmentTemplateId] = useState<string>(KEEP_CURRENT_TEMPLATE_OPTION);
  const [savingAssignmentDetails, setSavingAssignmentDetails] = useState(false);

  const [composer, setComposer] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<MessageReplyPreview | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState<number | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingInteracted, setLoadingInteracted] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreateError, setShowCreateError] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [inviteChannelRole, setInviteChannelRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [removingParticipantUserId, setRemovingParticipantUserId] = useState<string | null>(null);
  const [leavingConversation, setLeavingConversation] = useState(false);
  const [savingMentionSetting, setSavingMentionSetting] = useState(false);
  const [savingAssignmentReminderSetting, setSavingAssignmentReminderSetting] = useState(false);
  const [savingNotificationPrivacySetting, setSavingNotificationPrivacySetting] = useState(false);
  const [savingMuteWindow, setSavingMuteWindow] = useState(false);
  const [failedSends, setFailedSends] = useState<FailedSendItem[]>([]);
  const [retryingFailedId, setRetryingFailedId] = useState<string | null>(null);
  const [messageSearchHistory, setMessageSearchHistory] = useState<string[]>([]);
  const [attachmentQuota, setAttachmentQuota] = useState<AttachmentQuotaState | null>(null);
  const [loadingAttachmentQuota, setLoadingAttachmentQuota] = useState(false);
  const [updatingAttachmentQuota, setUpdatingAttachmentQuota] = useState(false);
  const [attachmentQuotaMaxMbInput, setAttachmentQuotaMaxMbInput] = useState("250");
  const [attachmentQuotaRetentionDaysInput, setAttachmentQuotaRetentionDaysInput] = useState("30");
  const [channelTasks, setChannelTasks] = useState<ChannelTask[]>([]);
  const [loadingChannelTasks, setLoadingChannelTasks] = useState(false);
  const [creatingChannelTask, setCreatingChannelTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueAt, setNewTaskDueAt] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<ChannelTask["status"] | "all">("all");
  const [taskDueFilter, setTaskDueFilter] = useState<"all" | "overdue" | "due_soon" | "upcoming" | "none">("all");
  const [taskSortMode, setTaskSortMode] = useState<"due_asc" | "due_desc" | "status">("due_asc");
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [channelAssessments, setChannelAssessments] = useState<ChannelAssessment[]>([]);
  const [loadingChannelAssessments, setLoadingChannelAssessments] = useState(false);
  const [creatingChannelAssessment, setCreatingChannelAssessment] = useState(false);
  const [newAssessmentTitle, setNewAssessmentTitle] = useState("");
  const [newAssessmentInstructions, setNewAssessmentInstructions] = useState("");
  const [newAssessmentDueAt, setNewAssessmentDueAt] = useState("");
  const [newAssessmentMaxScore, setNewAssessmentMaxScore] = useState("100");
  const [assessmentSearchQuery, setAssessmentSearchQuery] = useState("");
  const [assessmentDueFilter, setAssessmentDueFilter] = useState<"all" | "overdue" | "due_soon" | "upcoming" | "none">(
    "all"
  );
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);

  const activeIdRef = useRef<string | null>(null);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const conversationSearchInputRef = useRef<HTMLInputElement | null>(null);
  const messageSearchInputRef = useRef<HTMLInputElement | null>(null);
  const directorySearchInputRef = useRef<HTMLInputElement | null>(null);
  const followedSearchInputRef = useRef<HTMLInputElement | null>(null);
  const mentionsPanelRef = useRef<HTMLDivElement | null>(null);
  const assignmentRemindersPanelRef = useRef<HTMLDivElement | null>(null);
  const moderationPanelRef = useRef<HTMLDivElement | null>(null);
  const userSearchCacheRef = useRef<Map<string, UserSearchCacheEntry>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStartRef = useRef<number | null>(null);
  const loadingMessagesForConversationRef = useRef<string | null>(null);
  const pendingAnchorMessageRef = useRef<{ conversationId: string; messageId: string } | null>(null);
  const threadRootMessageIdRef = useRef<string | null>(null);
  const threadMessageIdsRef = useRef<Set<string>>(new Set());
  const typingTimeoutRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);
  const typingConversationRef = useRef<string | null>(null);
  const typingLastSentAtRef = useRef(0);
  const conversationPrefsLoadedRef = useRef(false);
  const messageStreamRef = useRef<EventSource | null>(null);
  const messageStreamDetachRef = useRef<(() => void) | null>(null);
  const messageStreamReconnectTimerRef = useRef<number | null>(null);
  const messageStreamReconnectAttemptRef = useRef(0);
  const [timeNowMs, setTimeNowMs] = useState(() => Date.now());

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLiteModeEnabled(isLiteModeEnabled());
  }, []);

  useEffect(() => {
    const conversationId = searchParams.get("conversationId");
    const messageId = searchParams.get("messageId");
    if (!conversationId || !/^[0-9a-f-]{36}$/i.test(conversationId)) return;
    setActiveId((prev) => (prev === conversationId ? prev : conversationId));
    if (messageId && /^[0-9a-f-]{36}$/i.test(messageId)) {
      pendingAnchorMessageRef.current = {
        conversationId,
        messageId,
      };
    }
  }, [searchParams]);

  useEffect(() => {
    if (!session?.user.id) return;
    try {
      const raw = window.localStorage.getItem(buildFailedSendsStorageKey(session.user.id));
      if (!raw) return;
      const restored = fromPersistedFailedSends(JSON.parse(raw));
      if (!restored.length) return;
      setFailedSends((prev) => {
        if (!prev.length) return restored;
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...restored.filter((item) => !seen.has(item.id))];
      });
    } catch {
      // ignore localStorage errors
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;
    try {
      const key = buildFailedSendsStorageKey(session.user.id);
      const persisted = toPersistedFailedSends(failedSends);
      if (!persisted.length) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify(persisted));
    } catch {
      // ignore localStorage errors
    }
  }, [failedSends, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;
    conversationPrefsLoadedRef.current = false;
    try {
      const key = buildConversationFilterPrefsStorageKey(session.user.id);
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        search?: string;
        type?: "all" | "direct" | "group" | "channel";
        due?: "all" | "due_soon" | "overdue" | "no_due";
        archived?: boolean;
        sort?: "recent" | "unread" | "name" | "due_risk";
        unreadOnly?: boolean;
      };
      if (typeof parsed.search === "string") setConversationSearchQuery(parsed.search);
      if (parsed.type) setConversationTypeFilter(parsed.type);
      if (parsed.due) setConversationDueFilter(parsed.due);
      if (typeof parsed.archived === "boolean") setShowArchivedConversations(parsed.archived);
      if (parsed.sort) setConversationSortMode(parsed.sort);
      if (typeof parsed.unreadOnly === "boolean") setConversationUnreadOnly(parsed.unreadOnly);
    } catch {
      // ignore localStorage errors
    } finally {
      conversationPrefsLoadedRef.current = true;
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;
    if (!conversationPrefsLoadedRef.current) return;
    try {
      const key = buildConversationFilterPrefsStorageKey(session.user.id);
      window.localStorage.setItem(
        key,
        JSON.stringify({
          search: conversationSearchQuery,
          type: conversationTypeFilter,
          due: conversationDueFilter,
          archived: showArchivedConversations,
          sort: conversationSortMode,
          unreadOnly: conversationUnreadOnly,
        })
      );
    } catch {
      // ignore localStorage errors
    }
  }, [
    conversationDueFilter,
    conversationSearchQuery,
    conversationSortMode,
    conversationTypeFilter,
    conversationUnreadOnly,
    session?.user.id,
    showArchivedConversations,
  ]);

  useEffect(() => {
    threadRootMessageIdRef.current = threadRootMessageId;
  }, [threadRootMessageId]);

  useEffect(() => {
    threadMessageIdsRef.current = new Set(threadMessages.map((message) => message.id));
  }, [threadMessages]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || null,
    [activeId, conversations]
  );
  useEffect(() => {
    setEditingAssignmentDetails(false);
    setSavingAssignmentDetails(false);
    setEditAssignmentTemplateId(KEEP_CURRENT_TEMPLATE_OPTION);
  }, [activeConversation?.id]);
  const messageById = useMemo(() => {
    const mapped = new Map<string, Message>();
    for (const message of messages) mapped.set(message.id, message);
    return mapped;
  }, [messages]);
  const forwardingSourceMessage = useMemo(
    () => (forwardingMessageId ? messageById.get(forwardingMessageId) || null : null),
    [forwardingMessageId, messageById]
  );
  const replyCountByParentId = useMemo(() => countRepliesByParent(messages), [messages]);
  const threadReplyCountByParentId = useMemo(() => countRepliesByParent(threadMessages), [threadMessages]);
  const savedMessageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const message of savedMessages) ids.add(message.id);
    return ids;
  }, [savedMessages]);
  const filteredPinnedMessages = useMemo(() => {
    const query = pinnedSearchQuery.trim().toLowerCase();
    if (!query) return pinnedMessages;
    return pinnedMessages.filter((message) => {
      const body = message.body?.toLowerCase() || "";
      const sender = (message.sender_name || "").toLowerCase();
      return body.includes(query) || sender.includes(query) || summarizeMessage(message).toLowerCase().includes(query);
    });
  }, [pinnedMessages, pinnedSearchQuery]);
  const filteredSavedMessages = useMemo(() => {
    const query = savedSearchQuery.trim().toLowerCase();
    if (!query) return savedMessages;
    return savedMessages.filter((message) => {
      const body = message.body?.toLowerCase() || "";
      const sender = (message.sender_name || "").toLowerCase();
      const conversation = (message.conversation_name || "").toLowerCase();
      return body.includes(query) || sender.includes(query) || conversation.includes(query);
    });
  }, [savedMessages, savedSearchQuery]);
  const filteredTimelineMessages = useMemo(() => {
    if (messageTimelineFilter === "all") return messages;
    if (messageTimelineFilter === "media") {
      return messages.filter((message) => (message.attachments || []).some(isMessageMediaAttachment));
    }
    return messages.filter((message) => Boolean((message.attachments || []).length));
  }, [messageTimelineFilter, messages]);
  const filteredActivityEvents = useMemo(() => {
    if (activityFilter === "all") return activityEvents;
    return activityEvents.filter((event) => event.event_type === activityFilter);
  }, [activityEvents, activityFilter]);
  const activityEventTypeOptions = useMemo(() => {
    const values = new Set<ConversationActivityEvent["event_type"]>();
    for (const event of activityEvents) values.add(event.event_type);
    return Array.from(values).sort();
  }, [activityEvents]);
  const taskSummary = useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;
    let overdue = 0;
    let dueSoon = 0;
    let upcoming = 0;
    let noDue = 0;
    for (const task of channelTasks) {
      if (task.status === "todo") todo += 1;
      if (task.status === "in_progress") inProgress += 1;
      if (task.status === "done") done += 1;
      const dueInfo = getChannelDueInfo(task.due_at, timeNowMs);
      if (dueInfo.state === "overdue" && task.status !== "done") overdue += 1;
      if (dueInfo.state === "due_soon" && task.status !== "done") dueSoon += 1;
      if (dueInfo.state === "upcoming" && task.status !== "done") upcoming += 1;
      if (dueInfo.state === "none") noDue += 1;
    }
    return { todo, inProgress, done, overdue, dueSoon, upcoming, noDue };
  }, [channelTasks, timeNowMs]);
  const filteredChannelTasks = useMemo(() => {
    const query = taskSearchQuery.trim().toLowerCase();
    const filtered = channelTasks.filter((task) => {
      if (taskStatusFilter !== "all" && task.status !== taskStatusFilter) return false;
      if (showMyTasksOnly && task.assignee_id !== session?.user.id) return false;
      const dueInfo = getChannelDueInfo(task.due_at, timeNowMs);
      if (taskDueFilter !== "all" && dueInfo.state !== taskDueFilter) return false;
      if (!query) return true;
      return `${task.title} ${task.description || ""}`.toLowerCase().includes(query);
    });
    const statusRank: Record<ChannelTask["status"], number> = {
      todo: 0,
      in_progress: 1,
      done: 2,
    };
    return [...filtered].sort((a, b) => {
      if (taskSortMode === "status") {
        const rankDelta = statusRank[a.status] - statusRank[b.status];
        if (rankDelta !== 0) return rankDelta;
      }
      const aDueMs = new Date(a.due_at || "").getTime();
      const bDueMs = new Date(b.due_at || "").getTime();
      const aDue = Number.isFinite(aDueMs) ? aDueMs : Number.POSITIVE_INFINITY;
      const bDue = Number.isFinite(bDueMs) ? bDueMs : Number.POSITIVE_INFINITY;
      if (taskSortMode === "due_desc") {
        return bDue - aDue;
      }
      return aDue - bDue;
    });
  }, [
    channelTasks,
    session?.user.id,
    showMyTasksOnly,
    taskDueFilter,
    taskSearchQuery,
    taskSortMode,
    taskStatusFilter,
    timeNowMs,
  ]);
  const nextUrgentTaskWithMessage = useMemo(() => {
    return channelTasks
      .filter((task) => {
        if (!task.linked_message_id) return false;
        if (task.status === "done") return false;
        const dueInfo = getChannelDueInfo(task.due_at, timeNowMs);
        return dueInfo.state === "overdue" || dueInfo.state === "due_soon" || dueInfo.state === "upcoming";
      })
      .sort((a, b) => {
        const aDueMs = new Date(a.due_at || "").getTime();
        const bDueMs = new Date(b.due_at || "").getTime();
        const aDue = Number.isFinite(aDueMs) ? aDueMs : Number.POSITIVE_INFINITY;
        const bDue = Number.isFinite(bDueMs) ? bDueMs : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      })[0] || null;
  }, [channelTasks, timeNowMs]);
  const filteredChannelAssessments = useMemo(() => {
    const query = assessmentSearchQuery.trim().toLowerCase();
    return channelAssessments
      .filter((assessment) => {
        const dueInfo = getAssessmentDueState(assessment.due_at, timeNowMs);
        if (assessmentDueFilter !== "all" && dueInfo.state !== assessmentDueFilter) return false;
        if (!query) return true;
        return `${assessment.title} ${assessment.instructions || ""}`.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const aDue = new Date(a.due_at || "").getTime();
        const bDue = new Date(b.due_at || "").getTime();
        const aNorm = Number.isFinite(aDue) ? aDue : Number.POSITIVE_INFINITY;
        const bNorm = Number.isFinite(bDue) ? bDue : Number.POSITIVE_INFINITY;
        return aNorm - bNorm;
      });
  }, [assessmentDueFilter, assessmentSearchQuery, channelAssessments, timeNowMs]);
  const assessmentSummary = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let upcoming = 0;
    let none = 0;
    for (const assessment of channelAssessments) {
      const dueInfo = getAssessmentDueState(assessment.due_at, timeNowMs);
      if (dueInfo.state === "overdue") overdue += 1;
      if (dueInfo.state === "due_soon") dueSoon += 1;
      if (dueInfo.state === "upcoming") upcoming += 1;
      if (dueInfo.state === "none") none += 1;
    }
    return { overdue, dueSoon, upcoming, none };
  }, [channelAssessments, timeNowMs]);
  const nextUrgentAssessment = useMemo(() => {
    return channelAssessments
      .filter((assessment) => {
        const dueInfo = getAssessmentDueState(assessment.due_at, timeNowMs);
        return dueInfo.state === "overdue" || dueInfo.state === "due_soon" || dueInfo.state === "upcoming";
      })
      .sort((a, b) => {
        const aDueMs = new Date(a.due_at || "").getTime();
        const bDueMs = new Date(b.due_at || "").getTime();
        const aDue = Number.isFinite(aDueMs) ? aDueMs : Number.POSITIVE_INFINITY;
        const bDue = Number.isFinite(bDueMs) ? bDueMs : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      })[0] || null;
  }, [channelAssessments, timeNowMs]);
  const pendingAttachmentBytes = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + Number(file.size || 0), 0),
    [selectedFiles]
  );
  const attachmentQuotaRemainingBytes = useMemo(
    () => Number(attachmentQuota?.remainingBytes || 0),
    [attachmentQuota]
  );
  const pendingAttachmentRemainderBytes = useMemo(() => {
    if (!attachmentQuota) return null;
    return Math.max(0, attachmentQuotaRemainingBytes - pendingAttachmentBytes);
  }, [attachmentQuota, attachmentQuotaRemainingBytes, pendingAttachmentBytes]);
  const attachmentQuotaExhausted = Boolean(attachmentQuota && attachmentQuotaRemainingBytes <= 0);
  const attachmentQuotaPercentUsed = useMemo(() => {
    if (!attachmentQuota) return 0;
    return clampPercent(
      (Number(attachmentQuota.usage.totalBytes || 0) * 100) /
        Math.max(1, Number(attachmentQuota.quota.max_bytes || 1))
    );
  }, [attachmentQuota]);
  const attachmentQuotaWarning = useMemo(() => {
    if (!attachmentQuota) return null;
    const remaining = Number(attachmentQuota.remainingBytes || 0);
    if (remaining <= 0) return "Attachment quota reached.";
    const maxBytes = Number(attachmentQuota.quota.max_bytes || 0);
    if (maxBytes > 0 && remaining / maxBytes <= 0.2) {
      return `Low attachment quota: ${formatBytes(remaining)} remaining.`;
    }
    return null;
  }, [attachmentQuota]);
  const participantUserIds = useMemo(
    () => new Set(participants.map((participant) => participant.user_id)),
    [participants]
  );
  const visibleConversations = useMemo(() => {
    const query = conversationSearchQuery.trim().toLowerCase();
    const filtered = conversations.filter((conversation) => {
      if (!showArchivedConversations && conversation.archived_at && conversation.id !== activeId) return false;
      if (conversationTypeFilter !== "all" && conversation.type !== conversationTypeFilter) return false;
      if (conversationUnreadOnly && Number(conversation.unread_count || 0) <= 0 && conversation.id !== activeId)
        return false;
      if (conversationDueFilter !== "all") {
        if (conversation.type !== "channel") return false;
        const dueInfo = getChannelDueInfo(conversation.assignment_due_at, timeNowMs);
        if (conversationDueFilter === "due_soon" && dueInfo.state !== "due_soon") return false;
        if (conversationDueFilter === "overdue" && dueInfo.state !== "overdue") return false;
        if (conversationDueFilter === "no_due" && dueInfo.state !== "none") return false;
      }
      if (!query) return true;
      const haystack = `${conversation.name} ${conversation.last_message || ""}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;

      if (conversationSortMode === "name") {
        return a.name.localeCompare(b.name);
      }
      if (conversationSortMode === "unread") {
        const unreadDelta = Number(b.unread_count || 0) - Number(a.unread_count || 0);
        if (unreadDelta !== 0) return unreadDelta;
      }
      if (conversationSortMode === "due_risk") {
        const aDue = getChannelDueInfo(a.assignment_due_at, timeNowMs);
        const bDue = getChannelDueInfo(b.assignment_due_at, timeNowMs);
        const toScore = (state: ReturnType<typeof getChannelDueInfo>["state"]) =>
          state === "overdue" ? 3 : state === "due_soon" ? 2 : state === "upcoming" ? 1 : 0;
        const dueDelta = toScore(bDue.state) - toScore(aDue.state);
        if (dueDelta !== 0) return dueDelta;
      }
      const aTime = new Date(a.last_message_at || a.created_at).getTime();
      const bTime = new Date(b.last_message_at || b.created_at).getTime();
      return bTime - aTime;
    });

    return sorted;
  }, [
    activeId,
    conversationDueFilter,
    conversationSortMode,
    conversationSearchQuery,
    conversationTypeFilter,
    conversationUnreadOnly,
    conversations,
    showArchivedConversations,
    timeNowMs,
  ]);
  const conversationSummary = useMemo(() => {
    let unread = 0;
    let dueSoon = 0;
    let overdue = 0;
    for (const conversation of visibleConversations) {
      unread += Number(conversation.unread_count || 0);
      if (conversation.type !== "channel") continue;
      const due = getChannelDueInfo(conversation.assignment_due_at, timeNowMs);
      if (due.state === "due_soon") dueSoon += 1;
      if (due.state === "overdue") overdue += 1;
    }
    return {
      total: visibleConversations.length,
      unread,
      dueSoon,
      overdue,
    };
  }, [timeNowMs, visibleConversations]);
  const firstUnreadConversation = useMemo(
    () => visibleConversations.find((conversation) => Number(conversation.unread_count || 0) > 0) || null,
    [visibleConversations]
  );
  const currentParticipant = useMemo(
    () => participants.find((participant) => participant.user_id === session?.user.id) || null,
    [participants, session?.user.id]
  );
  const directPeerParticipant = useMemo(() => {
    if (!activeConversation || activeConversation.type !== "direct" || !session?.user.id) return null;
    return participants.find((participant) => participant.user_id !== session.user.id) || null;
  }, [activeConversation, participants, session]);
  const normalizedSessionRole = useMemo(() => {
    const rawRole = session?.user.role?.trim().toLowerCase();
    if (!rawRole) return "student";
    if (rawRole === "tutor" || rawRole === "admin" || rawRole === "teacher" || rawRole === "parent") {
      return rawRole;
    }
    return "student";
  }, [session?.user.role]);
  const sessionRoleLabel = `${normalizedSessionRole.charAt(0).toUpperCase()}${normalizedSessionRole.slice(1)}`;
  const urgentChannelConversation = useMemo(() => {
    let best: Conversation | null = null;
    let bestPriority = 0;
    let bestDueAt = Number.POSITIVE_INFINITY;
    for (const conversation of conversations) {
      if (conversation.type !== "channel" || conversation.archived_at) continue;
      const dueInfo = getChannelDueInfo(conversation.assignment_due_at, timeNowMs);
      const priority = dueInfo.state === "overdue" ? 3 : dueInfo.state === "due_soon" ? 2 : 0;
      if (priority === 0) continue;
      const dueAt = new Date(conversation.assignment_due_at || "").getTime();
      const normalizedDueAt = Number.isFinite(dueAt) ? dueAt : Number.POSITIVE_INFINITY;
      if (
        !best ||
        priority > bestPriority ||
        (priority === bestPriority && normalizedDueAt < bestDueAt)
      ) {
        best = conversation;
        bestPriority = priority;
        bestDueAt = normalizedDueAt;
      }
    }
    return best;
  }, [conversations, timeNowMs]);
  const urgentChannelDueLabel = useMemo(() => {
    if (!urgentChannelConversation) return null;
    return getChannelDueInfo(urgentChannelConversation.assignment_due_at, timeNowMs).label;
  }, [timeNowMs, urgentChannelConversation]);
  const roleQuickWidgets = useMemo(() => {
    const widgets: RoleQuickWidget[] = [
      {
        id: "focus-directory",
        title: "Find users by username",
        description: "Open username search to start a direct chat quickly.",
        actionLabel: "Open username search",
        action: "focus_directory",
      },
      {
        id: "focus-followed",
        title: "Message followed users",
        description: "Jump to followed users and invite them into active groups or channels.",
        actionLabel: "Open followed users",
        action: "focus_followed",
      },
    ];

    if (normalizedSessionRole === "tutor") {
      widgets.unshift({
        id: "create-channel",
        title: "Create assignment channel",
        description: "Launch a channel with due date tracking and assignment templates.",
        actionLabel: "New assignment channel",
        action: "create_channel",
      });
      widgets.push({
        id: "open-assignment-reminders",
        title: "Review assignment reminders",
        description:
          assignmentRemindersUnreadCount > 0
            ? `${assignmentRemindersUnreadCount} unread reminders need follow-up.`
            : "Open reminders to review due soon and overdue channels.",
        actionLabel: "Open reminders",
        action: "open_assignment_reminders",
        enabled: assignmentRemindersUnreadCount > 0 || assignmentReminders.length > 0,
      });
    } else if (normalizedSessionRole === "admin") {
      widgets.unshift({
        id: "open-mentions",
        title: "Review mention alerts",
        description:
          mentionsUnreadCount > 0
            ? `${mentionsUnreadCount} unread mentions may need moderation follow-up.`
            : "Open mentions to audit cross-conversation escalations.",
        actionLabel: "Open mentions",
        action: "open_mentions",
        enabled: mentionsUnreadCount > 0 || mentions.length > 0,
      });
      widgets.push({
        id: "open-moderation",
        title: "Review moderation feed",
        description: loadingModerationEvents
          ? "Refreshing recent trust and safety events."
          : moderationEvents.length > 0
          ? `${moderationEvents.length} recent event${moderationEvents.length === 1 ? "" : "s"} to review.`
          : "No recent moderation events detected.",
        actionLabel: "Open moderation feed",
        action: "open_moderation",
      });
      widgets.push({
        id: "open-due-channel",
        title: "Open highest-risk channel",
        description: urgentChannelConversation
          ? `${urgentChannelConversation.name}${
              urgentChannelDueLabel ? ` - ${urgentChannelDueLabel}` : ""
            }`
          : "No due soon or overdue channels detected right now.",
        actionLabel: "Open urgent channel",
        action: "open_due_channel",
        enabled: Boolean(urgentChannelConversation),
      });
    } else {
      widgets.unshift({
        id: "create-group",
        title: "Start a study group",
        description: "Create a group thread for assignment collaboration and quick check-ins.",
        actionLabel: "New group conversation",
        action: "create_group",
      });
      widgets.push({
        id: "open-due-channel",
        title: "Open urgent assignment channel",
        description: urgentChannelConversation
          ? `${urgentChannelConversation.name}${
              urgentChannelDueLabel ? ` - ${urgentChannelDueLabel}` : ""
            }`
          : "No due soon or overdue assignment channels found.",
        actionLabel: "Open urgent channel",
        action: "open_due_channel",
        enabled: Boolean(urgentChannelConversation),
      });
    }

    return widgets.slice(0, normalizedSessionRole === "admin" ? 5 : 4);
  }, [
    assignmentReminders.length,
    assignmentRemindersUnreadCount,
    loadingModerationEvents,
    mentions.length,
    mentionsUnreadCount,
    moderationEvents.length,
    normalizedSessionRole,
    urgentChannelConversation,
    urgentChannelDueLabel,
  ]);
  const snapshotRoleHint = useMemo(() => {
    if (!weeklySnapshot) return null;
    if (normalizedSessionRole === "tutor") {
      if (weeklySnapshot.overdueChannels > 0) {
        return `${weeklySnapshot.overdueChannels} overdue channel${
          weeklySnapshot.overdueChannels === 1 ? "" : "s"
        } need follow-up.`;
      }
      if (weeklySnapshot.dueSoonChannels > 0) {
        return `${weeklySnapshot.dueSoonChannels} channel${
          weeklySnapshot.dueSoonChannels === 1 ? "" : "s"
        } due within 72h.`;
      }
      return "No urgent channel deadlines in the current 7-day view.";
    }
    if (normalizedSessionRole === "admin") {
      if (weeklySnapshot.unreadMentions > 0) {
        return `${weeklySnapshot.unreadMentions} unread mention alert${
          weeklySnapshot.unreadMentions === 1 ? "" : "s"
        } require review.`;
      }
      return "No unread mention alerts right now.";
    }
    if (weeklySnapshot.dueSoonChannels > 0) {
      return `${weeklySnapshot.dueSoonChannels} assignment channel${
        weeklySnapshot.dueSoonChannels === 1 ? "" : "s"
      } are due soon.`;
    }
    return "No due-soon channels in your current weekly window.";
  }, [normalizedSessionRole, weeklySnapshot]);
  const canManageChannelRoles =
    activeConversation?.type === "channel" && currentParticipant?.role === "owner";
  const canInviteParticipants = activeConversation
    ? activeConversation.type === "channel"
      ? currentParticipant?.role === "owner" || currentParticipant?.role === "editor"
      : activeConversation.type === "group"
      ? true
      : false
    : false;
  const canManageArchive =
    activeConversation?.type === "channel" && currentParticipant?.role === "owner";
  const canEditAssignmentDetails =
    activeConversation?.type === "channel" &&
    (currentParticipant?.role === "owner" || currentParticipant?.role === "editor");
  const ownerParticipantCount = useMemo(
    () => participants.filter((participant) => participant.role === "owner").length,
    [participants]
  );
  const selectedTemplatePreset =
    assignmentTemplateId !== "none" ? CHANNEL_TEMPLATE_PRESETS[assignmentTemplateId] : undefined;
  const editSelectedTemplatePreset =
    editAssignmentTemplateId !== "none" && editAssignmentTemplateId !== KEEP_CURRENT_TEMPLATE_OPTION
      ? CHANNEL_TEMPLATE_PRESETS[editAssignmentTemplateId]
      : undefined;
  const viewerLocked = activeConversation?.type === "channel" && currentParticipant?.role === "viewer";
  const channelArchived = activeConversation?.type === "channel" && Boolean(activeConversation.archived_at);
  const canPinMessages = activeConversation
    ? activeConversation.type !== "channel" ||
      currentParticipant?.role === "owner" ||
      currentParticipant?.role === "editor"
    : false;
  const canReplyMessages =
    Boolean(activeConversation) && !settings?.blocked && !channelArchived && !viewerLocked;
  const isConversationMuted =
    Boolean(settings?.muted_until) && new Date(settings?.muted_until || "").getTime() > Date.now();
  const typingNames = useMemo(() => {
    const ids = Object.keys(typingByUserId);
    if (!ids.length) return [] as string[];
    return ids
      .filter((id) => id !== session?.user.id)
      .map((id) => {
        const participant = participants.find((item) => item.user_id === id);
        return participant?.name || "Someone";
      });
  }, [participants, session?.user.id, typingByUserId]);
  const typingIndicatorText = useMemo(() => {
    if (typingNames.length === 0) return null;
    if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
    if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing...`;
    return `${typingNames[0]}, ${typingNames[1]}, and ${typingNames.length - 2} others are typing...`;
  }, [typingNames]);
  const draftStorageKey =
    session?.user.id && activeConversation
      ? `saedu:draft:${session.user.id}:${activeConversation.id}`
      : null;
  const activeChannelDueInfo =
    activeConversation?.type === "channel"
      ? getChannelDueInfo(activeConversation.assignment_due_at, timeNowMs)
      : null;
  const activeChannelReminderInfo =
    activeConversation?.type === "channel"
      ? getChannelReminderInfo(
          activeConversation.assignment_due_at,
          settings?.assignment_reminder_mode,
          timeNowMs
        )
      : null;
  const activeReminderSnoozedUntilMs =
    settings?.assignment_reminder_snoozed_until &&
    Number.isFinite(new Date(settings.assignment_reminder_snoozed_until).getTime())
      ? new Date(settings.assignment_reminder_snoozed_until).getTime()
      : null;
  const activeReminderSnoozed =
    activeReminderSnoozedUntilMs !== null ? activeReminderSnoozedUntilMs > timeNowMs : false;
  const activeReminderSnoozePresetMinutes = (() => {
    if (!activeReminderSnoozed || activeReminderSnoozedUntilMs === null) return 0;
    const remainingMinutes = Math.max(1, Math.round((activeReminderSnoozedUntilMs - timeNowMs) / (60 * 1000)));
    if (remainingMinutes <= 240) return 240;
    if (remainingMinutes <= 1440) return 1440;
    return 4320;
  })();
  const explainableInsights = useMemo(() => {
    if (!activeConversation) return [] as ExplainableInsightCard[];

    const cards: ExplainableInsightCard[] = [];
    const visibleMessages = messages.filter((message) => !message.deleted_at);
    const viewerId = session?.user.id || null;

    if (viewerId) {
      const recent = visibleMessages.slice(-80);
      const replyDurationsMs: number[] = [];
      for (let index = 0; index < recent.length; index += 1) {
        const source = recent[index];
        if (source.sender_id === viewerId) continue;
        for (let cursor = index + 1; cursor < recent.length; cursor += 1) {
          const candidate = recent[cursor];
          if (candidate.sender_id !== viewerId) continue;
          const sourceAt = new Date(source.created_at).getTime();
          const replyAt = new Date(candidate.created_at).getTime();
          const deltaMs = replyAt - sourceAt;
          if (Number.isFinite(deltaMs) && deltaMs > 0 && deltaMs <= 12 * 60 * 60 * 1000) {
            replyDurationsMs.push(deltaMs);
          }
          break;
        }
      }

      if (replyDurationsMs.length > 0) {
        const averageMs = Math.round(
          replyDurationsMs.reduce((sum, value) => sum + value, 0) / replyDurationsMs.length
        );
        cards.push({
          id: "response-rhythm",
          title: "Response rhythm",
          value: `${toRelativeDurationShort(averageMs)} avg`,
          reason: `Based on ${replyDurationsMs.length} recent reply pairs.`,
          tone: averageMs <= 45 * 60 * 1000 ? "good" : averageMs >= 3 * 60 * 60 * 1000 ? "warn" : "neutral",
        });
      } else {
        cards.push({
          id: "response-rhythm",
          title: "Response rhythm",
          value: "Not enough data",
          reason: "Need at least one reply pair in this conversation.",
          tone: "neutral",
        });
      }
    }

    const activeWindowStartMs = timeNowMs - 24 * 60 * 60 * 1000;
    const activeSenders = new Set(
      visibleMessages
        .filter((message) => new Date(message.created_at).getTime() >= activeWindowStartMs)
        .map((message) => message.sender_id)
    );
    const participantCount = Math.max(1, participants.length);
    cards.push({
      id: "participation-spread",
      title: "Participation spread",
      value: `${activeSenders.size}/${participantCount} active`,
      reason: `Unique senders in the last 24h out of ${participantCount} participants.`,
      tone: activeSenders.size === 0 ? "warn" : "neutral",
    });

    if (activeConversation.type === "channel") {
      const dueState = activeChannelDueInfo?.state ?? "none";
      let value = "No due date";
      let reason = "Set an assignment due date to unlock due-risk tracking.";
      let tone: ExplainableInsightCard["tone"] = "neutral";
      if (dueState === "overdue") {
        value = "Overdue";
        reason = `${activeChannelDueInfo?.label || "Due date has passed"}. Overdue reminders repeat every ${
          settings?.assignment_overdue_repeat_hours ?? 24
        }h.`;
        tone = "warn";
      } else if (dueState === "due_soon") {
        value = "Due soon";
        reason = `${activeChannelDueInfo?.label || "Due soon"}. Reminder mode is ${displayReminderModeValue(
          settings?.assignment_reminder_mode
        )}${activeReminderSnoozed ? " and reminders are currently snoozed." : "."}`;
        tone = "warn";
      } else if (dueState === "upcoming") {
        value = "On track";
        reason = `${activeChannelDueInfo?.label || "Upcoming due date"}. Reminder mode is ${displayReminderModeValue(
          settings?.assignment_reminder_mode
        )}.`;
        tone = "good";
      }

      cards.push({
        id: "assignment-risk",
        title: "Assignment risk",
        value,
        reason,
        tone,
      });
    }

    return cards;
  }, [
    activeChannelDueInfo,
    activeConversation,
    activeReminderSnoozed,
    messages,
    participants,
    session?.user.id,
    settings?.assignment_overdue_repeat_hours,
    settings?.assignment_reminder_mode,
    timeNowMs,
  ]);

  const attachmentUrl = useCallback(
    (attachment: MessageAttachment) => attachment.url || `${apiBase}/messages/attachments/${attachment.id}`,
    [apiBase]
  );

  const mergeMessageIntoTimeline = useCallback((list: Message[], incoming: Message) => {
    const index = list.findIndex((message) => message.id === incoming.id);
    if (index < 0) {
      return [...list, incoming].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    const next = [...list];
    next[index] = { ...next[index], ...incoming };
    return next;
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    setPendingScrollMessageId(messageId);
  }, []);

  const loadMessageContext = useCallback(
    async (conversationId: string, messageId: string, before = 24, after = 48) => {
      if (!session) return null;
      try {
        const response = await fetch(
          `${apiBase}/messages/conversations/${conversationId}/messages/context?messageId=${encodeURIComponent(
            messageId
          )}&before=${before}&after=${after}`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) throw new Error("Unable to load message context.");
        const data = (await response.json()) as {
          messages: Message[];
          anchorMessageId: string;
          hasBefore: boolean;
          hasAfter: boolean;
        };
        return data;
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load message context.") });
        return null;
      }
    },
    [apiBase, session]
  );

  const jumpToMessage = useCallback(
    async (message: Message) => {
      if (!activeConversation) return;
      const existingInTimeline = messages.some((item) => item.id === message.id);
      if (existingInTimeline) {
        setMessages((prev) => mergeMessageIntoTimeline(prev, message));
      } else {
        const context = await loadMessageContext(activeConversation.id, message.id);
        if (context?.messages?.length) {
          setMessages(context.messages);
          setUnreadBoundaryMessageId(null);
        } else {
          setMessages((prev) => mergeMessageIntoTimeline(prev, message));
        }
      }
      scrollToMessage(message.id);
    },
    [activeConversation, loadMessageContext, mergeMessageIntoTimeline, messages, scrollToMessage]
  );

  const jumpToMessageById = useCallback(
    async (messageId: string) => {
      if (!activeConversation) return;
      if (messages.some((item) => item.id === messageId)) {
        scrollToMessage(messageId);
        return;
      }

      const context = await loadMessageContext(activeConversation.id, messageId);
      if (context?.messages?.length) {
        setMessages(context.messages);
        setUnreadBoundaryMessageId(null);
        scrollToMessage(messageId);
        return;
      }

      setNotice({ type: "info", message: "Original message is no longer available." });
    },
    [activeConversation, loadMessageContext, messages, scrollToMessage]
  );

  const resolveThreadRootId = useCallback(
    (message: Message) => {
      let current: Message | undefined = message;
      const seen = new Set<string>();
      while (current?.parent_message_id) {
        if (seen.has(current.id)) break;
        seen.add(current.id);
        const parent = messageById.get(current.parent_message_id);
        if (!parent) return current.parent_message_id;
        current = parent;
      }
      return current?.id || message.id;
    },
    [messageById]
  );

  const loadThread = useCallback(
    async (messageId: string) => {
      if (!session || !activeConversation) return;
      setLoadingThread(true);
      try {
        const response = await fetch(
          `${apiBase}/messages/conversations/${activeConversation.id}/threads/${messageId}?limit=120`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) throw new Error("Unable to load thread.");
        const data = (await response.json()) as {
          rootMessageId: string;
          messages: Message[];
        };
        setThreadRootMessageId(data.rootMessageId || messageId);
        setThreadMessages(data.messages || []);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load thread.") });
      } finally {
        setLoadingThread(false);
      }
    },
    [activeConversation, apiBase, session]
  );

  const openThreadForMessage = useCallback(
    (message: Message) => {
      const rootId = resolveThreadRootId(message);
      void loadThread(rootId);
    },
    [loadThread, resolveThreadRootId]
  );

  const clearRecorder = useCallback(() => {
    recorderRef.current = null;
    recorderChunksRef.current = [];
    recorderStartRef.current = null;
    if (recorderStreamRef.current) {
      for (const track of recorderStreamRef.current.getTracks()) track.stop();
      recorderStreamRef.current = null;
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!session) return;
    setLoadingConversations(true);
    try {
      const response = await fetch(`${apiBase}/messages/conversations`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load conversations.");
      const data = (await response.json()) as { conversations: Conversation[] };
      setConversations(sortConversations(data.conversations || []));
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load conversations.") });
    } finally {
      setLoadingConversations(false);
    }
  }, [apiBase, session]);

  const loadWeeklySnapshot = useCallback(
    async (windowDays = 7) => {
      if (!session) return;
      setLoadingWeeklySnapshot(true);
      try {
        const response = await fetch(
          `${apiBase}/messages/weekly-snapshot?windowDays=${encodeURIComponent(String(windowDays))}`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) throw new Error("Unable to load weekly snapshot.");
        const data = (await response.json()) as { snapshot?: WeeklyMessagingSnapshot };
        setWeeklySnapshot(data.snapshot || null);
      } catch (error) {
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, "Unable to load weekly messaging snapshot."),
        });
      } finally {
        setLoadingWeeklySnapshot(false);
      }
    },
    [apiBase, session]
  );

  const loadModerationEvents = useCallback(
    async (options?: {
      limit?: number;
      severity?: ModerationEventSeverity;
      type?: ModerationEventType;
    }) => {
      if (!session) return;
      setLoadingModerationEvents(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(options?.limit ?? 10));
        if (options?.severity) params.set("severity", options.severity);
        if (options?.type) params.set("type", options.type);
        const response = await fetch(`${apiBase}/admin/messages/moderation-feed?${params.toString()}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load moderation events.");
        const data = (await response.json()) as { events?: ModerationEvent[] };
        setModerationEvents(data.events || []);
      } catch (error) {
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, "Unable to load moderation events."),
        });
      } finally {
        setLoadingModerationEvents(false);
      }
    },
    [apiBase, session]
  );

  const loadInteractedUsers = useCallback(
    async (options?: {
      query?: string;
      cursor?: string | null;
      reset?: boolean;
      force?: boolean;
    }) => {
      if (!session) return;
      const query = (options?.query ?? "").trim();
      const reset = options?.reset ?? true;
      const force = options?.force ?? false;
      const cacheCursor = options?.cursor ?? null;
      if (!force) {
        const cached = readUserSearchCache(
          userSearchCacheRef.current,
          "interacted",
          query,
          cacheCursor
        );
        if (cached) {
          const incoming = cached.users as InteractedUser[];
          setInteractedUsers((prev) => {
            if (reset) return incoming;
            const merged = [...prev];
            const existing = new Set(prev.map((user) => user.user_id));
            for (const user of incoming) {
              if (!existing.has(user.user_id)) {
                merged.push(user);
              }
            }
            return merged;
          });
          setInteractedUsersHasMore(Boolean(cached.hasMore));
          setInteractedUsersNextCursor(cached.nextCursor ?? null);
          setLoadingInteracted(false);
          return;
        }
      }

      const params = new URLSearchParams();
      params.set("limit", "25");
      if (query) params.set("q", query);
      if (options?.cursor) params.set("cursor", options.cursor);

      setLoadingInteracted(true);
      try {
        const response = await fetch(`${apiBase}/messages/interactions?${params.toString()}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load interacted users.");
        const data = (await response.json()) as {
          users: InteractedUser[];
          hasMore?: boolean;
          nextCursor?: string | null;
        };
        const payload: UserSearchCachePayload = {
          users: data.users || [],
          hasMore: Boolean(data.hasMore),
          nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
        };
        writeUserSearchCache(userSearchCacheRef.current, "interacted", query, cacheCursor, payload);

        const incoming = payload.users as InteractedUser[];
        setInteractedUsers((prev) => {
          if (reset) return incoming;
          const merged = [...prev];
          const existing = new Set(prev.map((user) => user.user_id));
          for (const user of incoming) {
            if (!existing.has(user.user_id)) {
              merged.push(user);
            }
          }
          return merged;
        });
        setInteractedUsersHasMore(payload.hasMore);
        setInteractedUsersNextCursor(payload.nextCursor);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load interacted users.") });
      } finally {
        setLoadingInteracted(false);
      }
    },
    [apiBase, session]
  );

  const loadDirectoryUsers = useCallback(
    async (options: {
      query: string;
      cursor?: string | null;
      reset?: boolean;
      signal?: AbortSignal;
    }) => {
      if (!session) return;
      const query = options.query.trim().replace(/^@+/, "");
      if (!query) {
        setDirectoryResults([]);
        setDirectoryResultsHasMore(false);
        setDirectoryResultsNextCursor(null);
        setSearchingDirectory(false);
        return;
      }

      const reset = options.reset ?? true;
      const cached = readUserSearchCache(userSearchCacheRef.current, "directory", query, options.cursor);
      if (cached) {
        const incoming = cached.users || [];
        setDirectoryResults((prev) => {
          if (reset) return incoming;
          const merged = [...prev];
          const existing = new Set(prev.map((user) => user.user_id));
          for (const user of incoming) {
            if (!existing.has(user.user_id)) {
              merged.push(user);
            }
          }
          return merged;
        });
        setDirectoryResultsHasMore(Boolean(cached.hasMore));
        setDirectoryResultsNextCursor(cached.nextCursor ?? null);
        setSearchingDirectory(false);
        return;
      }

      const params = new URLSearchParams();
      params.set("username", query);
      params.set("limit", "12");
      if (options.cursor) params.set("cursor", options.cursor);

      setSearchingDirectory(true);
      try {
        const response = await fetch(`${apiBase}/profile/users/search?${params.toString()}`, {
          credentials: "include",
          signal: options.signal,
        });
        if (!response.ok) throw new Error("Unable to search users.");
        const data = (await response.json()) as {
          users: DirectoryUser[];
          hasMore?: boolean;
          nextCursor?: string | null;
        };
        const payload: UserSearchCachePayload = {
          users: data.users || [],
          hasMore: Boolean(data.hasMore),
          nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
        };
        writeUserSearchCache(userSearchCacheRef.current, "directory", query, options.cursor, payload);

        const incoming = payload.users;
        setDirectoryResults((prev) => {
          if (reset) return incoming;
          const merged = [...prev];
          const existing = new Set(prev.map((user) => user.user_id));
          for (const user of incoming) {
            if (!existing.has(user.user_id)) {
              merged.push(user);
            }
          }
          return merged;
        });
        setDirectoryResultsHasMore(payload.hasMore);
        setDirectoryResultsNextCursor(payload.nextCursor);
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to search users.") });
      } finally {
        if (!options.signal?.aborted) {
          setSearchingDirectory(false);
        }
      }
    },
    [apiBase, session]
  );

  const loadFollowedUsers = useCallback(
    async (options: {
      query: string;
      cursor?: string | null;
      reset?: boolean;
      signal?: AbortSignal;
    }) => {
      if (!session) return;
      const query = options.query.trim();
      if (!query) {
        setFollowedResults([]);
        setFollowedResultsHasMore(false);
        setFollowedResultsNextCursor(null);
        setSearchingFollowed(false);
        return;
      }

      const reset = options.reset ?? true;
      const cached = readUserSearchCache(userSearchCacheRef.current, "followed", query, options.cursor);
      if (cached) {
        const incoming = cached.users || [];
        setFollowedResults((prev) => {
          if (reset) return incoming;
          const merged = [...prev];
          const existing = new Set(prev.map((user) => user.user_id));
          for (const user of incoming) {
            if (!existing.has(user.user_id)) {
              merged.push(user);
            }
          }
          return merged;
        });
        setFollowedResultsHasMore(Boolean(cached.hasMore));
        setFollowedResultsNextCursor(cached.nextCursor ?? null);
        setSearchingFollowed(false);
        return;
      }

      const params = new URLSearchParams();
      params.set("q", query);
      params.set("limit", "12");
      if (options.cursor) params.set("cursor", options.cursor);

      setSearchingFollowed(true);
      try {
        const response = await fetch(`${apiBase}/messages/following/search?${params.toString()}`, {
          credentials: "include",
          signal: options.signal,
        });
        if (!response.ok) throw new Error("Unable to search followed users.");
        const data = (await response.json()) as {
          users: DirectoryUser[];
          hasMore?: boolean;
          nextCursor?: string | null;
        };
        const payload: UserSearchCachePayload = {
          users: data.users || [],
          hasMore: Boolean(data.hasMore),
          nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
        };
        writeUserSearchCache(userSearchCacheRef.current, "followed", query, options.cursor, payload);

        const incoming = payload.users;
        setFollowedResults((prev) => {
          if (reset) return incoming;
          const merged = [...prev];
          const existing = new Set(prev.map((user) => user.user_id));
          for (const user of incoming) {
            if (!existing.has(user.user_id)) {
              merged.push(user);
            }
          }
          return merged;
        });
        setFollowedResultsHasMore(payload.hasMore);
        setFollowedResultsNextCursor(payload.nextCursor);
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to search followed users.") });
      } finally {
        if (!options.signal?.aborted) {
          setSearchingFollowed(false);
        }
      }
    },
    [apiBase, session]
  );

  const loadMentions = useCallback(async () => {
    if (!session) return;
    setLoadingMentions(true);
    try {
      const response = await fetch(
        `${apiBase}/messages/mentions?limit=20&unreadOnly=${mentionsUnreadOnly ? "true" : "false"}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Unable to load mentions.");
      const data = (await response.json()) as { mentions: MentionNotification[]; unreadCount: number };
      setMentions(data.mentions || []);
      setMentionsUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load mentions.") });
    } finally {
      setLoadingMentions(false);
    }
  }, [apiBase, mentionsUnreadOnly, session]);

  const loadAssignmentReminders = useCallback(async () => {
    if (!session) return;
    setLoadingAssignmentReminders(true);
    try {
      const response = await fetch(
        `${apiBase}/messages/assignment-reminders?limit=30&unreadOnly=${
          assignmentRemindersUnreadOnly ? "true" : "false"
        }`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Unable to load assignment reminders.");
      const data = (await response.json()) as {
        reminders: AssignmentReminderNotification[];
        unreadCount: number;
      };
      setAssignmentReminders(data.reminders || []);
      setAssignmentRemindersUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to load assignment reminders."),
      });
    } finally {
      setLoadingAssignmentReminders(false);
    }
  }, [apiBase, assignmentRemindersUnreadOnly, session]);

  const loadSavedMessages = useCallback(async () => {
    if (!session) return;
    setLoadingSavedMessages(true);
    try {
      const response = await fetch(`${apiBase}/messages/saved?limit=80`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to load saved messages.");
      const data = (await response.json()) as { messages: SavedMessage[] };
      setSavedMessages(data.messages || []);
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load saved messages.") });
    } finally {
      setLoadingSavedMessages(false);
    }
  }, [apiBase, session]);

  const loadConversationState = useCallback(
    async (conversationId: string) => {
      if (!session) return;
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/state`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load conversation state.");
        const data = (await response.json()) as {
          participants: ConversationParticipant[];
          presence: ConversationPresence[];
          settings: ConversationSettings;
        };
        setParticipants(data.participants || []);
        setPresenceByUserId(toPresenceByUserId(data.presence || []));
        setSettings(normalizeConversationSettings(data.settings || null));
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load conversation state.") });
      }
    },
    [apiBase, session]
  );

  const sendTypingStatus = useCallback(
    async (conversationId: string, isTyping: boolean) => {
      if (!session) return;
      try {
        await fetch(`${apiBase}/messages/conversations/${conversationId}/typing`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ isTyping }),
        });
      } catch {
        // best effort
      }
    },
    [apiBase, session]
  );

  const stopTyping = useCallback(
    (conversationId?: string | null) => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      const targetConversationId = conversationId ?? typingConversationRef.current;
      if (typingActiveRef.current && targetConversationId) {
        void sendTypingStatus(targetConversationId, false);
      }
      typingActiveRef.current = false;
    },
    [sendTypingStatus]
  );

  const pulseTyping = useCallback(() => {
    if (!session || !activeConversation || !canReplyMessages) return;
    const conversationId = activeConversation.id;

    if (
      typingConversationRef.current &&
      typingConversationRef.current !== conversationId &&
      typingActiveRef.current
    ) {
      void sendTypingStatus(typingConversationRef.current, false);
      typingActiveRef.current = false;
    }

    typingConversationRef.current = conversationId;
    const now = Date.now();
    if (!typingActiveRef.current || now - typingLastSentAtRef.current > 2400) {
      typingActiveRef.current = true;
      typingLastSentAtRef.current = now;
      void sendTypingStatus(conversationId, true);
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      if (typingActiveRef.current && typingConversationRef.current === conversationId) {
        void sendTypingStatus(conversationId, false);
        typingActiveRef.current = false;
      }
    }, 3200);
  }, [activeConversation, canReplyMessages, sendTypingStatus, session]);

  const loadMessages = useCallback(
    async (conversationId: string, options?: { anchorMessageId?: string }) => {
      if (!session) return;
      loadingMessagesForConversationRef.current = conversationId;
      setLoadingMessages(true);
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/messages?limit=60`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load messages.");
        const data = (await response.json()) as {
          messages: Message[];
          hasMore?: boolean;
          firstUnreadMessageId?: string | null;
        };
        if (loadingMessagesForConversationRef.current !== conversationId) return;

        let timeline = data.messages || [];
        let unreadBoundary = data.firstUnreadMessageId || null;
        const anchorMessageId = options?.anchorMessageId ?? null;

        if (anchorMessageId) {
          const context = await loadMessageContext(conversationId, anchorMessageId);
          if (context?.messages?.length) {
            timeline = context.messages;
          }
          unreadBoundary = null;
        } else if (unreadBoundary && !timeline.some((message) => message.id === unreadBoundary)) {
          const context = await loadMessageContext(conversationId, unreadBoundary);
          if (context?.messages?.length) {
            timeline = context.messages;
            unreadBoundary = context.anchorMessageId;
          }
        }

        if (loadingMessagesForConversationRef.current !== conversationId) return;

        setMessages(timeline);
        const validUnreadBoundary =
          unreadBoundary && timeline.some((message) => message.id === unreadBoundary) ? unreadBoundary : null;
        setUnreadBoundaryMessageId(validUnreadBoundary);
        if (anchorMessageId) {
          scrollToMessage(anchorMessageId);
        } else if (validUnreadBoundary) {
          scrollToMessage(validUnreadBoundary);
        }
      } catch (error) {
        if (loadingMessagesForConversationRef.current === conversationId) {
          setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load messages.") });
        }
      } finally {
        if (loadingMessagesForConversationRef.current === conversationId) {
          loadingMessagesForConversationRef.current = null;
          setLoadingMessages(false);
        }
      }
    },
    [apiBase, loadMessageContext, scrollToMessage, session]
  );

  const loadActivityEvents = useCallback(
    async (conversationId: string) => {
      if (!session) return;
      setLoadingActivity(true);
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/activity?limit=40`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load activity history.");
        const data = (await response.json()) as { events: ConversationActivityEvent[] };
        setActivityEvents(data.events || []);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load activity history.") });
      } finally {
        setLoadingActivity(false);
      }
    },
    [apiBase, session]
  );

  const loadPinnedMessages = useCallback(
    async (conversationId: string) => {
      if (!session) return;
      setLoadingPins(true);
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/pins?limit=20`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load pinned messages.");
        const data = (await response.json()) as { messages: Message[] };
        setPinnedMessages(sortPinnedMessages(data.messages || []));
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load pinned messages.") });
      } finally {
        setLoadingPins(false);
      }
    },
    [apiBase, session]
  );

  const runMessageSearch = useCallback(
    async (conversationId: string, query: string) => {
      if (!session) return;
      const displayQuery = query.trim();
      const normalized = parseSearchTokenFromMe(displayQuery, session.user.id);
      if (!normalized) {
        setSearchingMessages(false);
        setMessageSearchResults([]);
        return;
      }
      setSearchingMessages(true);
      try {
        const response = await fetch(
          `${apiBase}/messages/conversations/${conversationId}/search?q=${encodeURIComponent(normalized)}&limit=20`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) throw new Error("Unable to search messages.");
        const data = (await response.json()) as { messages: Message[] };
        setMessageSearchResults(data.messages || []);
        if (session.user.id) {
          const historyKey = buildMessageSearchHistoryStorageKey(session.user.id, conversationId);
          try {
            const raw = window.localStorage.getItem(historyKey);
            const parsed = raw ? (JSON.parse(raw) as unknown) : [];
            const existing = Array.isArray(parsed)
              ? parsed.filter((entry): entry is string => typeof entry === "string")
              : [];
            const next = [displayQuery, ...existing.filter((entry) => entry !== displayQuery)].slice(
              0,
              MESSAGE_SEARCH_HISTORY_LIMIT
            );
            window.localStorage.setItem(historyKey, JSON.stringify(next));
            setMessageSearchHistory(next);
          } catch {
            // ignore localStorage errors
          }
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to search messages.") });
      } finally {
        setSearchingMessages(false);
      }
    },
    [apiBase, session]
  );

  const applyQuickSearchFilter = useCallback((token: string) => {
    setMessageSearchQuery((prev) => mergeSearchToken(prev, token));
    messageSearchInputRef.current?.focus();
  }, []);

  const clearMessageSearchHistory = useCallback(() => {
    if (!session?.user.id || !activeId) return;
    try {
      window.localStorage.removeItem(buildMessageSearchHistoryStorageKey(session.user.id, activeId));
    } catch {
      // ignore localStorage errors
    }
    setMessageSearchHistory([]);
  }, [activeId, session]);

  const loadAttachmentQuota = useCallback(
    async (conversationId: string) => {
      if (!session) return;
      setLoadingAttachmentQuota(true);
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/attachment-quota`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load attachment quota.");
        const data = (await response.json()) as AttachmentQuotaState;
        setAttachmentQuota(data);
        setAttachmentQuotaMaxMbInput(String(Math.max(1, Math.round(Number(data.quota.max_bytes || 0) / 1024 / 1024))));
        setAttachmentQuotaRetentionDaysInput(String(Math.max(1, Number(data.quota.retention_days || 30))));
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load attachment quota.") });
      } finally {
        setLoadingAttachmentQuota(false);
      }
    },
    [apiBase, session]
  );

  const saveAttachmentQuota = useCallback(async () => {
    if (!session || !activeConversation) return;
    const maxMb = Number(attachmentQuotaMaxMbInput);
    const retentionDays = Number(attachmentQuotaRetentionDaysInput);
    if (!Number.isFinite(maxMb) || maxMb < 1) {
      setNotice({ type: "error", message: "Attachment quota must be at least 1 MB." });
      return;
    }
    if (!Number.isFinite(retentionDays) || retentionDays < 1) {
      setNotice({ type: "error", message: "Retention days must be at least 1 day." });
      return;
    }
    setUpdatingAttachmentQuota(true);
    try {
      const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/attachment-quota`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          maxBytes: Math.floor(maxMb * 1024 * 1024),
          retentionDays: Math.floor(retentionDays),
        }),
      });
      const data = (await response.json().catch(() => null)) as AttachmentQuotaState | { error?: string } | null;
      if (!response.ok) throw new Error((data as { error?: string } | null)?.error || "Unable to update quota.");
      if (data && "quota" in data) {
        setAttachmentQuota(data);
      }
      setNotice({ type: "success", message: "Attachment quota updated." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update attachment quota.") });
    } finally {
      setUpdatingAttachmentQuota(false);
    }
  }, [
    activeConversation,
    apiBase,
    attachmentQuotaMaxMbInput,
    attachmentQuotaRetentionDaysInput,
    session,
  ]);

  const loadChannelTasks = useCallback(
    async (conversationId: string) => {
      if (!session) return;
      setLoadingChannelTasks(true);
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/channel-tasks?limit=120`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load channel tasks.");
        const data = (await response.json()) as { tasks?: ChannelTask[] };
        setChannelTasks(data.tasks || []);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load channel tasks.") });
      } finally {
        setLoadingChannelTasks(false);
      }
    },
    [apiBase, session]
  );

  const createChannelTaskByAction = useCallback(async () => {
    if (!session || !activeConversation || activeConversation.type !== "channel") return;
    const title = newTaskTitle.trim();
    if (!title) {
      setNotice({ type: "error", message: "Task title is required." });
      return;
    }
    const dueAtCandidate = newTaskDueAt ? new Date(newTaskDueAt) : null;
    if (dueAtCandidate && Number.isNaN(dueAtCandidate.getTime())) {
      setNotice({ type: "error", message: "Please provide a valid task due date." });
      return;
    }
    const dueAtIso = dueAtCandidate ? dueAtCandidate.toISOString() : undefined;
    setCreatingChannelTask(true);
    try {
      const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/channel-tasks`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          title,
          description: newTaskDescription.trim() || undefined,
          dueAt: dueAtIso,
          assigneeId: newTaskAssigneeId || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as { task?: ChannelTask; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Unable to create channel task.");
      if (data?.task) {
        setChannelTasks((prev) => [data.task as ChannelTask, ...prev]);
      }
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskDueAt("");
      setNewTaskAssigneeId("");
      setNotice({ type: "success", message: "Channel task created." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to create channel task.") });
    } finally {
      setCreatingChannelTask(false);
    }
  }, [
    activeConversation,
    apiBase,
    newTaskAssigneeId,
    newTaskDescription,
    newTaskDueAt,
    newTaskTitle,
    session,
  ]);

  const updateTaskStatus = useCallback(
    async (taskId: string, status: ChannelTask["status"]) => {
      if (!session || !activeConversation || activeConversation.type !== "channel") return;
      setUpdatingTaskId(taskId);
      try {
        const response = await fetch(
          `${apiBase}/messages/conversations/${activeConversation.id}/channel-tasks/${taskId}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": session.csrfToken,
            },
            body: JSON.stringify({ status }),
          }
        );
        const data = (await response.json().catch(() => null)) as { task?: ChannelTask; error?: string } | null;
        if (!response.ok) throw new Error(data?.error || "Unable to update task status.");
        if (data?.task) {
          setChannelTasks((prev) =>
            prev.map((task) => (task.id === taskId ? (data.task as ChannelTask) : task))
          );
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update task status.") });
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [activeConversation, apiBase, session]
  );

  const loadChannelAssessments = useCallback(
    async (conversationId: string) => {
      if (!session) return;
      setLoadingChannelAssessments(true);
      try {
        const response = await fetch(
          `${apiBase}/messages/conversations/${conversationId}/channel-assessments?limit=80`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) throw new Error("Unable to load assessments.");
        const data = (await response.json()) as { assessments?: ChannelAssessment[] };
        setChannelAssessments(data.assessments || []);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load channel assessments.") });
      } finally {
        setLoadingChannelAssessments(false);
      }
    },
    [apiBase, session]
  );

  const createChannelAssessmentByAction = useCallback(async () => {
    if (!session || !activeConversation || activeConversation.type !== "channel") return;
    const title = newAssessmentTitle.trim();
    if (!title) {
      setNotice({ type: "error", message: "Assessment title is required." });
      return;
    }
    const dueAtCandidate = newAssessmentDueAt ? new Date(newAssessmentDueAt) : null;
    if (dueAtCandidate && Number.isNaN(dueAtCandidate.getTime())) {
      setNotice({ type: "error", message: "Please provide a valid assessment due date." });
      return;
    }
    const dueAtIso = dueAtCandidate ? dueAtCandidate.toISOString() : undefined;
    const maxScore = Number(newAssessmentMaxScore);
    setCreatingChannelAssessment(true);
    try {
      const response = await fetch(
        `${apiBase}/messages/conversations/${activeConversation.id}/channel-assessments`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({
            title,
            instructions: newAssessmentInstructions.trim() || undefined,
            questions: [],
            maxScore: Number.isFinite(maxScore) ? Math.max(1, Math.floor(maxScore)) : 100,
            dueAt: dueAtIso,
          }),
        }
      );
      const data = (await response.json().catch(() => null)) as
        | { assessment?: ChannelAssessment; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "Unable to create assessment.");
      if (data?.assessment) {
        setChannelAssessments((prev) => [data.assessment as ChannelAssessment, ...prev]);
      }
      setNewAssessmentTitle("");
      setNewAssessmentInstructions("");
      setNewAssessmentDueAt("");
      setNewAssessmentMaxScore("100");
      setNotice({ type: "success", message: "Assessment created." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to create assessment.") });
    } finally {
      setCreatingChannelAssessment(false);
    }
  }, [
    activeConversation,
    apiBase,
    newAssessmentDueAt,
    newAssessmentInstructions,
    newAssessmentMaxScore,
    newAssessmentTitle,
    session,
  ]);

  const toggleMessagePin = useCallback(
    async (messageId: string, shouldPin: boolean) => {
      if (!session || !activeConversation) return;
      setPinningMessageId(messageId);
      try {
        const response = await fetch(`${apiBase}/messages/messages/${messageId}/pin`, {
          method: shouldPin ? "PUT" : "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: shouldPin ? JSON.stringify({}) : undefined,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update pin state.");
        const updatedMessage = data?.message as Message | undefined;
        if (updatedMessage) {
          setMessages((prev) => mergeMessageIntoTimeline(prev, updatedMessage));
          setMessageSearchResults((prev) =>
            prev.map((message) => (message.id === updatedMessage.id ? { ...message, ...updatedMessage } : message))
          );
          setPinnedMessages((prev) => {
            if (shouldPin) {
              return sortPinnedMessages([
                updatedMessage,
                ...prev.filter((message) => message.id !== updatedMessage.id),
              ]);
            }
            return prev.filter((message) => message.id !== updatedMessage.id);
          });
        }
        await loadActivityEvents(activeConversation.id);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update pin state.") });
      } finally {
        setPinningMessageId(null);
      }
    },
    [activeConversation, apiBase, loadActivityEvents, mergeMessageIntoTimeline, session]
  );

  const toggleChannelArchive = useCallback(
    async (archived: boolean) => {
      if (!session || !activeConversation || activeConversation.type !== "channel") return;
      setTogglingArchive(true);
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/archive`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ archived }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update archive state.");
        const nextArchiveState = data?.conversation as
          | { archived_at?: string | null; archived_by?: string | null }
          | undefined;
        setConversations((prev) =>
          sortConversations(
            prev.map((conversation) =>
              conversation.id === activeConversation.id
                ? {
                    ...conversation,
                    archived_at: nextArchiveState?.archived_at ?? null,
                    archived_by: nextArchiveState?.archived_by ?? null,
                  }
                : conversation
            )
          )
        );
        if (archived) {
          setComposer("");
          setSelectedFiles([]);
          setVoiceDurationSeconds(null);
          setNotice({ type: "info", message: "Channel archived and set to read-only." });
        } else {
          setNotice({ type: "success", message: "Channel unarchived." });
        }
        await loadActivityEvents(activeConversation.id);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update archive state.") });
      } finally {
        setTogglingArchive(false);
      }
    },
    [activeConversation, apiBase, loadActivityEvents, session]
  );

  const openAssignmentEditor = useCallback(() => {
    if (!activeConversation || activeConversation.type !== "channel") return;
    setEditChannelName(activeConversation.name || "");
    setEditAssignmentTitle(activeConversation.assignment_title || "");
    setEditAssignmentDescription(activeConversation.assignment_description || "");
    setEditAssignmentDueAt(toDateTimeLocalValue(activeConversation.assignment_due_at));
    const templateId =
      activeConversation.assignment_template && typeof activeConversation.assignment_template.templateId === "string"
        ? activeConversation.assignment_template.templateId
        : null;
    if (templateId && CHANNEL_TEMPLATE_PRESETS[templateId]) {
      setEditAssignmentTemplateId(templateId);
    } else if (activeConversation.assignment_template) {
      setEditAssignmentTemplateId(KEEP_CURRENT_TEMPLATE_OPTION);
    } else {
      setEditAssignmentTemplateId("none");
    }
    setEditingAssignmentDetails(true);
  }, [activeConversation]);

  const cancelAssignmentEditor = useCallback(() => {
    setEditingAssignmentDetails(false);
  }, []);

  const saveChannelAssignmentDetails = useCallback(async () => {
    if (!session || !activeConversation || activeConversation.type !== "channel") return;
    const normalizedName = editChannelName.trim();
    const normalizedAssignmentTitle = editAssignmentTitle.trim();
    if (!normalizedName) {
      setNotice({ type: "error", message: "Channel name is required." });
      return;
    }
    if (!normalizedAssignmentTitle) {
      setNotice({ type: "error", message: "Assignment title is required." });
      return;
    }

    let dueAtIso: string | null = null;
    if (editAssignmentDueAt) {
      const dueDate = new Date(editAssignmentDueAt);
      if (Number.isNaN(dueDate.getTime())) {
        setNotice({ type: "error", message: "Please provide a valid due date and time." });
        return;
      }
      dueAtIso = dueDate.toISOString();
    }

    const assignmentTemplatePayload =
      editAssignmentTemplateId === KEEP_CURRENT_TEMPLATE_OPTION
        ? undefined
        : editAssignmentTemplateId === "none"
        ? null
        : buildChannelAssignmentTemplate(editAssignmentTemplateId, { dueAtIso });

    setSavingAssignmentDetails(true);
    try {
      const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/channel`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          name: normalizedName,
          assignmentTitle: normalizedAssignmentTitle,
          assignmentDescription: editAssignmentDescription.trim() || null,
          assignmentDueAt: dueAtIso,
          assignmentTemplate: assignmentTemplatePayload,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to update channel details.");

      const updatedConversation = data?.conversation as Conversation | undefined;
      if (updatedConversation) {
        setConversations((prev) =>
          sortConversations(
            prev.map((conversation) =>
              conversation.id === updatedConversation.id
                ? {
                    ...conversation,
                    name: updatedConversation.name,
                    assignment_title: updatedConversation.assignment_title ?? null,
                    assignment_description: updatedConversation.assignment_description ?? null,
                    assignment_due_at: updatedConversation.assignment_due_at ?? null,
                    assignment_template: updatedConversation.assignment_template ?? null,
                  }
                : conversation
            )
          )
        );
      }
      setEditingAssignmentDetails(false);
      setNotice({ type: "success", message: "Channel assignment details updated." });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to update channel assignment details."),
      });
    } finally {
      setSavingAssignmentDetails(false);
    }
  }, [
    activeConversation,
    apiBase,
    editAssignmentDescription,
    editAssignmentDueAt,
    editAssignmentTemplateId,
    editAssignmentTitle,
    editChannelName,
    session,
  ]);

  const editMessage = useCallback(
    async (messageId: string, body: string) => {
      if (!session || !activeConversation) return;
      const normalized = body.trim();
      if (!normalized) return;
      setSavingEditMessageId(messageId);
      try {
        const response = await fetch(`${apiBase}/messages/messages/${messageId}/edit`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ body: normalized }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to edit message.");
        const updated = data?.message as Message | undefined;
        if (updated) {
          setMessages((prev) => syncReplyPreviewReferences(mergeMessageIntoTimeline(prev, updated), updated));
          setMessageSearchResults((prev) =>
            syncReplyPreviewReferences(
              prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)),
              updated
            )
          );
          setPinnedMessages((prev) =>
            syncReplyPreviewReferences(
              prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)),
              updated
            )
          );
          setReplyingToMessage((current) => (current?.id === updated.id ? toReplyPreview(updated) : current));
          setConversations((prev) =>
            sortConversations(
              prev.map((conversation) =>
                conversation.id === activeConversation.id
                  ? {
                      ...conversation,
                      last_message: summarizeMessage(updated),
                      last_message_at: updated.created_at,
                    }
                  : conversation
              )
            )
          );
        }
        setEditingMessageId(null);
        setEditingBody("");
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to edit message.") });
      } finally {
        setSavingEditMessageId(null);
      }
    },
    [activeConversation, apiBase, mergeMessageIntoTimeline, session]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!session || !activeConversation) return;
      setDeletingMessageId(messageId);
      try {
        const response = await fetch(`${apiBase}/messages/messages/${messageId}`, {
          method: "DELETE",
          credentials: "include",
          headers: {
            "x-csrf-token": session.csrfToken,
          },
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to delete message.");
        const updated = data?.message as Message | undefined;
        if (updated) {
          setMessages((prev) => syncReplyPreviewReferences(mergeMessageIntoTimeline(prev, updated), updated));
          setMessageSearchResults((prev) =>
            syncReplyPreviewReferences(
              prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)),
              updated
            )
          );
          setPinnedMessages((prev) =>
            syncReplyPreviewReferences(
              prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)),
              updated
            )
          );
          setReplyingToMessage((current) => (current?.id === updated.id ? toReplyPreview(updated) : current));
          setConversations((prev) =>
            sortConversations(
              prev.map((conversation) =>
                conversation.id === activeConversation.id
                  ? {
                      ...conversation,
                      last_message: summarizeMessage(updated),
                      last_message_at: updated.created_at,
                    }
                  : conversation
              )
            )
          );
        }
        if (editingMessageId === messageId) {
          setEditingMessageId(null);
          setEditingBody("");
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to delete message.") });
      } finally {
        setDeletingMessageId(null);
      }
    },
    [activeConversation, apiBase, editingMessageId, mergeMessageIntoTimeline, session]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!session) return;
      const normalizedEmoji = emoji.trim();
      if (!normalizedEmoji) return;
      setReactingMessageKey(`${messageId}:${normalizedEmoji}`);
      try {
        const response = await fetch(`${apiBase}/messages/messages/${messageId}/reactions`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ emoji: normalizedEmoji }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update reaction.");
        const updated = data?.message as Message | undefined;
        if (updated) {
          setMessages((prev) => mergeMessageIntoTimeline(prev, updated));
          setMessageSearchResults((prev) =>
            prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message))
          );
          setPinnedMessages((prev) =>
            prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message))
          );
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update reaction.") });
      } finally {
        setReactingMessageKey(null);
      }
    },
    [apiBase, mergeMessageIntoTimeline, session]
  );

  useEffect(() => {
    if (!session) return;
    void loadConversations();
    void loadSavedMessages();
  }, [loadConversations, loadSavedMessages, session]);

  useEffect(() => {
    if (!session) return;
    void loadMentions();
  }, [loadMentions, session]);

  useEffect(() => {
    if (!session) return;
    void loadAssignmentReminders();
  }, [loadAssignmentReminders, session]);

  useEffect(() => {
    if (!session) return;
    void loadWeeklySnapshot(7);
    const timer = window.setInterval(() => {
      void loadWeeklySnapshot(7);
    }, 90_000);
    return () => window.clearInterval(timer);
  }, [loadWeeklySnapshot, session]);

  useEffect(() => {
    if (!session || normalizedSessionRole !== "admin" || !showModerationTools) {
      setModerationEvents([]);
      setLoadingModerationEvents(false);
      setOpeningModerationEventId(null);
      return;
    }
    const severity = moderationSeverityFilter === "all" ? undefined : moderationSeverityFilter;
    const type = moderationTypeFilter === "all" ? undefined : moderationTypeFilter;
    void loadModerationEvents({ limit: 10, severity, type });
    const timer = window.setInterval(() => {
      void loadModerationEvents({ limit: 10, severity, type });
    }, 90_000);
    return () => window.clearInterval(timer);
  }, [
    loadModerationEvents,
    moderationSeverityFilter,
    moderationTypeFilter,
    normalizedSessionRole,
    session,
    showModerationTools,
  ]);

  useEffect(() => {
    if (!session || !activeId) {
      stopTyping();
      setMessages([]);
      setParticipants([]);
      setPresenceByUserId({});
      setTypingByUserId({});
      setSettings(null);
      setComposer("");
      setReplyingToMessage(null);
      setIsDragActive(false);
      setPinnedMessages([]);
      setThreadRootMessageId(null);
      setThreadMessages([]);
      setLoadingThread(false);
      setEditingMessageId(null);
      setEditingBody("");
      setSavingEditMessageId(null);
      setDeletingMessageId(null);
      setReactingMessageKey(null);
      setForwardingMessageId(null);
      setForwardTargetConversationId("");
      setForwardNote("");
      setForwardingMessage(false);
      setActivityEvents([]);
      setMessageSearchQuery("");
      setMessageSearchHistory([]);
      setMessageSearchResults([]);
      setSearchingMessages(false);
      setUnreadBoundaryMessageId(null);
      setPendingScrollMessageId(null);
      setAttachmentQuota(null);
      setChannelTasks([]);
      setChannelAssessments([]);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskDueAt("");
      setNewTaskAssigneeId("");
      setTaskSearchQuery("");
      setTaskStatusFilter("all");
      setTaskDueFilter("all");
      setTaskSortMode("due_asc");
      setShowMyTasksOnly(false);
      setNewAssessmentTitle("");
      setNewAssessmentInstructions("");
      setNewAssessmentDueAt("");
      setNewAssessmentMaxScore("100");
      setAssessmentSearchQuery("");
      setAssessmentDueFilter("all");
      return;
    }
    const pendingAnchor = pendingAnchorMessageRef.current;
    const anchorMessageId =
      pendingAnchor?.conversationId === activeId ? pendingAnchor.messageId : undefined;
    if (anchorMessageId) pendingAnchorMessageRef.current = null;
    setActivityEvents([]);
    setTypingByUserId({});
    void loadMessages(activeId, anchorMessageId ? { anchorMessageId } : undefined);
    void loadConversationState(activeId);
    void loadPinnedMessages(activeId);
    void loadActivityEvents(activeId);
    if (liteModeEnabled) {
      setAttachmentQuota(null);
    } else {
      void loadAttachmentQuota(activeId);
    }
    const conversation = conversations.find((entry) => entry.id === activeId);
    if (conversation?.type === "channel") {
      void loadChannelTasks(activeId);
      void loadChannelAssessments(activeId);
    } else {
      setChannelTasks([]);
      setChannelAssessments([]);
    }
    setMessageSearchQuery("");
    setMessageSearchHistory([]);
    setMessageSearchResults([]);
    setSearchingMessages(false);
    setThreadRootMessageId(null);
    setThreadMessages([]);
    setLoadingThread(false);
    setHighlightedMessageId(null);
    setEditingMessageId(null);
    setEditingBody("");
    setSavingEditMessageId(null);
      setDeletingMessageId(null);
      setReactingMessageKey(null);
      setRemovingParticipantUserId(null);
      setLeavingConversation(false);
      setSavingMuteWindow(false);
      setForwardingMessageId(null);
    setForwardTargetConversationId("");
    setForwardNote("");
    setForwardingMessage(false);
    setReplyingToMessage(null);
    setIsDragActive(false);
    setTaskSearchQuery("");
    setTaskStatusFilter("all");
    setTaskDueFilter("all");
    setTaskSortMode("due_asc");
    setShowMyTasksOnly(false);
    setAssessmentSearchQuery("");
    setAssessmentDueFilter("all");
  }, [
    activeId,
    conversations,
    loadActivityEvents,
    loadAttachmentQuota,
    loadChannelAssessments,
    loadChannelTasks,
    loadConversationState,
    loadMessages,
    loadPinnedMessages,
    liteModeEnabled,
    session,
    stopTyping,
  ]);

  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const stored = window.localStorage.getItem(draftStorageKey);
      if (stored !== null) {
        setComposer(stored);
      } else {
        setComposer("");
      }
    } catch {
      // ignore localStorage errors
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      if (composer.trim()) {
        window.localStorage.setItem(draftStorageKey, composer);
      } else {
        window.localStorage.removeItem(draftStorageKey);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [composer, draftStorageKey]);

  useEffect(() => {
    if (!session || !activeConversation || !canReplyMessages) {
      stopTyping();
      return;
    }
    if (composer.trim()) {
      pulseTyping();
    } else {
      stopTyping(activeConversation.id);
    }
  }, [activeConversation, canReplyMessages, composer, pulseTyping, session, stopTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  useEffect(() => {
    if (!isRecordingVoice) {
      setRecordingElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      if (!recorderStartRef.current) return;
      setRecordingElapsedSeconds(Math.max(0, Math.round((Date.now() - recorderStartRef.current) / 1000)));
    }, 300);
    return () => window.clearInterval(timer);
  }, [isRecordingVoice]);

  useEffect(() => {
    if (!Object.keys(typingByUserId).length) return;
    const interval = window.setInterval(() => {
      setTypingByUserId((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const [userId, expiresAt] of Object.entries(prev)) {
          if (expiresAt <= now) {
            delete next[userId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 900);

    return () => window.clearInterval(interval);
  }, [typingByUserId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      const editingTarget =
        targetTag === "input" ||
        targetTag === "textarea" ||
        target?.isContentEditable === true;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        conversationSearchInputRef.current?.focus();
        conversationSearchInputRef.current?.select();
        return;
      }

      if (!editingTarget && event.altKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        if (!firstUnreadConversation) return;
        setActiveId(firstUnreadConversation.id);
        return;
      }

      if (!editingTarget && event.key === "/" && activeConversation) {
        event.preventDefault();
        composerInputRef.current?.focus();
        return;
      }

      if (!editingTarget && (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k")) {
        if (!visibleConversations.length) return;
        const currentIndex = Math.max(
          0,
          visibleConversations.findIndex((conversation) => conversation.id === activeId)
        );
        const delta = event.key.toLowerCase() === "j" ? 1 : -1;
        const nextIndex = Math.min(visibleConversations.length - 1, Math.max(0, currentIndex + delta));
        const nextConversation = visibleConversations[nextIndex];
        if (!nextConversation || nextConversation.id === activeId) return;
        event.preventDefault();
        setActiveId(nextConversation.id);
        return;
      }

      if (!editingTarget && event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        if (!visibleConversations.length) return;
        const currentIndex = Math.max(
          0,
          visibleConversations.findIndex((conversation) => conversation.id === activeId)
        );
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(visibleConversations.length - 1, Math.max(0, currentIndex + delta));
        const nextConversation = visibleConversations[nextIndex];
        if (!nextConversation || nextConversation.id === activeId) return;
        event.preventDefault();
        setActiveId(nextConversation.id);
        return;
      }

      if (event.key === "Escape" && messageSearchQuery.trim()) {
        setMessageSearchQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeConversation,
    activeId,
    firstUnreadConversation,
    messageSearchQuery,
    visibleConversations,
  ]);

  useEffect(() => {
    if (!activeConversation || !session) return;
    const timer = window.setInterval(() => {
      void loadAttachmentQuota(activeConversation.id);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [activeConversation, loadAttachmentQuota, session]);

  useEffect(() => {
    if (!session) return;
    const query = directorySearch.trim().replace(/^@+/, "");
    if (!query) {
      setDirectoryResults([]);
      setDirectoryResultsHasMore(false);
      setDirectoryResultsNextCursor(null);
      setSearchingDirectory(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      await loadDirectoryUsers({ query, reset: true, signal: controller.signal });
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [directorySearch, loadDirectoryUsers, session]);

  useEffect(() => {
    if (!session) return;
    const query = followedSearch.trim();
    if (!query) {
      setFollowedResults([]);
      setFollowedResultsHasMore(false);
      setFollowedResultsNextCursor(null);
      setSearchingFollowed(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      await loadFollowedUsers({ query, reset: true, signal: controller.signal });
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [followedSearch, loadFollowedUsers, session]);

  useEffect(() => {
    if (!session) return;
    const query = interactedSearch.trim();
    const timer = window.setTimeout(() => {
      void loadInteractedUsers({
        query,
        reset: true,
      });
    }, 260);

    return () => window.clearTimeout(timer);
  }, [interactedSearch, loadInteractedUsers, session]);

  useEffect(() => {
    if (!session?.user.id || !activeId) {
      setMessageSearchHistory([]);
      return;
    }
    try {
      const key = buildMessageSearchHistoryStorageKey(session.user.id, activeId);
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(parsed)) {
        setMessageSearchHistory([]);
        return;
      }
      const sanitized = parsed
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .slice(0, MESSAGE_SEARCH_HISTORY_LIMIT);
      setMessageSearchHistory(sanitized);
    } catch {
      setMessageSearchHistory([]);
    }
  }, [activeId, session?.user.id]);

  useEffect(() => {
    if (!session || !activeId) {
      setSearchingMessages(false);
      setMessageSearchResults([]);
      return;
    }
    const query = messageSearchQuery.trim();
    if (!query) {
      setSearchingMessages(false);
      setMessageSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void runMessageSearch(activeId, query);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [activeId, messageSearchQuery, runMessageSearch, session]);

  useEffect(() => {
    if (!session || !activeId) return;
    let cancelled = false;

    const clearReconnectTimer = () => {
      if (messageStreamReconnectTimerRef.current == null) return;
      window.clearTimeout(messageStreamReconnectTimerRef.current);
      messageStreamReconnectTimerRef.current = null;
    };

    const closeActiveStream = () => {
      messageStreamDetachRef.current?.();
      messageStreamDetachRef.current = null;
      if (!messageStreamRef.current) return;
      messageStreamRef.current.close();
      messageStreamRef.current = null;
    };

    const onMessage = (event: Event) => {
      let payload: MessageEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as MessageEventPayload;
      } catch {
        payload = null;
      }
      if (!payload?.message) return;
      const incoming = payload.message;
      const preview = summarizeMessage(incoming);

      setConversations((prev) => {
        const index = prev.findIndex((item) => item.id === payload!.conversationId);
        if (index < 0) {
          void loadConversations();
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...next[index],
          last_message: preview,
          last_message_at: incoming.created_at,
          unread_count:
            payload!.conversationId === activeIdRef.current || incoming.sender_id === session.user.id
              ? 0
              : Number(next[index].unread_count || 0) + 1,
        };
        return sortConversations(next);
      });

      if (payload.conversationId !== activeIdRef.current) return;
      setMessages((prev) => {
        return mergeMessageIntoTimeline(prev, incoming);
      });
      const openThreadRootId = threadRootMessageIdRef.current;
      const openThreadMessageIds = threadMessageIdsRef.current;
      if (
        openThreadRootId &&
        (incoming.id === openThreadRootId ||
          (incoming.parent_message_id &&
            (incoming.parent_message_id === openThreadRootId ||
              openThreadMessageIds.has(incoming.parent_message_id))))
      ) {
        setThreadMessages((prev) => {
          const merged = mergeMessageIntoTimeline(prev, incoming);
          return merged;
        });
      }

      if (
        incoming.sender_id !== session.user.id &&
        incoming.mention_user_ids?.includes(session.user.id) &&
        settings?.mention_notifications !== false &&
        !isConversationMuted
      ) {
        void loadMentions();
        setNotice({
          type: "info",
          message: `You were mentioned in ${activeConversation?.name || "a conversation"}.`,
        });
      }
    };

    const onRead = (event: Event) => {
      let payload: ReadEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as ReadEventPayload;
      } catch {
        payload = null;
      }
      if (!payload) return;
      if (payload.conversationId !== activeIdRef.current) return;
      if (payload.userId === session.user.id) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.sender_id === session.user.id ? { ...message, delivery_status: "read" } : message
        )
      );
      void loadMentions();
    };

    const onTyping = (event: Event) => {
      let payload: TypingEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as TypingEventPayload;
      } catch {
        payload = null;
      }
      if (!payload) return;
      if (payload.conversationId !== activeIdRef.current) return;
      if (payload.userId === session.user.id) return;

      setTypingByUserId((prev) => {
        if (!payload?.isTyping) {
          if (!(payload.userId in prev)) return prev;
          const next = { ...prev };
          delete next[payload.userId];
          return next;
        }
        return {
          ...prev,
          [payload.userId]: Date.now() + 4200,
        };
      });
    };

    const onPresence = (event: Event) => {
      let payload: PresenceEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as PresenceEventPayload;
      } catch {
        payload = null;
      }
      if (!payload) return;
      if (payload.conversationId !== activeIdRef.current) return;
      setPresenceByUserId((prev) => ({
        ...prev,
        [payload.userId]: {
          conversation_id: payload.conversationId,
          user_id: payload.userId,
          is_online: payload.isOnline,
          last_active_at: payload.lastActiveAt,
          last_typing_at: prev[payload.userId]?.last_typing_at || null,
          last_read_at: prev[payload.userId]?.last_read_at || null,
        },
      }));
    };

    const onMessageUpdate = (event: Event) => {
      let payload: MessageUpdateEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as MessageUpdateEventPayload;
      } catch {
        payload = null;
      }
      if (!payload?.message) return;
      const incoming = payload.message;

      if (payload.conversationId === activeIdRef.current) {
        setMessages((prev) => syncReplyPreviewReferences(mergeMessageIntoTimeline(prev, incoming), incoming));
        setMessageSearchResults((prev) =>
          syncReplyPreviewReferences(
            prev.map((message) => (message.id === incoming.id ? { ...message, ...incoming } : message)),
            incoming
          )
        );
        setPinnedMessages((prev) =>
          syncReplyPreviewReferences(
            prev.map((message) => (message.id === incoming.id ? { ...message, ...incoming } : message)),
            incoming
          )
        );
        setSavedMessages((prev) => syncSavedMessagesWithUpdate(prev, incoming));
        setReplyingToMessage((current) => (current?.id === incoming.id ? toReplyPreview(incoming) : current));
        const openThreadRootId = threadRootMessageIdRef.current;
        const openThreadMessageIds = threadMessageIdsRef.current;
        if (
          openThreadRootId &&
          (openThreadMessageIds.has(incoming.id) ||
            incoming.id === openThreadRootId ||
            (incoming.parent_message_id &&
              (incoming.parent_message_id === openThreadRootId ||
                openThreadMessageIds.has(incoming.parent_message_id))))
        ) {
          setThreadMessages((prev) =>
            syncReplyPreviewReferences(mergeMessageIntoTimeline(prev, incoming), incoming)
          );
        }
      }

      if (payload.kind !== "reaction") {
        setConversations((prev) =>
          sortConversations(
            prev.map((conversation) =>
              conversation.id === payload!.conversationId
                ? {
                    ...conversation,
                    last_message: summarizeMessage(incoming),
                    last_message_at: incoming.created_at,
                  }
                : conversation
            )
          )
        );
      }

      if (
        payload.userId !== session.user.id &&
        payload.conversationId === activeIdRef.current &&
        settings?.message_update_notifications !== false
      ) {
        if (payload.kind === "edited") {
          setNotice({ type: "info", message: "A message was edited." });
        } else if (payload.kind === "deleted") {
          setNotice({ type: "info", message: "A message was deleted." });
        }
      }
    };

    const onPin = (event: Event) => {
      let payload: PinEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as PinEventPayload;
      } catch {
        payload = null;
      }
      if (!payload?.message) return;
      const incoming = payload.message;

      if (payload.conversationId === activeIdRef.current) {
        setMessages((prev) => mergeMessageIntoTimeline(prev, incoming));
        setMessageSearchResults((prev) =>
          prev.map((message) => (message.id === incoming.id ? { ...message, ...incoming } : message))
        );
        setPinnedMessages((prev) => {
          if (payload?.pinned) {
            return sortPinnedMessages([incoming, ...prev.filter((message) => message.id !== incoming.id)]);
          }
            return prev.filter((message) => message.id !== incoming.id);
          });
        const openThreadRootId = threadRootMessageIdRef.current;
        const openThreadMessageIds = threadMessageIdsRef.current;
        if (openThreadRootId && openThreadMessageIds.has(incoming.id)) {
          setThreadMessages((prev) => mergeMessageIntoTimeline(prev, incoming));
        }
        void loadActivityEvents(payload.conversationId);
      }

      if (
        payload.userId !== session.user.id &&
        payload.conversationId === activeIdRef.current &&
        settings?.message_update_notifications !== false
      ) {
        setNotice({
          type: "info",
          message: payload.pinned ? "A message was pinned." : "A message was unpinned.",
        });
      }
    };

    const onArchive = (event: Event) => {
      let payload: ArchiveEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as ArchiveEventPayload;
      } catch {
        payload = null;
      }
      if (!payload) return;
      const archivePayload = payload;

      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation.id === archivePayload.conversationId
              ? {
                  ...conversation,
                  archived_at: archivePayload.archivedAt,
                  archived_by: archivePayload.archivedBy,
                }
              : conversation
          )
        )
      );

      if (archivePayload.conversationId === activeIdRef.current && archivePayload.archived) {
        setComposer("");
        setSelectedFiles([]);
        setVoiceDurationSeconds(null);
      }

      if (
        archivePayload.userId !== session.user.id &&
        archivePayload.conversationId === activeIdRef.current &&
        settings?.channel_event_notifications !== false
      ) {
        setNotice({
          type: "info",
          message: archivePayload.archived ? "Channel archived by owner." : "Channel unarchived by owner.",
        });
      }
      if (archivePayload.conversationId === activeIdRef.current) {
        void loadActivityEvents(archivePayload.conversationId);
      }
    };

    const onParticipant = (event: Event) => {
      let payload: ParticipantEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as ParticipantEventPayload;
      } catch {
        payload = null;
      }
      if (!payload) return;

      const participantPayload = payload;
      const activeConversationId = activeIdRef.current;
      if (participantPayload.conversationId === activeConversationId) {
        void loadConversationState(participantPayload.conversationId);
      }

      if (participantPayload.targetUserId === session.user.id) {
        if (participantPayload.action === "added") {
          setNotice({ type: "info", message: "You were added to a conversation." });
          void loadConversations();
        } else {
          if (participantPayload.conversationId === activeConversationId) {
            setActiveId(null);
            setMessages([]);
            setParticipants([]);
            setPresenceByUserId({});
            setTypingByUserId({});
          }
          setNotice({ type: "info", message: "You are no longer in that conversation." });
          void loadConversations();
        }
        return;
      }

      if (
        participantPayload.actorId !== session.user.id &&
        participantPayload.conversationId === activeConversationId &&
        settings?.channel_event_notifications !== false
      ) {
        setNotice({
          type: "info",
          message:
            participantPayload.action === "added"
              ? "A participant was added."
              : participantPayload.action === "removed"
              ? "A participant was removed."
              : "A participant left the conversation.",
        });
      }
    };

    const onConversation = (event: Event) => {
      let payload: ConversationUpdateEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as ConversationUpdateEventPayload;
      } catch {
        payload = null;
      }
      if (!payload?.conversation) return;

      const conversationPayload = payload.conversation;
      setConversations((prev) => {
        const index = prev.findIndex((conversation) => conversation.id === conversationPayload.id);
        if (index < 0) {
          void loadConversations();
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...next[index],
          name: conversationPayload.name,
          assignment_title: conversationPayload.assignment_title ?? null,
          assignment_description: conversationPayload.assignment_description ?? null,
          assignment_due_at: conversationPayload.assignment_due_at ?? null,
          assignment_template: conversationPayload.assignment_template ?? null,
          archived_at: conversationPayload.archived_at ?? null,
          archived_by: conversationPayload.archived_by ?? null,
        };
        return sortConversations(next);
      });

      if (
        payload.userId !== session.user.id &&
        payload.conversationId === activeIdRef.current &&
        settings?.channel_event_notifications !== false
      ) {
        setNotice({
          type: "info",
          message: "Channel assignment details were updated.",
        });
      }
    };

    const onAssignmentReminder = (event: Event) => {
      let payload: AssignmentReminderEventPayload | null = null;
      try {
        payload = JSON.parse((event as MessageEvent).data) as AssignmentReminderEventPayload;
      } catch {
        payload = null;
      }
      if (!payload) return;
      if (payload.userId !== session.user.id) return;
      const reminderPayload = payload;

      setConversations((prev) => {
        const index = prev.findIndex((conversation) => conversation.id === reminderPayload.conversationId);
        if (index < 0) {
          void loadConversations();
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...next[index],
          unread_count:
            reminderPayload.conversationId === activeIdRef.current
              ? Number(next[index].unread_count || 0)
              : Number(next[index].unread_count || 0) + 1,
        };
        return sortConversations(next);
      });

      setNotice({
        type: "info",
        message: getAssignmentReminderNotice(reminderPayload),
      });
      void loadAssignmentReminders();
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      if (messageStreamReconnectTimerRef.current != null) return;
      const attempt = messageStreamReconnectAttemptRef.current;
      const backoffMs = Math.min(
        SSE_RECONNECT_MAX_DELAY_MS,
        SSE_RECONNECT_BASE_DELAY_MS * Math.pow(2, Math.min(attempt, 6))
      );
      const jitterMs = Math.floor(Math.random() * 350);
      messageStreamReconnectTimerRef.current = window.setTimeout(() => {
        messageStreamReconnectTimerRef.current = null;
        if (cancelled || !session || !activeId) return;
        connectStream();
      }, backoffMs + jitterMs);
      messageStreamReconnectAttemptRef.current = Math.min(attempt + 1, 8);
    };

    const connectStream = () => {
      if (cancelled || messageStreamRef.current) return;
      const source = new EventSource(`${apiBase}/messages/stream`, { withCredentials: true });
      messageStreamRef.current = source;

      const onOpen = () => {
        messageStreamReconnectAttemptRef.current = 0;
        clearReconnectTimer();
      };

      const onError = () => {
        if (messageStreamRef.current !== source) return;
        closeActiveStream();
        scheduleReconnect();
      };

      const detachListeners = () => {
        source.removeEventListener("open", onOpen);
        source.removeEventListener("error", onError);
        source.removeEventListener("message", onMessage);
        source.removeEventListener("message_update", onMessageUpdate);
        source.removeEventListener("read", onRead);
        source.removeEventListener("typing", onTyping);
        source.removeEventListener("presence", onPresence);
        source.removeEventListener("pin", onPin);
        source.removeEventListener("archive", onArchive);
        source.removeEventListener("participant", onParticipant);
        source.removeEventListener("conversation", onConversation);
        source.removeEventListener("assignment_reminder", onAssignmentReminder);
      };

      messageStreamDetachRef.current = detachListeners;
      source.addEventListener("open", onOpen);
      source.addEventListener("error", onError);
      source.addEventListener("message", onMessage);
      source.addEventListener("message_update", onMessageUpdate);
      source.addEventListener("read", onRead);
      source.addEventListener("typing", onTyping);
      source.addEventListener("presence", onPresence);
      source.addEventListener("pin", onPin);
      source.addEventListener("archive", onArchive);
      source.addEventListener("participant", onParticipant);
      source.addEventListener("conversation", onConversation);
      source.addEventListener("assignment_reminder", onAssignmentReminder);
    };

    connectStream();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      messageStreamReconnectAttemptRef.current = 0;
      closeActiveStream();
    };
  }, [
    activeId,
    activeConversation?.name,
    apiBase,
    loadActivityEvents,
    loadConversationState,
    loadConversations,
    loadAssignmentReminders,
    loadMentions,
    mergeMessageIntoTimeline,
    isConversationMuted,
    session,
    settings?.mention_notifications,
    settings?.channel_event_notifications,
    settings?.message_update_notifications,
  ]);

  useEffect(() => {
    if (pendingScrollMessageId) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingScrollMessageId]);

  useEffect(() => {
    if (!pendingScrollMessageId) return;
    const timer = window.setTimeout(() => {
      const node = document.getElementById(`message-${pendingScrollMessageId}`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingScrollMessageId(null);
    }, 90);
    return () => window.clearTimeout(timer);
  }, [messages, pendingScrollMessageId]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const timer = window.setTimeout(() => setHighlightedMessageId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightedMessageId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const submitEnabled =
        Boolean(activeConversation) &&
        !settings?.blocked &&
        !channelArchived &&
        !viewerLocked &&
        !sending &&
        !isRecordingVoice &&
        Boolean(composer.trim() || selectedFiles.length);

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (submitEnabled) {
          event.preventDefault();
          composerFormRef.current?.requestSubmit();
        }
        return;
      }

      if (event.key === "/" && !inField) {
        event.preventDefault();
        composerInputRef.current?.focus();
        return;
      }

      if (event.key === "Escape") {
        let handled = false;
        if (editingMessageId) {
          setEditingMessageId(null);
          setEditingBody("");
          handled = true;
        } else if (forwardingMessageId) {
          setForwardingMessageId(null);
          setForwardTargetConversationId("");
          setForwardNote("");
          setForwardingMessage(false);
          handled = true;
        } else if (replyingToMessage) {
          setReplyingToMessage(null);
          handled = true;
        } else if (threadRootMessageId) {
          setThreadRootMessageId(null);
          setThreadMessages([]);
          setLoadingThread(false);
          handled = true;
        }
        if (handled) event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeConversation,
    channelArchived,
    composer,
    editingMessageId,
    forwardingMessageId,
    isRecordingVoice,
    replyingToMessage,
    selectedFiles.length,
    sending,
    settings?.blocked,
    threadRootMessageId,
    viewerLocked,
  ]);

  useEffect(() => {
    if (!session && !sessionLoading) {
      setConversations([]);
      setMessages([]);
      setActiveId(null);
      setParticipants([]);
      setPresenceByUserId({});
      setTypingByUserId({});
      setSettings(null);
      setDirectorySearch("");
      setDirectoryResults([]);
      setSearchingDirectory(false);
      setDirectoryResultsHasMore(false);
      setDirectoryResultsNextCursor(null);
      setFollowedSearch("");
      setFollowedResults([]);
      setFollowedResultsHasMore(false);
      setFollowedResultsNextCursor(null);
      setInteractedSearch("");
      setInteractedUsers([]);
      setInteractedUsersHasMore(false);
      setInteractedUsersNextCursor(null);
      setMentions([]);
      setMentionsUnreadOnly(true);
      setMentionsUnreadCount(0);
      setAssignmentReminders([]);
      setAssignmentRemindersUnreadOnly(true);
      setAssignmentRemindersUnreadCount(0);
      setWeeklySnapshot(null);
      setLoadingWeeklySnapshot(false);
      setModerationEvents([]);
      setLoadingModerationEvents(false);
      setModerationTypeFilter("all");
      setModerationSeverityFilter("all");
      setOpeningModerationEventId(null);
      setLoadingAssignmentReminders(false);
      setOpeningAssignmentReminderId(null);
      setMarkingAllAssignmentRemindersRead(false);
      setMessageSearchQuery("");
      setMessageSearchResults([]);
      setSearchingMessages(false);
      setSavedMessages([]);
      setLoadingSavedMessages(false);
      setSavingMessageId(null);
      setPinnedMessages([]);
      setThreadRootMessageId(null);
      setThreadMessages([]);
      setLoadingThread(false);
      setLoadingPins(false);
      setPinningMessageId(null);
      setEditingMessageId(null);
      setEditingBody("");
      setSavingEditMessageId(null);
      setDeletingMessageId(null);
      setReactingMessageKey(null);
      setForwardingMessageId(null);
      setForwardTargetConversationId("");
      setForwardNote("");
      setForwardingMessage(false);
      setSavingMuteWindow(false);
      setActivityEvents([]);
      setLoadingActivity(false);
      setTogglingArchive(false);
      setShowArchivedConversations(false);
      setConversationSearchQuery("");
      setConversationTypeFilter("all");
      setHighlightedMessageId(null);
      setUnreadBoundaryMessageId(null);
      setPendingScrollMessageId(null);
      setInvitingUserId(null);
      setInviteChannelRole("editor");
      setRemovingParticipantUserId(null);
      setLeavingConversation(false);
      setSavingMuteWindow(false);
      setSavingNotificationPrivacySetting(false);
      setComposer("");
      setReplyingToMessage(null);
      setIsDragActive(false);
      setSelectedFiles([]);
      setVoiceDurationSeconds(null);
      setIsRecordingVoice(false);
      setFailedSends([]);
      setRetryingFailedId(null);
      userSearchCacheRef.current.clear();
      stopTyping();
      clearRecorder();
    }
  }, [clearRecorder, session, sessionLoading, stopTyping]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      clearRecorder();
    };
  }, [clearRecorder]);

  const sendRead = useCallback(
    async (conversationId: string) => {
      if (!session) return;
      try {
        await fetch(`${apiBase}/messages/conversations/${conversationId}/read`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ readAt: new Date().toISOString() }),
        });
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation
          )
        );
        if (activeIdRef.current === conversationId) {
          setUnreadBoundaryMessageId(null);
        }
        void loadMentions();
      } catch {
        // best effort
      }
    },
    [apiBase, loadMentions, session]
  );

  const handleRoleWidgetAction = useCallback(
    (action: RoleWidgetAction) => {
      if (action === "create_group") {
        setShowCreate(true);
        setNewType("group");
        return;
      }
      if (action === "create_channel") {
        setShowCreate(true);
        setNewType("channel");
        return;
      }
      if (action === "focus_directory") {
        directorySearchInputRef.current?.focus();
        return;
      }
      if (action === "focus_followed") {
        followedSearchInputRef.current?.focus();
        return;
      }
      if (action === "open_mentions") {
        setMentionsUnreadOnly(true);
        mentionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        if (mentionsUnreadCount === 0) {
          setNotice({ type: "info", message: "No unread mentions right now." });
        }
        return;
      }
      if (action === "open_assignment_reminders") {
        setAssignmentRemindersUnreadOnly(true);
        assignmentRemindersPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        if (assignmentRemindersUnreadCount === 0) {
          setNotice({ type: "info", message: "No unread assignment reminders right now." });
        }
        return;
      }
      if (action === "open_moderation") {
        setShowModerationTools(true);
        window.setTimeout(() => {
          moderationPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 0);
        if (normalizedSessionRole === "admin") {
          void loadModerationEvents({
            limit: 10,
            severity: moderationSeverityFilter === "all" ? undefined : moderationSeverityFilter,
            type: moderationTypeFilter === "all" ? undefined : moderationTypeFilter,
          });
        }
        return;
      }

      if (!urgentChannelConversation) {
        setNotice({ type: "info", message: "No due soon or overdue channels found." });
        return;
      }
      setShowArchivedConversations(false);
      setConversationTypeFilter("channel");
      setConversationDueFilter("all");
      setActiveId(urgentChannelConversation.id);
      void sendRead(urgentChannelConversation.id);
    },
    [
      assignmentRemindersUnreadCount,
      loadModerationEvents,
      mentionsUnreadCount,
      moderationSeverityFilter,
      moderationTypeFilter,
      normalizedSessionRole,
      sendRead,
      urgentChannelConversation,
    ]
  );

  const openFirstUnreadConversation = useCallback(() => {
    if (!firstUnreadConversation) {
      setNotice({ type: "info", message: "No unread conversations." });
      return;
    }
    setActiveId(firstUnreadConversation.id);
    void sendRead(firstUnreadConversation.id);
  }, [firstUnreadConversation, sendRead]);

  const updateMentionNotifications = useCallback(
    async (enabled: boolean) => {
      if (!session || !activeConversation) return;
      setSavingMentionSetting(true);
      const previous = settings;
      setSettings((current) =>
        current
          ? {
              ...current,
              mention_notifications: enabled,
            }
          : current
      );
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/settings`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ mentionNotifications: enabled }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update mention preferences.");
        if (data?.settings) setSettings(normalizeConversationSettings(data.settings as ConversationSettings));
      } catch (error) {
        setSettings(previous);
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, "Unable to update mention preferences."),
        });
      } finally {
        setSavingMentionSetting(false);
      }
    },
    [activeConversation, apiBase, session, settings]
  );

  const updateNotificationPrivacySettings = useCallback(
    async (
      optimisticPatch: Partial<
        Pick<
          ConversationSettings,
          | "channel_event_notifications"
          | "message_update_notifications"
          | "share_presence"
          | "share_typing"
          | "share_read_receipts"
        >
      >,
      requestBody: Record<string, unknown>,
      successMessage: string,
      fallbackMessage: string
    ) => {
      if (!session || !activeConversation) return;
      setSavingNotificationPrivacySetting(true);
      const previous = settings;
      setSettings((current) =>
        current
          ? {
              ...current,
              ...optimisticPatch,
            }
          : current
      );
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/settings`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || fallbackMessage);
        if (data?.settings) setSettings(normalizeConversationSettings(data.settings as ConversationSettings));
        setNotice({ type: "success", message: successMessage });
      } catch (error) {
        setSettings(previous);
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, fallbackMessage),
        });
      } finally {
        setSavingNotificationPrivacySetting(false);
      }
    },
    [activeConversation, apiBase, session, settings]
  );

  const updateChannelEventNotifications = useCallback(
    async (enabled: boolean) =>
      updateNotificationPrivacySettings(
        { channel_event_notifications: enabled },
        { channelEventNotifications: enabled },
        enabled ? "Channel event alerts enabled." : "Channel event alerts muted.",
        "Unable to update channel event alerts."
      ),
    [updateNotificationPrivacySettings]
  );

  const updateMessageUpdateNotifications = useCallback(
    async (enabled: boolean) =>
      updateNotificationPrivacySettings(
        { message_update_notifications: enabled },
        { messageUpdateNotifications: enabled },
        enabled ? "Message update alerts enabled." : "Message update alerts muted.",
        "Unable to update message update alerts."
      ),
    [updateNotificationPrivacySettings]
  );

  const updateSharePresence = useCallback(
    async (enabled: boolean) =>
      updateNotificationPrivacySettings(
        { share_presence: enabled },
        { sharePresence: enabled },
        enabled ? "Presence sharing enabled." : "Presence sharing turned off.",
        "Unable to update presence sharing."
      ),
    [updateNotificationPrivacySettings]
  );

  const updateShareTyping = useCallback(
    async (enabled: boolean) =>
      updateNotificationPrivacySettings(
        { share_typing: enabled },
        { shareTyping: enabled },
        enabled ? "Typing sharing enabled." : "Typing sharing turned off.",
        "Unable to update typing sharing."
      ),
    [updateNotificationPrivacySettings]
  );

  const updateShareReadReceipts = useCallback(
    async (enabled: boolean) =>
      updateNotificationPrivacySettings(
        { share_read_receipts: enabled },
        { shareReadReceipts: enabled },
        enabled ? "Read receipts enabled." : "Read receipts turned off.",
        "Unable to update read receipts."
      ),
    [updateNotificationPrivacySettings]
  );

  const updateAssignmentReminderMode = useCallback(
    async (mode: ConversationSettings["assignment_reminder_mode"]) => {
      if (!session || !activeConversation || activeConversation.type !== "channel") return;
      setSavingAssignmentReminderSetting(true);
      const previous = settings;
      setSettings((current) =>
        current
          ? {
              ...current,
              assignment_reminder_mode: mode,
            }
          : current
      );
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/settings`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ assignmentReminderMode: mode }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update assignment reminder settings.");
        if (data?.settings) setSettings(normalizeConversationSettings(data.settings as ConversationSettings));
      } catch (error) {
        setSettings(previous);
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, "Unable to update assignment reminder settings."),
        });
      } finally {
        setSavingAssignmentReminderSetting(false);
      }
    },
    [activeConversation, apiBase, session, settings]
  );

  const updateAssignmentReminderSnooze = useCallback(
    async (snoozeMinutes: number) => {
      if (!session || !activeConversation || activeConversation.type !== "channel") return;
      setSavingAssignmentReminderSetting(true);
      const previous = settings;
      const optimisticSnoozedUntil =
        snoozeMinutes > 0 ? new Date(Date.now() + snoozeMinutes * 60 * 1000).toISOString() : null;
      setSettings((current) =>
        current
          ? {
              ...current,
              assignment_reminder_snoozed_until: optimisticSnoozedUntil,
            }
          : current
      );
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/settings`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ assignmentReminderSnoozeMinutes: snoozeMinutes }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update reminder snooze.");
        if (data?.settings) setSettings(normalizeConversationSettings(data.settings as ConversationSettings));
        setNotice({
          type: "success",
          message:
            snoozeMinutes > 0
              ? `Assignment reminders snoozed for ${Math.round(snoozeMinutes / 60)}h.`
              : "Assignment reminder snooze cleared.",
        });
      } catch (error) {
        setSettings(previous);
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, "Unable to update reminder snooze."),
        });
      } finally {
        setSavingAssignmentReminderSetting(false);
      }
    },
    [activeConversation, apiBase, session, settings]
  );

  const updateAssignmentOverdueRepeatHours = useCallback(
    async (hours: number) => {
      if (!session || !activeConversation || activeConversation.type !== "channel") return;
      setSavingAssignmentReminderSetting(true);
      const previous = settings;
      setSettings((current) =>
        current
          ? {
              ...current,
              assignment_overdue_repeat_hours: hours,
            }
          : current
      );
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/settings`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ assignmentOverdueRepeatHours: hours }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update overdue reminder cadence.");
        if (data?.settings) setSettings(normalizeConversationSettings(data.settings as ConversationSettings));
        setNotice({
          type: "success",
          message: `Overdue reminders now repeat every ${hours}h.`,
        });
      } catch (error) {
        setSettings(previous);
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, "Unable to update overdue reminder cadence."),
        });
      } finally {
        setSavingAssignmentReminderSetting(false);
      }
    },
    [activeConversation, apiBase, session, settings]
  );

  const updateMuteWindow = useCallback(
    async (muteMinutes: number) => {
      if (!session || !activeConversation) return;
      setSavingMuteWindow(true);
      const previous = settings;
      const optimisticMutedUntil =
        muteMinutes > 0 ? new Date(Date.now() + muteMinutes * 60 * 1000).toISOString() : null;
      setSettings((current) =>
        current
          ? {
              ...current,
              muted_until: optimisticMutedUntil,
            }
          : current
      );
      try {
        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/settings`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ muteMinutes }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update mute settings.");
        if (data?.settings) setSettings(normalizeConversationSettings(data.settings as ConversationSettings));
        setNotice({
          type: "success",
          message:
            muteMinutes > 0
              ? muteMinutes >= 480
                ? "Conversation muted for 8 hours."
                : "Conversation muted for 1 hour."
              : "Conversation unmuted.",
        });
      } catch (error) {
        setSettings(previous);
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update mute settings.") });
      } finally {
        setSavingMuteWindow(false);
      }
    },
    [activeConversation, apiBase, session, settings]
  );

  const reportDirectUser = useCallback(async () => {
    if (!session || !activeConversation || activeConversation.type !== "direct" || !directPeerParticipant) return;
    const rawReason = window.prompt("Report reason", "Abusive or unsafe behavior");
    const reason = rawReason?.trim() || "";
    if (!reason) return;

    setReportingUserId(directPeerParticipant.user_id);
    try {
      const response = await fetch(`${apiBase}/messages/users/${directPeerParticipant.user_id}/report`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          reason,
          conversationId: activeConversation.id,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to report user.");
      setNotice({ type: "success", message: "User report submitted for moderation review." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to report user.") });
    } finally {
      setReportingUserId(null);
    }
  }, [activeConversation, apiBase, directPeerParticipant, session]);

  const reportMessage = useCallback(
    async (messageId: string) => {
      if (!session || !activeConversation) return;
      const rawReason = window.prompt("Report reason", "Abusive or unsafe content");
      const reason = rawReason?.trim() || "";
      if (!reason) return;

      setReportingMessageId(messageId);
      try {
        const response = await fetch(`${apiBase}/messages/messages/${messageId}/report`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({ reason }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to report message.");
        setNotice({ type: "success", message: "Message reported for moderation review." });
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to report message.") });
      } finally {
        setReportingMessageId(null);
      }
    },
    [activeConversation, apiBase, session]
  );

  const updateParticipantRole = useCallback(
    async (participantUserId: string, role: "owner" | "editor" | "viewer") => {
      if (!session || !activeConversation) return;
      setUpdatingRoleUserId(participantUserId);
      try {
        const response = await fetch(
          `${apiBase}/messages/conversations/${activeConversation.id}/participants/${participantUserId}/role`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": session.csrfToken,
            },
            body: JSON.stringify({ role }),
          }
        );
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update participant role.");
        if (data?.participants) {
          setParticipants(data.participants as ConversationParticipant[]);
        } else {
          await loadConversationState(activeConversation.id);
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update participant role.") });
      } finally {
        setUpdatingRoleUserId(null);
      }
    },
    [activeConversation, apiBase, loadConversationState, session]
  );

  const inviteParticipant = useCallback(
    async (participantUserId: string) => {
      if (!session || !activeConversation) return;
      if (participantUserIds.has(participantUserId)) {
        setNotice({ type: "info", message: "User is already part of this conversation." });
        return;
      }

      setInvitingUserId(participantUserId);
      try {
        const payload: { userId: string; role?: "owner" | "editor" | "viewer" } = {
          userId: participantUserId,
        };
        if (activeConversation.type === "channel") {
          payload.role = currentParticipant?.role === "owner" ? inviteChannelRole : "editor";
        }

        const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/participants`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to add participant.");
        if (data?.participants) {
          setParticipants(data.participants as ConversationParticipant[]);
        }
        if (data?.added === false) {
          setNotice({ type: "info", message: "User is already part of this conversation." });
        } else {
          setNotice({
            type: "success",
            message:
              activeConversation.type === "channel"
                ? "Participant invited to channel."
                : "Participant added to conversation.",
          });
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to add participant.") });
      } finally {
        setInvitingUserId(null);
      }
    },
    [
      activeConversation,
      apiBase,
      currentParticipant?.role,
      inviteChannelRole,
      participantUserIds,
      session,
    ]
  );

  const removeParticipantFromConversation = useCallback(
    async (participantUserId: string) => {
      if (!session || !activeConversation) return;
      setRemovingParticipantUserId(participantUserId);
      try {
        const response = await fetch(
          `${apiBase}/messages/conversations/${activeConversation.id}/participants/${participantUserId}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: {
              "x-csrf-token": session.csrfToken,
            },
          }
        );
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to remove participant.");

        if (data?.participants) {
          setParticipants(data.participants as ConversationParticipant[]);
        } else {
          await loadConversationState(activeConversation.id);
        }

        if (participantUserId === session.user.id) {
          setActiveId(null);
          setMessages([]);
          setParticipants([]);
          setPresenceByUserId({});
          setTypingByUserId({});
          setNotice({ type: "success", message: "You left this conversation." });
          await loadConversations();
        } else {
          setNotice({ type: "success", message: "Participant removed." });
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to remove participant.") });
      } finally {
        setRemovingParticipantUserId(null);
      }
    },
    [activeConversation, apiBase, loadConversationState, loadConversations, session]
  );

  const leaveConversationByAction = useCallback(async () => {
    if (!session || !activeConversation) return;
    setLeavingConversation(true);
    try {
      const response = await fetch(`${apiBase}/messages/conversations/${activeConversation.id}/leave`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to leave conversation.");

      setActiveId(null);
      setMessages([]);
      setParticipants([]);
      setPresenceByUserId({});
      setTypingByUserId({});
      setNotice({ type: "success", message: "You left this conversation." });
      await loadConversations();
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to leave conversation.") });
    } finally {
      setLeavingConversation(false);
    }
  }, [activeConversation, apiBase, loadConversations, session]);

  const renderMessageText = useCallback((body: string) => {
    const parts = body.split(mentionTokenPattern);
    return parts.map((part, index) =>
      /^@[a-zA-Z0-9._-]{2,24}$/.test(part) ? (
        <span key={`${part}-${index}`} className={styles.mentionToken}>
          {part}
        </span>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      )
    );
  }, []);

  const copyMessageLink = useCallback(
    async (messageId: string) => {
      if (!activeConversation) return;
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("conversationId", activeConversation.id);
        url.searchParams.set("messageId", messageId);
        await navigator.clipboard.writeText(url.toString());
        setNotice({ type: "success", message: "Message link copied." });
      } catch {
        setNotice({ type: "error", message: "Unable to copy message link." });
      }
    },
    [activeConversation]
  );

  const exportActiveConversation = useCallback(() => {
    if (!activeConversation) return;
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        conversation: activeConversation,
        messages,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `conversation-${activeConversation.id}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice({ type: "success", message: "Conversation exported." });
    } catch {
      setNotice({ type: "error", message: "Unable to export conversation." });
    }
  }, [activeConversation, messages]);

  const sendTextMessage = useCallback(
    async (conversationId: string, body: string, replyToMessageId?: string | null) => {
      if (!session) throw new Error("Sign in to send messages.");
      const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ body, replyToMessageId: replyToMessageId || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to send message.");
      if (data?.warning) setNotice({ type: "info", message: String(data.warning) });
      return data?.message as Message | undefined;
    },
    [apiBase, session]
  );

  const sendAttachmentMessage = useCallback(
    async (
      conversationId: string,
      body: string,
      files: File[],
      durationSeconds: number | null,
      replyToMessageId?: string | null
    ) => {
      if (!session) throw new Error("Sign in to send attachments.");
      const formData = new FormData();
      if (body.trim()) formData.append("body", body.trim());
      if (durationSeconds && durationSeconds > 0) formData.append("durationSeconds", String(durationSeconds));
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      for (const file of files) formData.append("files", file, file.name);

      const response = await fetch(`${apiBase}/messages/conversations/${conversationId}/messages/attachments`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-csrf-token": session.csrfToken,
        },
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to send attachment message.");
      if (data?.warning) setNotice({ type: "info", message: String(data.warning) });
      return data?.message as Message | undefined;
    },
    [apiBase, session]
  );

  const enqueueFailedSend = useCallback(
    (item: Omit<FailedSendItem, "id" | "attempts" | "createdAt">) => {
      setFailedSends((prev) => [
        {
          ...item,
          id: toTempId(),
          attempts: 1,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    []
  );

  const retryFailedSend = useCallback(
    async (item: FailedSendItem) => {
      if (!session) return;
      setRetryingFailedId(item.id);
      try {
        if (item.files.length > 0) {
          const sentMessage = await sendAttachmentMessage(
            item.conversationId,
            item.body,
            item.files,
            item.durationSeconds,
            item.replyToMessageId ?? null
          );
          if (sentMessage) {
            const normalized: Message = {
              ...sentMessage,
              parent_message_id: sentMessage.parent_message_id ?? item.replyToMessageId ?? null,
              reply_to: sentMessage.reply_to ?? item.replyTo ?? null,
              delivery_status: sentMessage.delivery_status || "sent",
            };
            setMessages((prev) => mergeMessageIntoTimeline(prev, normalized));
            const preview = summarizeMessage(normalized);
            setConversations((prev) =>
              sortConversations(
                prev.map((conversation) =>
                  conversation.id === item.conversationId
                    ? {
                        ...conversation,
                        last_message: preview,
                        last_message_at: normalized.created_at,
                        unread_count: 0,
                    }
                    : conversation
                )
              )
            );
            void loadAttachmentQuota(item.conversationId);
          }
        } else {
          const sentMessage = await sendTextMessage(
            item.conversationId,
            item.body,
            item.replyToMessageId ?? null
          );
          if (sentMessage) {
            const normalized: Message = {
              ...sentMessage,
              parent_message_id: sentMessage.parent_message_id ?? item.replyToMessageId ?? null,
              reply_to: sentMessage.reply_to ?? item.replyTo ?? null,
              delivery_status: sentMessage.delivery_status || "sent",
            };
            setMessages((prev) => {
              if (!item.optimisticMessageId) return mergeMessageIntoTimeline(prev, normalized);
              const optimisticIndex = prev.findIndex((message) => message.id === item.optimisticMessageId);
              if (optimisticIndex === -1) return mergeMessageIntoTimeline(prev, normalized);
              return prev.map((message) => (message.id === item.optimisticMessageId ? normalized : message));
            });
            setConversations((prev) =>
              sortConversations(
                prev.map((conversation) =>
                  conversation.id === item.conversationId
                    ? {
                        ...conversation,
                        last_message: item.body,
                        last_message_at: sentMessage.created_at,
                        unread_count: 0,
                      }
                    : conversation
                )
              )
            );
          }
        }
        setFailedSends((prev) => prev.filter((queued) => queued.id !== item.id));
      } catch (error) {
        const message = getApiErrorMessage(error, "Retry failed.");
        setFailedSends((prev) =>
          prev.map((queued) =>
            queued.id === item.id
              ? {
                  ...queued,
                  attempts: queued.attempts + 1,
                  lastError: message,
                }
              : queued
          )
        );
        setNotice({ type: "error", message });
      } finally {
        setRetryingFailedId(null);
      }
    },
    [loadAttachmentQuota, mergeMessageIntoTimeline, sendAttachmentMessage, sendTextMessage, session]
  );

  const retryAllFailedSends = useCallback(async () => {
    const queueSnapshot = [...failedSends];
    for (const item of queueSnapshot) {
      await retryFailedSend(item);
    }
  }, [failedSends, retryFailedSend]);

  const toggleSaved = useCallback(
    async (message: Message) => {
      if (!session || message.id.startsWith("temp-")) return;
      setSavingMessageId(message.id);
      try {
        const response = await fetch(`${apiBase}/messages/messages/${message.id}/saved`, {
          method: "POST",
          credentials: "include",
          headers: {
            "x-csrf-token": session.csrfToken,
          },
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to update saved message.");

        const saved = Boolean(data?.saved);
        const savedAt = typeof data?.savedAt === "string" ? data.savedAt : new Date().toISOString();
        const payloadMessage = (data?.message as Message | undefined) || message;
        if (saved) {
          const conversationName =
            conversations.find((conversation) => conversation.id === payloadMessage.conversation_id)?.name ||
            activeConversation?.name ||
            "Conversation";
          const entry: SavedMessage = {
            ...payloadMessage,
            saved_at: savedAt,
            conversation_name: conversationName,
          };
          setSavedMessages((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 200));
          setNotice({ type: "success", message: "Message saved." });
        } else {
          setSavedMessages((prev) => prev.filter((item) => item.id !== message.id));
          setNotice({ type: "info", message: "Message removed from saved." });
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update saved message.") });
      } finally {
        setSavingMessageId(null);
      }
    },
    [activeConversation?.name, apiBase, conversations, session]
  );

  const openSavedMessage = useCallback(
    async (saved: SavedMessage) => {
      if (!session) return;
      if (activeId === saved.conversation_id) {
        await jumpToMessage(saved);
        return;
      }
      await loadConversations();
      pendingAnchorMessageRef.current = {
        conversationId: saved.conversation_id,
        messageId: saved.id,
      };
      setActiveId(saved.conversation_id);
      await sendRead(saved.conversation_id);
    },
    [activeId, jumpToMessage, loadConversations, sendRead, session]
  );

  const startForwardMessage = useCallback(
    (message: Message) => {
      const preferredTarget =
        conversations.find((conversation) => conversation.id !== message.conversation_id)?.id || message.conversation_id;
      setForwardingMessageId(message.id);
      setForwardTargetConversationId(preferredTarget);
      setForwardNote("");
    },
    [conversations]
  );

  const submitForwardMessage = useCallback(async () => {
    if (!session || !forwardingMessageId || !forwardTargetConversationId) return;
    setForwardingMessage(true);
    try {
      const response = await fetch(`${apiBase}/messages/messages/${forwardingMessageId}/forward`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          targetConversationId: forwardTargetConversationId,
          note: forwardNote.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to forward message.");
      if (data?.warning) setNotice({ type: "info", message: String(data.warning) });

      const forwarded = data?.message as Message | undefined;
      if (forwarded && activeConversation?.id === forwardTargetConversationId) {
        setMessages((prev) => mergeMessageIntoTimeline(prev, forwarded));
      }

      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation.id === forwardTargetConversationId
              ? {
                  ...conversation,
                  last_message: forwarded ? summarizeMessage(forwarded) : "Forwarded message",
                  last_message_at: forwarded?.created_at || new Date().toISOString(),
                }
              : conversation
          )
        )
      );

      await loadConversations();
      setNotice({ type: "success", message: "Message forwarded." });
      setForwardingMessageId(null);
      setForwardTargetConversationId("");
      setForwardNote("");
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to forward message.") });
    } finally {
      setForwardingMessage(false);
    }
  }, [
    activeConversation?.id,
    apiBase,
    forwardNote,
    forwardingMessageId,
    forwardTargetConversationId,
    loadConversations,
    mergeMessageIntoTimeline,
    session,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      if (failedSends.length > 0) {
        void retryAllFailedSends();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [failedSends.length, retryAllFailedSends]);

  const openDirectConversation = useCallback(
    async (userId: string) => {
      if (!session) return;
      setOpeningDirectUserId(userId);
      try {
        const response = await fetch(`${apiBase}/messages/conversations/direct/${userId}`, {
          method: "POST",
          credentials: "include",
          headers: {
            "x-csrf-token": session.csrfToken,
          },
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to open direct conversation.");

        await loadConversations();
        await loadInteractedUsers({ force: true, query: interactedSearch });
        if (data?.conversation?.id) {
          setActiveId(data.conversation.id);
          await sendRead(data.conversation.id);
        }
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to open direct conversation.") });
      } finally {
        setOpeningDirectUserId(null);
      }
    },
    [apiBase, interactedSearch, loadConversations, loadInteractedUsers, sendRead, session]
  );

  const openMentionConversation = useCallback(
    async (mention: MentionNotification) => {
      if (!session) return;
      setOpeningMentionMessageId(mention.message_id);
      try {
        await loadConversations();
        pendingAnchorMessageRef.current = {
          conversationId: mention.conversation_id,
          messageId: mention.message_id,
        };
        setActiveId(mention.conversation_id);
        await sendRead(mention.conversation_id);
        await loadMentions();
      } finally {
        setOpeningMentionMessageId(null);
      }
    },
    [loadConversations, loadMentions, sendRead, session]
  );

  const markAssignmentReminderRead = useCallback(
    async (reminderId: string) => {
      if (!session) return;
      try {
        await fetch(`${apiBase}/messages/assignment-reminders/${reminderId}/read`, {
          method: "POST",
          credentials: "include",
          headers: {
            "x-csrf-token": session.csrfToken,
          },
        });
      } catch {
        // best effort
      }
    },
    [apiBase, session]
  );

  const markAllAssignmentRemindersRead = useCallback(async () => {
    if (!session) return;
    setMarkingAllAssignmentRemindersRead(true);
    try {
      const response = await fetch(`${apiBase}/messages/assignment-reminders/read-all`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-csrf-token": session.csrfToken,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to mark assignment reminders as read.");
      await loadAssignmentReminders();
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to mark assignment reminders as read."),
      });
    } finally {
      setMarkingAllAssignmentRemindersRead(false);
    }
  }, [apiBase, loadAssignmentReminders, session]);

  const openAssignmentReminderConversation = useCallback(
    async (reminder: AssignmentReminderNotification) => {
      if (!session) return;
      setOpeningAssignmentReminderId(reminder.id);
      try {
        await markAssignmentReminderRead(reminder.id);
        await loadConversations();
        setActiveId(reminder.conversation_id);
        await sendRead(reminder.conversation_id);
        await loadAssignmentReminders();
      } finally {
        setOpeningAssignmentReminderId(null);
      }
    },
    [loadAssignmentReminders, loadConversations, markAssignmentReminderRead, sendRead, session]
  );

  const openModerationEventTarget = useCallback(
    async (event: ModerationEvent) => {
      if (!session) return;
      const target = getModerationEventTarget({
        metadata: event.metadata,
        sessionId: event.session_id,
      });
      if (target.conversationId) {
        setOpeningModerationEventId(event.id);
        try {
          await loadConversations();
          if (target.messageId) {
            pendingAnchorMessageRef.current = {
              conversationId: target.conversationId,
              messageId: target.messageId,
            };
          }
          setActiveId(target.conversationId);
          await sendRead(target.conversationId);
        } catch (error) {
          setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to open moderation context.") });
        } finally {
          setOpeningModerationEventId(null);
        }
        return;
      }
      if (target.sessionId) {
        window.location.href = `/tutors/sessions?sessionId=${encodeURIComponent(target.sessionId)}`;
        return;
      }
      setNotice({ type: "info", message: "No linked conversation or session for this moderation event." });
    },
    [loadConversations, sendRead, session]
  );

  const handleCreateConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowCreateError(null);
    if (!session) {
      setShowCreateError("Sign in to create a conversation.");
      return;
    }
    if (!newName.trim()) {
      setShowCreateError("Conversation name is required.");
      return;
    }
    if (newType === "channel" && !assignmentTitle.trim()) {
      setShowCreateError("Assignment title is required for channels.");
      return;
    }

    const rawParticipantIds = newParticipants
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const participantIds = Array.from(
      new Set(rawParticipantIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))
    );
    if (rawParticipantIds.length > 0 && participantIds.length !== rawParticipantIds.length) {
      setShowCreateError("Participant IDs must be valid UUID values.");
      return;
    }

    const selectedTemplate = newType === "channel" ? CHANNEL_TEMPLATE_PRESETS[assignmentTemplateId] : undefined;
    const assignmentDueAtIso =
      newType === "channel" && assignmentDueAt ? new Date(assignmentDueAt).toISOString() : undefined;
    const assignmentTemplate =
      newType === "channel" ? buildChannelAssignmentTemplate(assignmentTemplateId, { dueAtIso: assignmentDueAtIso }) : undefined;

    try {
      const response = await fetch(`${apiBase}/messages/conversations`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          participantIds: participantIds.length ? participantIds : undefined,
          assignmentTitle: newType === "channel" ? assignmentTitle.trim() : undefined,
          assignmentDescription:
            newType === "channel"
              ? assignmentDescription.trim() || selectedTemplate?.description || undefined
              : undefined,
          assignmentDueAt: assignmentDueAtIso,
          assignmentTemplate,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to create conversation.");

      setShowCreate(false);
      setNewName("");
      setNewParticipants("");
      setAssignmentTitle("");
      setAssignmentDescription("");
      setAssignmentDueAt("");
      setAssignmentTemplateId("none");
      setNewType("group");
      setNotice({
        type: "success",
        message: newType === "channel" ? "Assignment channel created." : "Conversation created.",
      });
      await loadConversations();
      if (data?.conversation?.id) {
        setActiveId(data.conversation.id);
      }
    } catch (error) {
      setShowCreateError(getApiErrorMessage(error, "Unable to create conversation."));
    }
  };

  const appendPendingFiles = useCallback(
    (incomingFiles: File[]) => {
      if (!incomingFiles.length) return;
      const warnings: string[] = [];
      setSelectedFiles((prev) => {
        const next = [...prev];
        const seen = new Set(next.map(toAttachmentSignature));
        let stagedBytes = next.reduce((sum, file) => sum + Number(file.size || 0), 0);
        for (const file of incomingFiles) {
          if (next.length >= MAX_FILES_PER_MESSAGE) {
            warnings.push(`Max ${MAX_FILES_PER_MESSAGE} attachments reached.`);
            break;
          }
          if (!isAllowedAttachmentFile(file)) {
            warnings.push(`Skipped ${file.name}: unsupported type.`);
            continue;
          }
          if (Number(file.size || 0) > MAX_CLIENT_ATTACHMENT_BYTES) {
            warnings.push(`Skipped ${file.name}: exceeds ${formatBytes(MAX_CLIENT_ATTACHMENT_BYTES)}.`);
            continue;
          }
          const signature = toAttachmentSignature(file);
          if (seen.has(signature)) {
            warnings.push(`Skipped ${file.name}: duplicate file.`);
            continue;
          }
          if (attachmentQuota) {
            const projected = stagedBytes + Number(file.size || 0);
            if (projected > Number(attachmentQuota.remainingBytes || 0)) {
              warnings.push(`Skipped ${file.name}: quota exceeded.`);
              continue;
            }
          }
          next.push(file);
          seen.add(signature);
          stagedBytes += Number(file.size || 0);
        }
        return next;
      });
      if (warnings.length > 0) {
        setNotice({
          type: "info",
          message: warnings.slice(0, 2).join(" ") + (warnings.length > 2 ? ` (+${warnings.length - 2} more)` : ""),
        });
      }
    },
    [attachmentQuota]
  );

  useEffect(() => {
    const disabled =
      !activeConversation ||
      Boolean(settings?.blocked) ||
      channelArchived ||
      viewerLocked ||
      sending ||
      isRecordingVoice ||
      attachmentQuotaExhausted;
    if (!activeConversation || disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      if (targetTag === "textarea") return;
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const files = Array.from(clipboard.files || []);
      if (!files.length) return;
      event.preventDefault();
      appendPendingFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [
    activeConversation,
    appendPendingFiles,
    channelArchived,
    isRecordingVoice,
    sending,
    settings?.blocked,
    attachmentQuotaExhausted,
    viewerLocked,
  ]);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    appendPendingFiles(files);
    event.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_file, idx) => idx !== index));
  };

  const clearPendingFiles = useCallback(() => {
    setSelectedFiles([]);
    setVoiceDurationSeconds(null);
  }, []);

  const toggleVoiceRecording = useCallback(async () => {
    if (!activeConversation || settings?.blocked || channelArchived || viewerLocked) return;
    if (selectedFiles.length >= MAX_FILES_PER_MESSAGE && !isRecordingVoice) {
      setNotice({
        type: "info",
        message: `Remove a file before recording (max ${MAX_FILES_PER_MESSAGE} attachments).`,
      });
      return;
    }
    if (attachmentQuota && Number(attachmentQuota.remainingBytes || 0) <= 0) {
      setNotice({
        type: "error",
        message: "Attachment quota reached. Increase quota or remove old files before adding voice notes.",
      });
      return;
    }

    if (isRecordingVoice) {
      recorderRef.current?.stop();
      return;
    }

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setNotice({ type: "error", message: "Voice notes are not supported in this browser." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorderStreamRef.current = stream;
      recorderChunksRef.current = [];
      recorderStartRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(recorderChunksRef.current, { type: mimeType });
        const duration = recorderStartRef.current
          ? Math.max(1, Math.round((Date.now() - recorderStartRef.current) / 1000))
          : null;
        if (blob.size > 0) {
          const ext = mimeType.includes("ogg") ? ".ogg" : mimeType.includes("mp4") ? ".m4a" : ".webm";
          const voiceFile = new File([blob], `voice-note-${Date.now()}${ext}`, { type: mimeType });
          setSelectedFiles((prev) => {
            if (prev.length >= MAX_FILES_PER_MESSAGE) return prev;
            return [...prev, voiceFile];
          });
          setVoiceDurationSeconds(duration);
        }
        setIsRecordingVoice(false);
        clearRecorder();
      };

      recorder.start();
      setIsRecordingVoice(true);
      setNotice({ type: "info", message: "Recording started. Click Stop voice to attach it." });
    } catch {
      setIsRecordingVoice(false);
      clearRecorder();
      setNotice({ type: "error", message: "Unable to access microphone." });
    }
  }, [
    activeConversation,
    attachmentQuota,
    channelArchived,
    clearRecorder,
    isRecordingVoice,
    selectedFiles.length,
    settings?.blocked,
    viewerLocked,
  ]);

  const composerDropDisabled =
    !activeConversation ||
    !!settings?.blocked ||
    channelArchived ||
    viewerLocked ||
    sending ||
    isRecordingVoice ||
    attachmentQuotaExhausted;

  const handleComposerDragOver = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (composerDropDisabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDragActive) setIsDragActive(true);
    },
    [composerDropDisabled, isDragActive]
  );

  const handleComposerDragLeave = useCallback((event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleComposerDrop = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      if (composerDropDisabled) return;
      const dropped = Array.from(event.dataTransfer.files || []);
      if (!dropped.length) return;
      appendPendingFiles(dropped);
    },
    [appendPendingFiles, composerDropDisabled]
  );

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !activeConversation || settings?.blocked || channelArchived || isRecordingVoice || viewerLocked)
      return;
    const body = composer.trim();
    if (!body && selectedFiles.length === 0) return;
    if (selectedFiles.length > MAX_FILES_PER_MESSAGE) {
      setNotice({ type: "error", message: `Maximum ${MAX_FILES_PER_MESSAGE} attachments per message.` });
      return;
    }
    if (selectedFiles.length > 0 && attachmentQuota) {
      const pendingBytes = selectedFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
      if (pendingBytes > Number(attachmentQuota.remainingBytes || 0)) {
        setNotice({
          type: "error",
          message: `Attachment quota exceeded. Remaining ${formatBytes(Number(attachmentQuota.remainingBytes || 0))}.`,
        });
        return;
      }
    }
    const replyTo = replyingToMessage;
    const replyToMessageId = replyTo?.id ?? null;
    stopTyping(activeConversation.id);

    setSending(true);
    setReplyingToMessage(null);
    let optimisticMessageId: string | null = null;
    let queuedBody = body;
    let queuedFiles: File[] = [];
    let queuedDuration: number | null = null;
    let queuedReplyToMessageId: string | null = replyToMessageId;
    let queuedReplyTo: MessageReplyPreview | null = replyTo;
    try {
      if (selectedFiles.length > 0) {
        const files = [...selectedFiles];
        const duration = voiceDurationSeconds;
        queuedFiles = files;
        queuedDuration = duration;
        setComposer("");
        if (draftStorageKey) {
          try {
            window.localStorage.removeItem(draftStorageKey);
          } catch {
            // ignore localStorage errors
          }
        }
        setSelectedFiles([]);
        setVoiceDurationSeconds(null);

        const sentMessage = await sendAttachmentMessage(
          activeConversation.id,
          body,
          files,
          duration,
          replyToMessageId
        );
        if (sentMessage) {
          const normalizedMessage: Message = {
            ...sentMessage,
            parent_message_id: sentMessage.parent_message_id ?? replyToMessageId,
            reply_to: sentMessage.reply_to ?? replyTo ?? null,
            delivery_status: sentMessage.delivery_status || "sent",
          };
          const preview = summarizeMessage(sentMessage);
          setMessages((prev) => [...prev, normalizedMessage]);
          setConversations((prev) =>
            sortConversations(
              prev.map((conversation) =>
                conversation.id === activeConversation.id
                  ? {
                      ...conversation,
                      last_message: preview,
                      last_message_at: sentMessage.created_at,
                      unread_count: 0,
                    }
                  : conversation
              )
            )
          );
          void loadAttachmentQuota(activeConversation.id);
        }
      } else {
        const tempId = toTempId();
        optimisticMessageId = tempId;
        const optimistic: Message = {
          id: tempId,
          conversation_id: activeConversation.id,
          sender_id: session.user.id,
          body,
          created_at: new Date().toISOString(),
          sender_name: "You",
          parent_message_id: replyToMessageId,
          reply_to: replyTo ?? null,
          attachments: [],
          status: "sending",
        };
        setComposer("");
        if (draftStorageKey) {
          try {
            window.localStorage.removeItem(draftStorageKey);
          } catch {
            // ignore localStorage errors
          }
        }
        setMessages((prev) => [...prev, optimistic]);

        const sentMessage = await sendTextMessage(activeConversation.id, body, replyToMessageId);
        if (sentMessage) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === tempId
                ? {
                    ...sentMessage,
                    parent_message_id: sentMessage.parent_message_id ?? replyToMessageId,
                    reply_to: sentMessage.reply_to ?? replyTo ?? null,
                    delivery_status: sentMessage.delivery_status || "sent",
                  }
                : message
            )
          );
          setConversations((prev) =>
            sortConversations(
              prev.map((conversation) =>
                conversation.id === activeConversation.id
                  ? {
                      ...conversation,
                      last_message: body,
                      last_message_at: sentMessage.created_at,
                      unread_count: 0,
                    }
                  : conversation
              )
            )
          );
        }
      }
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, "Unable to send message.");
      if (optimisticMessageId) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === optimisticMessageId ? { ...message, status: "failed" } : message
          )
        );
      }
      enqueueFailedSend({
        conversationId: activeConversation.id,
        conversationName: activeConversation.name,
        body: queuedBody,
        files: queuedFiles,
        durationSeconds: queuedDuration,
        replyToMessageId: queuedReplyToMessageId,
        replyTo: queuedReplyTo,
        lastError: errorMessage,
        optimisticMessageId: optimisticMessageId ?? undefined,
      });
      setNotice({ type: "error", message: `${errorMessage} Added to retry queue.` });
    } finally {
      setSending(false);
    }
  };

  const canSend =
    Boolean(activeConversation) &&
    !settings?.blocked &&
    !channelArchived &&
    !viewerLocked &&
    !sending &&
    !isRecordingVoice &&
    Boolean(composer.trim() || selectedFiles.length);

  return (
    <div className={styles.frameDock}>
      <div className={`glass card card-with-back ${styles.frame}`}>
        <div className={styles.frameHeader}>
        <h1 className="title">Messaging Hub</h1>
        <p className="subtitle">
          Search followed users, reconnect with recent collaborators, and share files, media, voice notes, and
          assignment channels.
        </p>

        {notice ? (
          <div
            className={`${styles.notice} ${
              notice.type === "success"
                ? styles.noticeSuccess
                : notice.type === "error"
                ? styles.noticeError
                : styles.noticeInfo
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        {!session && !sessionLoading ? (
          <div className={`${styles.notice} ${styles.noticeInfo}`}>Sign in to use messaging features.</div>
        ) : null}
        </div>

        <div className={styles.frameBody}>
          <div className={styles.layout}>
            <ConversationListPanel>
              <aside className={styles.sidebar}>
          <button className="button" type="button" onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? "Close" : "New conversation or channel"}
          </button>

          {showCreate ? (
            <form className={styles.createForm} onSubmit={handleCreateConversation}>
              <label className={styles.field}>
                Type
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value as "group" | "channel")}
                >
                  <option value="group">Group conversation</option>
                  <option value="channel">Assignment channel</option>
                </select>
              </label>
              <label className={styles.field}>
                Name
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder={newType === "channel" ? "Group assignment room name" : "Conversation name"}
                />
              </label>
              {newType === "channel" ? (
                <>
                  <label className={styles.field}>
                    Template
                    <select
                      value={assignmentTemplateId}
                      onChange={(event) => setAssignmentTemplateId(event.target.value)}
                    >
                      <option value="none">No template</option>
                      {Object.entries(CHANNEL_TEMPLATE_PRESETS).map(([id, preset]) => (
                        <option key={id} value={id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedTemplatePreset ? (
                    <div className={styles.templatePreview}>
                      <strong>{selectedTemplatePreset.label}</strong>
                      <p>{selectedTemplatePreset.description}</p>
                      <ul>
                        {selectedTemplatePreset.checklist.slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <label className={styles.field}>
                    Assignment title
                    <input
                      value={assignmentTitle}
                      onChange={(event) => setAssignmentTitle(event.target.value)}
                      placeholder="e.g. Solar system presentation"
                    />
                  </label>
                  <label className={styles.field}>
                    Assignment description
                    <textarea
                      value={assignmentDescription}
                      onChange={(event) => setAssignmentDescription(event.target.value)}
                      rows={3}
                      placeholder="Define goals and deliverables for the channel"
                    />
                  </label>
                  <label className={styles.field}>
                    Due date (optional)
                    <input
                      type="datetime-local"
                      value={assignmentDueAt}
                      onChange={(event) => setAssignmentDueAt(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <label className={styles.field}>
                Participant IDs (optional)
                <input
                  value={newParticipants}
                  onChange={(event) => setNewParticipants(event.target.value)}
                  placeholder="uuid, uuid, uuid"
                />
              </label>
              {showCreateError ? <p className={styles.status}>{showCreateError}</p> : null}
              <button className="button" type="submit">
                {newType === "channel" ? "Create channel" : "Create conversation"}
              </button>
            </form>
          ) : null}

          {session ? (
            <div className={styles.discoveryBlock}>
              <div className={styles.discoveryHeader}>
                <h3>Role Quick Actions</h3>
                <span className={styles.tag}>{sessionRoleLabel}</span>
              </div>
              <div className={styles.userList}>
                {roleQuickWidgets.map((widget) => (
                  <div key={widget.id} className={styles.userRowCard}>
                    <div>
                      <strong>{widget.title}</strong>
                      <p>{widget.description}</p>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="button"
                        type="button"
                        disabled={widget.enabled === false}
                        onClick={() => {
                          handleRoleWidgetAction(widget.action);
                        }}
                      >
                        {widget.actionLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {session ? (
            <div className={styles.discoveryBlock}>
              <div className={styles.discoveryHeader}>
                <h3>Weekly Snapshot</h3>
                <span className={styles.tag}>{weeklySnapshot?.windowDays ?? 7}d</span>
              </div>
              {loadingWeeklySnapshot ? <p className={styles.status}>Loading weekly snapshot...</p> : null}
              {weeklySnapshot ? (
                <>
                  <div className={styles.snapshotGrid}>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.sentMessages}</strong>
                      <p>Sent</p>
                    </article>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.receivedMessages}</strong>
                      <p>Received</p>
                    </article>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.activeConversations}</strong>
                      <p>Active chats</p>
                    </article>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.collaboratorCount}</strong>
                      <p>Collaborators</p>
                    </article>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.dueSoonChannels}</strong>
                      <p>Due soon</p>
                    </article>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.overdueChannels}</strong>
                      <p>Overdue</p>
                    </article>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.unreadMentions}</strong>
                      <p>Unread mentions</p>
                    </article>
                    <article className={styles.snapshotCard}>
                      <strong>{weeklySnapshot.unreadConversations}</strong>
                      <p>Unread chats</p>
                    </article>
                  </div>
                  {snapshotRoleHint ? <p className={styles.status}>{snapshotRoleHint}</p> : null}
                </>
              ) : !loadingWeeklySnapshot ? (
                <p className={styles.status}>No weekly snapshot available yet.</p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.discoveryBlock}>
            <h3>Search Users by Username</h3>
            <label className={styles.field}>
              Search by username
              <input
                ref={directorySearchInputRef}
                type="search"
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                placeholder="@username"
              />
            </label>
            {searchingDirectory ? <p className={styles.status}>Searching...</p> : null}
            <div className={styles.userList}>
              {directoryResults.map((user) => {
                const alreadyParticipant = participantUserIds.has(user.user_id);
                return (
                  <div key={user.user_id} className={styles.userRowCard}>
                    <div>
                      <strong>{user.name}</strong>
                      <p>{user.username ? `@${user.username}` : user.email}</p>
                      {user.school_name ? <p className={styles.schoolLabel}>{user.school_name}</p> : null}
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void openDirectConversation(user.user_id);
                        }}
                        disabled={openingDirectUserId === user.user_id}
                      >
                        {openingDirectUserId === user.user_id ? "Opening..." : "Message"}
                      </button>
                      {canInviteParticipants && activeConversation ? (
                        <button
                          className="button"
                          type="button"
                          disabled={alreadyParticipant || invitingUserId === user.user_id}
                          onClick={() => {
                            void inviteParticipant(user.user_id);
                          }}
                        >
                          {alreadyParticipant
                            ? "In conversation"
                            : invitingUserId === user.user_id
                            ? "Inviting..."
                            : "Invite"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!searchingDirectory && directorySearch.trim() && directoryResults.length === 0 ? (
                <p className={styles.status}>No users found.</p>
              ) : null}
              {directoryResultsHasMore ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void loadDirectoryUsers({
                      query: directorySearch,
                      cursor: directoryResultsNextCursor,
                      reset: false,
                    });
                  }}
                  disabled={searchingDirectory}
                >
                  {searchingDirectory ? "Loading..." : "Load more"}
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.discoveryBlock}>
            <h3>Search Followed Users</h3>
            {activeConversation?.type === "channel" && canInviteParticipants ? (
              <label className={styles.field}>
                Invite role
                <select
                  value={currentParticipant?.role === "owner" ? inviteChannelRole : "editor"}
                  onChange={(event) =>
                    setInviteChannelRole(event.target.value as "owner" | "editor" | "viewer")
                  }
                  disabled={currentParticipant?.role !== "owner"}
                >
                  {currentParticipant?.role === "owner" ? (
                    <>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="owner">Owner</option>
                    </>
                  ) : (
                    <option value="editor">Editor</option>
                  )}
                </select>
              </label>
            ) : null}
            <label className={styles.field}>
              Search by name/email
              <input
                ref={followedSearchInputRef}
                type="search"
                value={followedSearch}
                onChange={(event) => setFollowedSearch(event.target.value)}
                placeholder="Find users you follow"
              />
            </label>
            {searchingFollowed ? <p className={styles.status}>Searching...</p> : null}
            <div className={styles.userList}>
              {followedResults.map((user) => {
                const alreadyParticipant = participantUserIds.has(user.user_id);
                return (
                  <div key={user.user_id} className={styles.userRowCard}>
                    <div>
                      <strong>{user.name}</strong>
                      <p>{user.username ? `@${user.username}` : user.email}</p>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void openDirectConversation(user.user_id);
                        }}
                        disabled={openingDirectUserId === user.user_id}
                      >
                        {openingDirectUserId === user.user_id ? "Opening..." : "Message"}
                      </button>
                      {canInviteParticipants && activeConversation ? (
                        <button
                          className="button"
                          type="button"
                          disabled={alreadyParticipant || invitingUserId === user.user_id}
                          onClick={() => {
                            void inviteParticipant(user.user_id);
                          }}
                        >
                          {alreadyParticipant
                            ? "In conversation"
                            : invitingUserId === user.user_id
                            ? "Inviting..."
                            : "Invite"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!searchingFollowed && followedSearch.trim() && followedResults.length === 0 ? (
                <p className={styles.status}>No matches found.</p>
              ) : null}
              {followedResultsHasMore ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void loadFollowedUsers({
                      query: followedSearch,
                      cursor: followedResultsNextCursor,
                      reset: false,
                    });
                  }}
                  disabled={searchingFollowed}
                >
                  {searchingFollowed ? "Loading..." : "Load more"}
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.discoveryBlock}>
            <h3>Interacted Users</h3>
            <label className={styles.field}>
              Search by name/email
              <input
                type="search"
                value={interactedSearch}
                onChange={(event) => setInteractedSearch(event.target.value)}
                placeholder="Filter recent collaborators"
              />
            </label>
            {loadingInteracted ? <p className={styles.status}>Loading interactions...</p> : null}
            <div className={styles.userList}>
              {interactedUsers.map((user) => {
                const alreadyParticipant = participantUserIds.has(user.user_id);
                return (
                  <div key={user.user_id} className={styles.userRowCard}>
                    <div>
                      <strong>{user.name}</strong>
                      <p>
                        Last interaction {formatDateTime(user.last_interaction_at)} - {user.message_count} messages
                      </p>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void openDirectConversation(user.user_id);
                        }}
                        disabled={openingDirectUserId === user.user_id}
                      >
                        {openingDirectUserId === user.user_id ? "Opening..." : "Open"}
                      </button>
                      {canInviteParticipants && activeConversation ? (
                        <button
                          className="button"
                          type="button"
                          disabled={alreadyParticipant || invitingUserId === user.user_id}
                          onClick={() => {
                            void inviteParticipant(user.user_id);
                          }}
                        >
                          {alreadyParticipant
                            ? "In conversation"
                            : invitingUserId === user.user_id
                            ? "Inviting..."
                            : "Invite"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!loadingInteracted && interactedUsers.length === 0 ? (
                <p className={styles.status}>
                  {interactedSearch.trim() ? "No matches found." : "No interactions yet."}
                </p>
              ) : null}
              {interactedUsersHasMore ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void loadInteractedUsers({
                      query: interactedSearch,
                      cursor: interactedUsersNextCursor,
                      reset: false,
                    });
                  }}
                  disabled={loadingInteracted}
                >
                  {loadingInteracted ? "Loading..." : "Load more"}
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.discoveryBlock} ref={mentionsPanelRef}>
            <div className={styles.discoveryHeader}>
              <h3>Mentions</h3>
              <span className={styles.unreadBadge}>{mentionsUnreadCount}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={mentionsUnreadOnly}
                onChange={(event) => setMentionsUnreadOnly(event.target.checked)}
              />
              Show unread only
            </label>
            {loadingMentions ? <p className={styles.status}>Loading mentions...</p> : null}
            <div className={styles.userList}>
              {mentions.map((mention) => (
                <button
                  key={mention.message_id}
                  type="button"
                  className={styles.userRow}
                  onClick={() => {
                    void openMentionConversation(mention);
                  }}
                  disabled={openingMentionMessageId === mention.message_id}
                >
                  <div>
                    <strong>{mention.conversation_name}</strong>
                    <p>
                      {mention.sender_name}: {mention.message_body || "Attachment"}
                    </p>
                    <p>{formatDateTime(mention.message_created_at)}</p>
                  </div>
                  <span>{openingMentionMessageId === mention.message_id ? "Opening..." : mention.unread ? "Unread" : "Seen"}</span>
                </button>
              ))}
              {!loadingMentions && mentions.length === 0 ? (
                <p className={styles.status}>No mentions in this view.</p>
              ) : null}
            </div>
          </div>

          <div className={styles.discoveryBlock} ref={assignmentRemindersPanelRef}>
            <div className={styles.discoveryHeader}>
              <h3>Assignment Reminders</h3>
              <span className={styles.unreadBadge}>{assignmentRemindersUnreadCount}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={assignmentRemindersUnreadOnly}
                onChange={(event) => setAssignmentRemindersUnreadOnly(event.target.checked)}
              />
              Show unread only
            </label>
            <button
              className="button"
              type="button"
              onClick={() => {
                void markAllAssignmentRemindersRead();
              }}
              disabled={markingAllAssignmentRemindersRead || assignmentRemindersUnreadCount === 0}
            >
              {markingAllAssignmentRemindersRead ? "Marking..." : "Mark all read"}
            </button>
            {loadingAssignmentReminders ? <p className={styles.status}>Loading reminders...</p> : null}
            <div className={styles.userList}>
              {assignmentReminders.map((reminder) => (
                <button
                  key={reminder.id}
                  type="button"
                  className={styles.userRow}
                  onClick={() => {
                    void openAssignmentReminderConversation(reminder);
                  }}
                  disabled={openingAssignmentReminderId === reminder.id}
                >
                  <div>
                    <strong>{reminder.conversation_name}</strong>
                    <p>{reminder.assignment_title?.trim() || "Assignment"}</p>
                    <p>
                      {getReminderKindLabel(reminder.reminder_kind)} · Due {formatDateTime(reminder.assignment_due_at)}
                    </p>
                  </div>
                  <span>
                    {openingAssignmentReminderId === reminder.id
                      ? "Opening..."
                      : reminder.unread
                      ? "Unread"
                      : "Seen"}
                  </span>
                </button>
              ))}
              {!loadingAssignmentReminders && assignmentReminders.length === 0 ? (
                <p className={styles.status}>No assignment reminders in this view.</p>
              ) : null}
            </div>
          </div>

          {normalizedSessionRole === "admin" ? (
            <div className={styles.discoveryBlock}>
              <div className={styles.discoveryHeader}>
                <h3>Moderation tools</h3>
                <button
                  className="button"
                  type="button"
                  onClick={() => setShowModerationTools((value) => !value)}
                >
                  {showModerationTools ? "Hide tools" : "Load tools"}
                </button>
              </div>
              {showModerationTools ? (
                <div ref={moderationPanelRef}>
                  <ModerationFeedPanel
                    moderationEvents={moderationEvents}
                    loadingModerationEvents={loadingModerationEvents}
                    moderationTypeFilter={moderationTypeFilter}
                    moderationSeverityFilter={moderationSeverityFilter}
                    setModerationTypeFilter={setModerationTypeFilter}
                    setModerationSeverityFilter={setModerationSeverityFilter}
                    refreshModerationEvents={() => {
                      void loadModerationEvents({
                        limit: 10,
                        severity: moderationSeverityFilter === "all" ? undefined : moderationSeverityFilter,
                        type: moderationTypeFilter === "all" ? undefined : moderationTypeFilter,
                      });
                    }}
                    openModerationEventTarget={(event) => {
                      void openModerationEventTarget(event);
                    }}
                    openingModerationEventId={openingModerationEventId}
                    formatDateTime={formatDateTime}
                  />
                </div>
              ) : (
                <p className={styles.status}>Load moderation tools only when needed to reduce initial data usage.</p>
              )}
            </div>
          ) : null}
          {loadingConversations ? <p className={styles.status}>Loading conversations...</p> : null}
          <div className={styles.summaryStats}>
            <span className={styles.tag}>Chats: {conversationSummary.total}</span>
            <span className={styles.tag}>Unread: {conversationSummary.unread}</span>
            <span className={styles.tag}>Due soon: {conversationSummary.dueSoon}</span>
            <span className={styles.tag}>Overdue: {conversationSummary.overdue}</span>
            {liteModeEnabled ? <span className={styles.tag}>Lite mode</span> : null}
          </div>
          <button
            className="button"
            type="button"
            onClick={() => {
              openFirstUnreadConversation();
            }}
            disabled={!firstUnreadConversation}
          >
            Open first unread
          </button>
          <label className={styles.field}>
            Search conversations
            <input
              ref={conversationSearchInputRef}
              type="search"
              value={conversationSearchQuery}
              onChange={(event) => setConversationSearchQuery(event.target.value)}
              placeholder="Search by name or last message"
            />
          </label>
          <label className={styles.field}>
            Conversation type
            <select
              value={conversationTypeFilter}
              onChange={(event) =>
                setConversationTypeFilter(
                  event.target.value as "all" | "direct" | "group" | "channel"
                )
              }
            >
              <option value="all">All</option>
              <option value="direct">Direct</option>
              <option value="group">Group</option>
              <option value="channel">Channel</option>
            </select>
          </label>
          <label className={styles.field}>
            Sort
            <select
              value={conversationSortMode}
              onChange={(event) =>
                setConversationSortMode(
                  event.target.value as "recent" | "unread" | "name" | "due_risk"
                )
              }
            >
              <option value="recent">Most recent</option>
              <option value="unread">Unread first</option>
              <option value="due_risk">Due risk</option>
              <option value="name">Name A-Z</option>
            </select>
          </label>
          <label className={styles.field}>
            Due date status
            <select
              value={conversationDueFilter}
              onChange={(event) =>
                setConversationDueFilter(
                  event.target.value as "all" | "due_soon" | "overdue" | "no_due"
                )
              }
            >
              <option value="all">All due dates</option>
              <option value="due_soon">Due soon (72h)</option>
              <option value="overdue">Overdue</option>
              <option value="no_due">No due date</option>
            </select>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={conversationUnreadOnly}
              onChange={(event) => setConversationUnreadOnly(event.target.checked)}
            />
            Show unread only
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showArchivedConversations}
              onChange={(event) => setShowArchivedConversations(event.target.checked)}
            />
            Show archived channels
          </label>
          <div className={styles.threadList}>
            {visibleConversations.map((conversation) => {
              const dueInfo =
                conversation.type === "channel"
                  ? getChannelDueInfo(conversation.assignment_due_at, timeNowMs)
                  : null;
              return (
                <button
                  key={conversation.id}
                  className={`${styles.thread} ${activeId === conversation.id ? styles.threadActive : ""}`}
                  type="button"
                  onClick={() => {
                    setActiveId(conversation.id);
                    void sendRead(conversation.id);
                  }}
                >
                  <div className={styles.threadBody}>
                    <strong>{conversation.name}</strong>
                    <p>
                      {conversation.last_message?.trim()
                        ? conversation.last_message
                        : conversation.last_message_at
                        ? "Attachment"
                        : "No messages yet."}
                    </p>
                  </div>
                  <div className={styles.threadMeta}>
                    <span className={styles.tag}>
                      {conversation.type === "direct"
                        ? "Direct"
                        : conversation.type === "channel"
                        ? "Channel"
                        : "Group"}{" "}
                      {conversation.archived_at ? "- Archived" : ""}
                    </span>
                    {dueInfo && dueInfo.state !== "none" ? (
                      <span
                        className={`${styles.dueTag} ${
                          dueInfo.state === "overdue"
                            ? styles.dueTagOverdue
                            : dueInfo.state === "due_soon"
                            ? styles.dueTagSoon
                            : styles.dueTagUpcoming
                        }`}
                      >
                        {dueInfo.label}
                      </span>
                    ) : null}
                    {Number(conversation.unread_count || 0) > 0 ? (
                      <span className={styles.unread}>{conversation.unread_count}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
            {!loadingConversations && visibleConversations.length === 0 ? (
              <p className={styles.status}>No conversations in this view.</p>
            ) : null}
          </div>
              </aside>
            </ConversationListPanel>

        <ThreadViewPanel>
          <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>{activeConversation ? activeConversation.name : "Messages"}</h2>
            <p className="subtitle">
              {activeConversation
                ? `${participants.length} participant${participants.length === 1 ? "" : "s"}`
                : "Choose a conversation to start messaging."}
            </p>
          </div>

          {activeConversation ? (
            <label className={styles.field}>
              Search this conversation
              <input
                ref={messageSearchInputRef}
                type="search"
                value={messageSearchQuery}
                onChange={(event) => setMessageSearchQuery(event.target.value)}
                placeholder="Search messages or attachment names"
              />
            </label>
          ) : null}

          {activeConversation ? (
            <div className={styles.quickFilters}>
              {MESSAGE_SEARCH_QUICK_FILTERS.map((preset) => (
                <button
                  key={preset.token}
                  className={styles.quickFilterChip}
                  type="button"
                  onClick={() => {
                    applyQuickSearchFilter(preset.token);
                  }}
                >
                  {preset.label}
                </button>
              ))}
              {messageSearchQuery.trim() ? (
                <button
                  className={styles.quickFilterChip}
                  type="button"
                  onClick={() => setMessageSearchQuery("")}
                >
                  Clear search
                </button>
              ) : null}
            </div>
          ) : null}

          {activeConversation && messageSearchHistory.length ? (
            <div className={styles.searchHistoryRow}>
              <strong>Recent searches</strong>
              <div className={styles.quickFilters}>
                {messageSearchHistory.map((entry) => (
                  <button
                    key={entry}
                    className={styles.quickFilterChip}
                    type="button"
                    onClick={() => setMessageSearchQuery(entry)}
                  >
                    {entry}
                  </button>
                ))}
              </div>
              <button className="button" type="button" onClick={() => clearMessageSearchHistory()}>
                Clear history
              </button>
            </div>
          ) : null}

          {activeConversation && messageSearchQuery.trim() ? (
            <div className={styles.searchResults}>
              <div className={styles.discoveryHeader}>
                <strong>Search results</strong>
                {searchingMessages ? <span className={styles.status}>Searching...</span> : null}
              </div>
              <div className={styles.userList}>
                {messageSearchResults.map((message) => (
                  <div key={message.id} className={styles.userRow}>
                    <div>
                      <strong>{message.sender_id === session?.user.id ? "You" : message.sender_name || "Participant"}</strong>
                      <p>{message.body?.trim() || summarizeMessage(message)}</p>
                      <p>{formatDateTime(message.created_at)}</p>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void jumpToMessage(message);
                        }}
                      >
                        Open
                      </button>
                      <span>{message.pinned_at ? "Pinned" : "Message"}</span>
                    </div>
                  </div>
                ))}
                {!searchingMessages && messageSearchResults.length === 0 ? (
                  <p className={styles.status}>No matches found in this conversation.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeConversation ? (
            <div className={styles.stateRow}>
              {currentParticipant ? (
                <span className={styles.tag}>Your role: {roleLabel(currentParticipant.role)}</span>
              ) : null}
              {isConversationMuted ? (
                <span className={styles.tag}>Muted until {formatDateTime(settings?.muted_until)}</span>
              ) : null}
              {activeConversation.type === "channel" ? (
                <>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={settings?.mention_notifications ?? true}
                      onChange={(event) => {
                        void updateMentionNotifications(event.target.checked);
                      }}
                      disabled={savingMentionSetting}
                    />
                    Mention alerts
                  </label>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={settings?.channel_event_notifications ?? true}
                      onChange={(event) => {
                        void updateChannelEventNotifications(event.target.checked);
                      }}
                      disabled={savingNotificationPrivacySetting}
                    />
                    Channel event alerts
                  </label>
                  <label className={styles.inlineField}>
                    Assignment reminders
                    <select
                      value={settings?.assignment_reminder_mode ?? "72h"}
                      onChange={(event) => {
                        void updateAssignmentReminderMode(
                          event.target.value as ConversationSettings["assignment_reminder_mode"]
                        );
                      }}
                      disabled={savingAssignmentReminderSetting}
                    >
                      <option value="72h">72h before due</option>
                      <option value="24h">24h before due</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                  <label className={styles.inlineField}>
                    Snooze reminders
                    <select
                      value={String(activeReminderSnoozePresetMinutes)}
                      onChange={(event) => {
                        void updateAssignmentReminderSnooze(Number(event.target.value));
                      }}
                      disabled={savingAssignmentReminderSetting}
                    >
                      <option value="0">No snooze</option>
                      <option value="240">4h</option>
                      <option value="1440">24h</option>
                      <option value="4320">72h</option>
                    </select>
                  </label>
                  <label className={styles.inlineField}>
                    Overdue repeat
                    <select
                      value={String(settings?.assignment_overdue_repeat_hours ?? 24)}
                      onChange={(event) => {
                        void updateAssignmentOverdueRepeatHours(Number(event.target.value));
                      }}
                      disabled={savingAssignmentReminderSetting}
                    >
                      <option value="6">Every 6h</option>
                      <option value="12">Every 12h</option>
                      <option value="24">Every 24h</option>
                      <option value="48">Every 48h</option>
                      <option value="72">Every 72h</option>
                    </select>
                  </label>
                </>
              ) : null}
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings?.message_update_notifications ?? true}
                  onChange={(event) => {
                    void updateMessageUpdateNotifications(event.target.checked);
                  }}
                  disabled={savingNotificationPrivacySetting}
                />
                Message update alerts
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings?.share_presence ?? true}
                  onChange={(event) => {
                    void updateSharePresence(event.target.checked);
                  }}
                  disabled={savingNotificationPrivacySetting}
                />
                Share presence
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings?.share_typing ?? true}
                  onChange={(event) => {
                    void updateShareTyping(event.target.checked);
                  }}
                  disabled={savingNotificationPrivacySetting}
                />
                Share typing
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings?.share_read_receipts ?? true}
                  onChange={(event) => {
                    void updateShareReadReceipts(event.target.checked);
                  }}
                  disabled={savingNotificationPrivacySetting}
                />
                Share read receipts
              </label>
              {activeConversation.type === "channel" && activeReminderSnoozed ? (
                <span className={styles.tag}>
                  Reminders snoozed until {formatDateTime(settings?.assignment_reminder_snoozed_until)}
                </span>
              ) : null}
              <button
                className="button"
                type="button"
                onClick={() => {
                  void updateMuteWindow(60);
                }}
                disabled={savingMuteWindow}
              >
                {savingMuteWindow ? "Saving..." : "Mute 1h"}
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  void updateMuteWindow(480);
                }}
                disabled={savingMuteWindow}
              >
                {savingMuteWindow ? "Saving..." : "Mute 8h"}
              </button>
              {isConversationMuted ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void updateMuteWindow(0);
                  }}
                  disabled={savingMuteWindow}
                >
                  {savingMuteWindow ? "Saving..." : "Unmute"}
                </button>
              ) : null}
              <button
                className="button"
                type="button"
                onClick={() => {
                  exportActiveConversation();
                }}
              >
                Export JSON
              </button>
              {activeConversation.type === "direct" && directPeerParticipant ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void reportDirectUser();
                  }}
                  disabled={reportingUserId === directPeerParticipant.user_id}
                >
                  {reportingUserId === directPeerParticipant.user_id ? "Reporting..." : "Report user"}
                </button>
              ) : null}
              {canManageArchive ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void toggleChannelArchive(!channelArchived);
                  }}
                  disabled={togglingArchive}
                >
                  {togglingArchive
                    ? "Saving..."
                    : channelArchived
                    ? "Unarchive channel"
                    : "Archive channel"}
                </button>
              ) : null}
              {activeConversation.type !== "direct" ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void leaveConversationByAction();
                  }}
                  disabled={leavingConversation}
                >
                  {leavingConversation ? "Leaving..." : "Leave conversation"}
                </button>
              ) : null}
            </div>
          ) : null}

          {typingIndicatorText ? <p className={styles.typingIndicator}>{typingIndicatorText}</p> : null}

          {activeChannelReminderInfo ? (
            <div
              className={`${styles.reminderBanner} ${
                activeChannelReminderInfo.level === "overdue" ? styles.reminderBannerOverdue : styles.reminderBannerSoon
              }`}
            >
              <strong>
                {activeChannelReminderInfo.level === "overdue" ? "Assignment overdue" : "Assignment reminder"}
              </strong>
              <p>{activeChannelReminderInfo.message}</p>
            </div>
          ) : null}

          {activeConversation ? (
            <div className={styles.insightGrid}>
              {explainableInsights.map((card) => (
                <article
                  key={card.id}
                  className={`${styles.insightCard} ${
                    card.tone === "good"
                      ? styles.insightCardGood
                      : card.tone === "warn"
                      ? styles.insightCardWarn
                      : ""
                  }`}
                >
                  <p>{card.title}</p>
                  <strong>{card.value}</strong>
                  <span>{card.reason}</span>
                </article>
              ))}
            </div>
          ) : null}

          {channelArchived ? (
            <div className={styles.archiveBanner}>
              <strong>Channel archived</strong>
              <p>This channel is currently read-only. Owners can unarchive it to resume posting.</p>
            </div>
          ) : null}

          {activeConversation ? (
            <div className={styles.pinPanel}>
              <div className={styles.discoveryHeader}>
                <strong>Pinned messages</strong>
                {loadingPins ? <span className={styles.status}>Loading...</span> : null}
              </div>
              <label className={styles.inlineField}>
                Search
                <input
                  type="search"
                  value={pinnedSearchQuery}
                  onChange={(event) => setPinnedSearchQuery(event.target.value)}
                  placeholder="Find pinned messages"
                />
              </label>
              <div className={styles.userList}>
                {filteredPinnedMessages.map((message) => (
                  <div key={message.id} className={styles.userRow}>
                    <div>
                      <strong>{message.sender_id === session?.user.id ? "You" : message.sender_name || "Participant"}</strong>
                      <p>{message.body?.trim() || summarizeMessage(message)}</p>
                      <p>Pinned {formatDateTime(message.pinned_at || message.created_at)}</p>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void jumpToMessage(message);
                        }}
                      >
                        Open
                      </button>
                      {canPinMessages ? (
                        <button
                          className="button"
                          type="button"
                          onClick={() => {
                            void toggleMessagePin(message.id, false);
                          }}
                          disabled={pinningMessageId === message.id}
                        >
                          {pinningMessageId === message.id ? "..." : "Unpin"}
                        </button>
                      ) : (
                        <span>Pinned</span>
                      )}
                    </div>
                  </div>
                ))}
                {!loadingPins && filteredPinnedMessages.length === 0 ? (
                  <p className={styles.status}>
                    {pinnedSearchQuery.trim() ? "No pinned messages match this search." : "No pinned messages yet."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeConversation ? (
            <div className={styles.savedPanel}>
              <div className={styles.discoveryHeader}>
                <strong>Saved messages</strong>
                {loadingSavedMessages ? <span className={styles.status}>Loading...</span> : null}
              </div>
              <label className={styles.inlineField}>
                Search
                <input
                  type="search"
                  value={savedSearchQuery}
                  onChange={(event) => setSavedSearchQuery(event.target.value)}
                  placeholder="Find saved messages"
                />
              </label>
              <div className={styles.userList}>
                {filteredSavedMessages.slice(0, 20).map((message) => (
                  <div key={`${message.id}-${message.saved_at}`} className={styles.userRow}>
                    <div>
                      <strong>{message.sender_id === session?.user.id ? "You" : message.sender_name || "Participant"}</strong>
                      <p>{message.body?.trim() || summarizeMessage(message)}</p>
                      <p>
                        {message.conversation_name} · Saved {formatDateTime(message.saved_at)}
                      </p>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void openSavedMessage(message);
                        }}
                      >
                        Open
                      </button>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void toggleSaved(message);
                        }}
                        disabled={savingMessageId === message.id}
                      >
                        {savingMessageId === message.id ? "..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
                {!loadingSavedMessages && filteredSavedMessages.length === 0 ? (
                  <p className={styles.status}>
                    {savedSearchQuery.trim() ? "No saved messages match this search." : "No saved messages yet."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeConversation ? (
            <div className={styles.activityPanel}>
              <div className={styles.discoveryHeader}>
                <strong>Activity history</strong>
                <div className={styles.rowActionsInline}>
                  <label className={styles.inlineField}>
                    Filter
                    <select
                      value={activityFilter}
                      onChange={(event) =>
                        setActivityFilter(event.target.value as ConversationActivityEvent["event_type"] | "all")
                      }
                    >
                      <option value="all">All events</option>
                      {activityEventTypeOptions.map((eventType) => (
                        <option key={eventType} value={eventType}>
                          {eventType.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  {loadingActivity ? <span className={styles.status}>Loading...</span> : null}
                </div>
              </div>
              <div className={styles.activityList}>
                {filteredActivityEvents.map((event) => {
                  const details = summarizeActivityDetails(event);
                  return (
                    <div key={event.id} className={styles.activityItem}>
                      <strong>{summarizeActivityEvent(event, session?.user.id)}</strong>
                      {details ? <p>{details}</p> : null}
                      <span>{formatDateTime(event.created_at)}</span>
                    </div>
                  );
                })}
                {!loadingActivity && filteredActivityEvents.length === 0 ? (
                  <p className={styles.status}>
                    {activityFilter === "all" ? "No activity recorded yet." : "No activity events for this filter."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeConversation?.type === "channel" ? (
            <div className={styles.assignmentCard}>
              <div className={styles.assignmentCardHeader}>
                <strong>{activeConversation.assignment_title || "Assignment channel"}</strong>
                {canEditAssignmentDetails ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      if (editingAssignmentDetails) {
                        cancelAssignmentEditor();
                        return;
                      }
                      openAssignmentEditor();
                    }}
                  >
                    {editingAssignmentDetails ? "Cancel" : "Edit details"}
                  </button>
                ) : null}
              </div>
              {editingAssignmentDetails ? (
                <form
                  className={styles.assignmentEditor}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveChannelAssignmentDetails();
                  }}
                >
                  <div className={styles.assignmentEditorGrid}>
                    <label>
                      Channel name
                      <input
                        value={editChannelName}
                        onChange={(event) => setEditChannelName(event.target.value)}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      Assignment title
                      <input
                        value={editAssignmentTitle}
                        onChange={(event) => setEditAssignmentTitle(event.target.value)}
                        maxLength={140}
                        required
                      />
                    </label>
                    <label>
                      Template
                      <select
                        value={editAssignmentTemplateId}
                        onChange={(event) => setEditAssignmentTemplateId(event.target.value)}
                      >
                        <option value={KEEP_CURRENT_TEMPLATE_OPTION}>Keep current template</option>
                        <option value="none">No template</option>
                        {Object.entries(CHANNEL_TEMPLATE_PRESETS).map(([id, preset]) => (
                          <option key={id} value={id}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {editSelectedTemplatePreset ? (
                    <div className={styles.templatePreview}>
                      <strong>{editSelectedTemplatePreset.label}</strong>
                      <p>{editSelectedTemplatePreset.description}</p>
                      <ul>
                        {editSelectedTemplatePreset.checklist.slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <label>
                    Assignment description
                    <textarea
                      rows={4}
                      value={editAssignmentDescription}
                      onChange={(event) => setEditAssignmentDescription(event.target.value)}
                      maxLength={2000}
                      placeholder="Add assignment guidance for this channel."
                    />
                  </label>
                  <label>
                    Due date and time
                    <input
                      type="datetime-local"
                      value={editAssignmentDueAt}
                      onChange={(event) => setEditAssignmentDueAt(event.target.value)}
                    />
                  </label>
                  <div className={styles.assignmentEditorActions}>
                    <button className="button" type="submit" disabled={savingAssignmentDetails}>
                      {savingAssignmentDetails ? "Saving..." : "Save details"}
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        cancelAssignmentEditor();
                      }}
                      disabled={savingAssignmentDetails}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {activeConversation.assignment_description ? (
                    <p>{activeConversation.assignment_description}</p>
                  ) : null}
                  {activeConversation.assignment_due_at ? (
                    <div className={styles.assignmentDueRow}>
                      <span>Due {formatDateTime(activeConversation.assignment_due_at)}</span>
                      {activeChannelDueInfo && activeChannelDueInfo.state !== "none" ? (
                        <span
                          className={`${styles.dueTag} ${
                            activeChannelDueInfo.state === "overdue"
                              ? styles.dueTagOverdue
                              : activeChannelDueInfo.state === "due_soon"
                              ? styles.dueTagSoon
                              : styles.dueTagUpcoming
                          }`}
                        >
                          {activeChannelDueInfo.label}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {activeConversation.assignment_template?.checklist?.length ? (
                    <div className={styles.assignmentTemplateSection}>
                      <strong>Checklist</strong>
                      <ul>
                        {activeConversation.assignment_template.checklist.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {activeConversation.assignment_template?.rubric?.length ? (
                    <div className={styles.assignmentTemplateSection}>
                      <strong>Rubric</strong>
                      <ul>
                        {activeConversation.assignment_template.rubric.map((criterion) => (
                          <li key={`${criterion.criterion}-${criterion.weight || 0}`}>
                            {criterion.criterion}
                            {criterion.weight ? ` (${criterion.weight}%)` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {activeConversation && !liteModeEnabled ? (
            <div className={styles.quotaCard}>
              <div className={styles.discoveryHeader}>
                <strong>Attachment quota</strong>
                <div className={styles.rowActionsInline}>
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      void loadAttachmentQuota(activeConversation.id);
                    }}
                    disabled={loadingAttachmentQuota}
                  >
                    {loadingAttachmentQuota ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
              {attachmentQuota ? (
                <>
                  <div className={styles.quotaBar}>
                    <div
                      className={styles.quotaBarFill}
                      style={{
                        width: `${attachmentQuotaPercentUsed}%`,
                      }}
                    />
                  </div>
                  <div className={styles.quotaMeta}>
                    <span>
                      {formatBytes(Number(attachmentQuota.usage.totalBytes || 0))} used /{" "}
                      {formatBytes(Number(attachmentQuota.quota.max_bytes || 0))}
                    </span>
                    <span>{formatBytes(Number(attachmentQuota.remainingBytes || 0))} remaining</span>
                    <span>{Number(attachmentQuota.usage.attachmentCount || 0)} files</span>
                    <span>Retention: {Number(attachmentQuota.quota.retention_days || 30)} days</span>
                  </div>
                  {attachmentQuotaWarning ? <p className={styles.status}>{attachmentQuotaWarning}</p> : null}
                  {canReplyMessages ? (
                    <form
                      className={styles.quotaEditor}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveAttachmentQuota();
                      }}
                    >
                      <label>
                        Max MB
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          value={attachmentQuotaMaxMbInput}
                          onChange={(event) => setAttachmentQuotaMaxMbInput(event.target.value)}
                        />
                      </label>
                      <label>
                        Retention days
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={attachmentQuotaRetentionDaysInput}
                          onChange={(event) => setAttachmentQuotaRetentionDaysInput(event.target.value)}
                        />
                      </label>
                      <button className="button" type="submit" disabled={updatingAttachmentQuota}>
                        {updatingAttachmentQuota ? "Saving..." : "Save quota"}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : loadingAttachmentQuota ? (
                <p className={styles.status}>Loading quota...</p>
              ) : (
                <p className={styles.status}>Quota unavailable.</p>
              )}
            </div>
          ) : null}

          {activeConversation?.type === "channel" ? (
            <div className={styles.channelBoard}>
              <div className={styles.discoveryHeader}>
                <strong>Channel tasks</strong>
                {loadingChannelTasks ? <span className={styles.status}>Loading...</span> : null}
              </div>
              <div className={styles.summaryStats}>
                <span className={styles.tag}>Todo: {taskSummary.todo}</span>
                <span className={styles.tag}>In progress: {taskSummary.inProgress}</span>
                <span className={styles.tag}>Done: {taskSummary.done}</span>
                <span className={styles.tag}>Overdue: {taskSummary.overdue}</span>
                <span className={styles.tag}>Due soon: {taskSummary.dueSoon}</span>
                <span className={styles.tag}>Upcoming: {taskSummary.upcoming}</span>
                <span className={styles.tag}>No due: {taskSummary.noDue}</span>
              </div>
              <div className={styles.taskFilterRow}>
                <label className={styles.inlineField}>
                  Search
                  <input
                    type="search"
                    value={taskSearchQuery}
                    onChange={(event) => setTaskSearchQuery(event.target.value)}
                    placeholder="Find task"
                  />
                </label>
                <label className={styles.inlineField}>
                  Status
                  <select
                    value={taskStatusFilter}
                    onChange={(event) => setTaskStatusFilter(event.target.value as ChannelTask["status"] | "all")}
                  >
                    <option value="all">All</option>
                    <option value="todo">Todo</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
                <label className={styles.inlineField}>
                  Due
                  <select
                    value={taskDueFilter}
                    onChange={(event) =>
                      setTaskDueFilter(event.target.value as "all" | "overdue" | "due_soon" | "upcoming" | "none")
                    }
                  >
                    <option value="all">All</option>
                    <option value="overdue">Overdue</option>
                    <option value="due_soon">Due soon</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="none">No due date</option>
                  </select>
                </label>
                <label className={styles.inlineField}>
                  Sort
                  <select
                    value={taskSortMode}
                    onChange={(event) =>
                      setTaskSortMode(event.target.value as "due_asc" | "due_desc" | "status")
                    }
                  >
                    <option value="due_asc">Earliest due</option>
                    <option value="due_desc">Latest due</option>
                    <option value="status">Status</option>
                  </select>
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={showMyTasksOnly}
                    onChange={(event) => setShowMyTasksOnly(event.target.checked)}
                  />
                  My tasks only
                </label>
                {nextUrgentTaskWithMessage ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      void jumpToMessageById(nextUrgentTaskWithMessage.linked_message_id as string);
                    }}
                  >
                    Open next due message
                  </button>
                ) : null}
              </div>
              <div className={styles.userList}>
                {filteredChannelTasks.map((task) => {
                  const dueInfo = getChannelDueInfo(task.due_at, timeNowMs);
                  return (
                  <div key={task.id} className={styles.userRowCard}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>
                        {task.description?.trim() || "No description"} ·{" "}
                        {task.due_at ? `Due ${formatDateTime(task.due_at)}` : "No due date"}
                      </p>
                      <p>
                        Assignee: {toUserDisplayName(task.assignee_id, participants, session?.user.id)}
                      </p>
                    </div>
                    {dueInfo.state === "none" ? (
                      <span className={styles.tag}>{dueInfo.label}</span>
                    ) : (
                      <span
                        className={`${styles.dueTag} ${
                          dueInfo.state === "overdue"
                            ? styles.dueTagOverdue
                            : dueInfo.state === "due_soon"
                            ? styles.dueTagSoon
                            : styles.dueTagUpcoming
                        }`}
                      >
                        {dueInfo.label}
                      </span>
                    )}
                    <div className={styles.rowActions}>
                      {task.linked_message_id ? (
                        <button
                          className="button"
                          type="button"
                          onClick={() => {
                            void jumpToMessageById(task.linked_message_id as string);
                          }}
                        >
                          Open message
                        </button>
                      ) : null}
                      <select
                        value={task.status}
                        onChange={(event) => {
                          void updateTaskStatus(task.id, event.target.value as ChannelTask["status"]);
                        }}
                        disabled={updatingTaskId === task.id || !canReplyMessages}
                      >
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>
                  );
                })}
                {!loadingChannelTasks && filteredChannelTasks.length === 0 ? (
                  <p className={styles.status}>No tasks match this filter.</p>
                ) : null}
              </div>
              {canReplyMessages ? (
                <form
                  className={styles.taskForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createChannelTaskByAction();
                  }}
                >
                  <label>
                    Task title
                    <input
                      value={newTaskTitle}
                      onChange={(event) => setNewTaskTitle(event.target.value)}
                      maxLength={240}
                      required
                    />
                  </label>
                  <label>
                    Description
                    <input
                      value={newTaskDescription}
                      onChange={(event) => setNewTaskDescription(event.target.value)}
                      maxLength={4000}
                    />
                  </label>
                  <label>
                    Assignee
                    <select
                      value={newTaskAssigneeId}
                      onChange={(event) => setNewTaskAssigneeId(event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {participants.map((participant) => (
                        <option key={participant.user_id} value={participant.user_id}>
                          {participant.user_id === session?.user.id ? "You" : participant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due date
                    <input
                      type="datetime-local"
                      value={newTaskDueAt}
                      onChange={(event) => setNewTaskDueAt(event.target.value)}
                    />
                  </label>
                  <button className="button" type="submit" disabled={creatingChannelTask}>
                    {creatingChannelTask ? "Creating..." : "Add task"}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          {activeConversation?.type === "channel" ? (
            <div className={styles.channelBoard}>
              <div className={styles.discoveryHeader}>
                <strong>Channel assessments</strong>
                <div className={styles.rowActionsInline}>
                  {nextUrgentAssessment ? (
                    <button
                      className="button"
                      type="button"
                      onClick={() => setAssessmentDueFilter("due_soon")}
                    >
                      Focus due soon
                    </button>
                  ) : null}
                  {assessmentDueFilter !== "all" ? (
                    <button className="button" type="button" onClick={() => setAssessmentDueFilter("all")}>
                      Clear filter
                    </button>
                  ) : null}
                  {loadingChannelAssessments ? <span className={styles.status}>Loading...</span> : null}
                </div>
              </div>
              <div className={styles.summaryStats}>
                <span className={styles.tag}>Overdue: {assessmentSummary.overdue}</span>
                <span className={styles.tag}>Due soon: {assessmentSummary.dueSoon}</span>
                <span className={styles.tag}>Upcoming: {assessmentSummary.upcoming}</span>
                <span className={styles.tag}>No due: {assessmentSummary.none}</span>
              </div>
              <div className={styles.taskFilterRow}>
                <label className={styles.inlineField}>
                  Search
                  <input
                    type="search"
                    value={assessmentSearchQuery}
                    onChange={(event) => setAssessmentSearchQuery(event.target.value)}
                    placeholder="Find assessment"
                  />
                </label>
                <label className={styles.inlineField}>
                  Due
                  <select
                    value={assessmentDueFilter}
                    onChange={(event) =>
                      setAssessmentDueFilter(
                        event.target.value as "all" | "overdue" | "due_soon" | "upcoming" | "none"
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="overdue">Overdue</option>
                    <option value="due_soon">Due soon</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="none">No due date</option>
                  </select>
                </label>
              </div>
              <div className={styles.userList}>
                {filteredChannelAssessments.map((assessment) => {
                  const dueInfo = getAssessmentDueState(assessment.due_at, timeNowMs);
                  return (
                    <div key={assessment.id} className={styles.userRowCard}>
                    <div>
                      <strong>{assessment.title}</strong>
                      <p>
                        Max score {Math.round(Number(assessment.max_score || 100))} · Published{" "}
                        {formatDateTime(assessment.published_at)}
                      </p>
                      <p>{assessment.due_at ? `Due ${formatDateTime(assessment.due_at)}` : "No due date"}</p>
                      </div>
                      {dueInfo.state !== "none" ? (
                        <span
                          className={`${styles.dueTag} ${
                            dueInfo.state === "overdue"
                              ? styles.dueTagOverdue
                              : dueInfo.state === "due_soon"
                              ? styles.dueTagSoon
                              : styles.dueTagUpcoming
                          }`}
                        >
                          {dueInfo.label}
                        </span>
                      ) : (
                        <span className={styles.tag}>{dueInfo.label}</span>
                      )}
                    </div>
                  );
                })}
                {!loadingChannelAssessments && filteredChannelAssessments.length === 0 ? (
                  <p className={styles.status}>
                    {assessmentSearchQuery.trim() || assessmentDueFilter !== "all"
                      ? "No assessments match this filter."
                      : "No assessments yet."}
                  </p>
                ) : null}
              </div>
              {canReplyMessages ? (
                <form
                  className={styles.taskForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createChannelAssessmentByAction();
                  }}
                >
                  <label>
                    Assessment title
                    <input
                      value={newAssessmentTitle}
                      onChange={(event) => setNewAssessmentTitle(event.target.value)}
                      maxLength={240}
                      required
                    />
                  </label>
                  <label>
                    Instructions
                    <input
                      value={newAssessmentInstructions}
                      onChange={(event) => setNewAssessmentInstructions(event.target.value)}
                      maxLength={5000}
                    />
                  </label>
                  <label>
                    Max score
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={newAssessmentMaxScore}
                      onChange={(event) => setNewAssessmentMaxScore(event.target.value)}
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      type="datetime-local"
                      value={newAssessmentDueAt}
                      onChange={(event) => setNewAssessmentDueAt(event.target.value)}
                    />
                  </label>
                  <button className="button" type="submit" disabled={creatingChannelAssessment}>
                    {creatingChannelAssessment ? "Creating..." : "Add assessment"}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          {participants.length ? (
            <div className={styles.participants}>
              {participants.map((participant) => {
                const isSelfParticipant = participant.user_id === session?.user.id;
                const actorRole = currentParticipant?.role;
                const canRemoveParticipant = activeConversation
                  ? activeConversation.type === "channel"
                    ? actorRole === "owner"
                      ? participant.role !== "owner" || ownerParticipantCount > 1
                      : actorRole === "editor"
                      ? !isSelfParticipant && participant.role !== "owner"
                      : false
                    : activeConversation.type === "group"
                    ? isSelfParticipant
                    : false
                  : false;
                const participantPresence = presenceByUserId[participant.user_id];
                const participantOnline = Boolean(participantPresence?.is_online);

                return (
                  <div key={participant.user_id} className={styles.participant}>
                    <strong>{isSelfParticipant ? "You" : participant.name}</strong>
                    <span>{participant.email}</span>
                    <span
                      className={`${styles.participantPresence} ${
                        participantOnline ? styles.participantPresenceOnline : ""
                      }`}
                    >
                      {participantOnline ? "Online" : "Offline"}
                    </span>
                    <span className={styles.participantRole}>{roleLabel(participant.role)}</span>
                    {canManageChannelRoles ? (
                      <label className={styles.participantRoleEditor}>
                        Role
                        <select
                          value={
                            participant.role === "owner" ||
                            participant.role === "editor" ||
                            participant.role === "viewer"
                              ? participant.role
                              : "viewer"
                          }
                          onChange={(event) => {
                            void updateParticipantRole(
                              participant.user_id,
                              event.target.value as "owner" | "editor" | "viewer"
                            );
                          }}
                          disabled={updatingRoleUserId === participant.user_id || isSelfParticipant}
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </label>
                    ) : null}
                    {canRemoveParticipant ? (
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void removeParticipantFromConversation(participant.user_id);
                        }}
                        disabled={removingParticipantUserId === participant.user_id}
                      >
                        {removingParticipantUserId === participant.user_id
                          ? isSelfParticipant
                            ? "Leaving..."
                            : "Removing..."
                          : isSelfParticipant
                          ? "Leave"
                          : "Remove"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {activeConversation ? (
            <div className={styles.discoveryHeader}>
              <strong>Message timeline</strong>
              <div className={styles.rowActionsInline}>
                <label className={styles.inlineField}>
                  View
                  <select
                    value={messageTimelineFilter}
                    onChange={(event) =>
                      setMessageTimelineFilter(event.target.value as "all" | "media" | "attachments")
                    }
                  >
                    <option value="all">All messages</option>
                    <option value="media">Messages with media</option>
                    <option value="attachments">Messages with attachments</option>
                  </select>
                </label>
                <span className={styles.tag}>{filteredTimelineMessages.length} shown</span>
              </div>
            </div>
          ) : null}

          <div className={styles.messageList}>
            {loadingMessages ? <p className={styles.status}>Loading messages...</p> : null}
            {!loadingMessages && !activeConversation ? <p className={styles.emptyState}>Messages appear here.</p> : null}
            {!loadingMessages && activeConversation && filteredTimelineMessages.length === 0 ? (
              <p className={styles.emptyState}>
                {messageTimelineFilter === "all"
                  ? "No messages yet. Start the conversation."
                  : "No messages match this timeline filter."}
              </p>
            ) : null}

            {filteredTimelineMessages.map((message) => {
              const isSelf = message.sender_id === session?.user.id;
              const selfUserId = session?.user.id;
              const mentionedSelf =
                !isSelf &&
                Boolean(selfUserId) &&
                (message.mention_user_ids || []).includes(selfUserId as string);
              const isDeleted = Boolean(message.deleted_at);
              const deliveryState = isSelf ? message.status || message.delivery_status : undefined;
              const canTogglePin = canPinMessages && !message.id.startsWith("temp-") && !isDeleted;
              const isEditing = editingMessageId === message.id;
              const reactionEntries = message.reactions || [];
              const replyPreview = message.reply_to || null;
              const visibleReplyCount = Number(replyCountByParentId.get(message.id) || 0);
              const threadRootForMessage = resolveThreadRootId(message);
              const isSavedMessage = savedMessageIds.has(message.id);
              const canOpenThread =
                !message.id.startsWith("temp-") && (Boolean(message.parent_message_id) || visibleReplyCount > 0);
              return (
                <Fragment key={message.id}>
                  {unreadBoundaryMessageId === message.id ? (
                    <div className={styles.unreadSeparator} role="separator" aria-label="Unread messages">
                      <span>Unread messages</span>
                    </div>
                  ) : null}
                  <div id={`message-${message.id}`} className={styles.messageRow} data-self={isSelf}>
                    <div
                      className={`${styles.messageBubble} ${mentionedSelf ? styles.messageBubbleMentioned : ""} ${
                        highlightedMessageId === message.id ? styles.messageBubbleHighlight : ""
                      } ${isDeleted ? styles.messageBubbleDeleted : ""}`}
                    >
                      {message.pinned_at ? <span className={styles.pinnedLabel}>Pinned</span> : null}
                      {replyPreview ? (
                        <button
                          type="button"
                          className={styles.replyPreview}
                          onClick={() => {
                            void jumpToMessageById(replyPreview.id);
                          }}
                        >
                          <strong>{replyPreview.sender_id === session?.user.id ? "You" : replyPreview.sender_name}</strong>
                          <span>{summarizeReplyPreview(replyPreview)}</span>
                        </button>
                      ) : null}
                      {isEditing ? (
                        <form
                          className={styles.inlineEditForm}
                          onSubmit={(event) => {
                            event.preventDefault();
                            void editMessage(message.id, editingBody);
                          }}
                        >
                          <textarea
                            value={editingBody}
                            onChange={(event) => setEditingBody(event.target.value)}
                            rows={3}
                            maxLength={2000}
                          />
                          <div className={styles.inlineEditActions}>
                            <button
                              className="button"
                              type="submit"
                              disabled={savingEditMessageId === message.id || !editingBody.trim()}
                            >
                              {savingEditMessageId === message.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              className="button"
                              type="button"
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditingBody("");
                              }}
                              disabled={savingEditMessageId === message.id}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : message.body ? (
                        <p
                          className={`${styles.messageText} ${isDeleted ? styles.messageTextDeleted : ""}`}
                        >
                          {renderMessageText(message.body)}
                        </p>
                      ) : null}

                      {!isDeleted && (message.attachments || []).length ? (
                        liteModeEnabled ? (
                          <div className={styles.attachmentStack}>
                            {(message.attachments || []).map((attachment) => {
                              const url = attachmentUrl(attachment);
                              const scanLabel = attachmentScanLabel(attachment);
                              return (
                                <a key={attachment.id} href={url} target="_blank" rel="noreferrer" className={styles.attachmentFile}>
                                  <strong>{attachment.file_name}</strong>
                                  <span>
                                    {attachment.kind.toUpperCase()} - {formatBytes(Number(attachment.size_bytes || 0))}
                                  </span>
                                  {scanLabel ? <span className={styles.scanBadge}>{scanLabel}</span> : null}
                                </a>
                              );
                            })}
                          </div>
                        ) : (
                          <MessageAttachmentList
                            attachments={message.attachments || []}
                            attachmentUrl={attachmentUrl}
                            attachmentScanLabel={attachmentScanLabel}
                            formatBytes={formatBytes}
                          />
                        )
                      ) : null}
                      {!message.id.startsWith("temp-") ? (
                        <div className={styles.reactionRow}>
                          {QUICK_REACTIONS.map((emoji) => {
                            const reaction = reactionEntries.find((entry) => entry.emoji === emoji);
                            const count = Number(reaction?.count || 0);
                            const reacted = Boolean(reaction?.reacted);
                            const actionKey = `${message.id}:${emoji}`;
                            return (
                              <button
                                key={`${message.id}-${emoji}`}
                                className={`${styles.reactionButton} ${reacted ? styles.reactionButtonActive : ""}`}
                                type="button"
                                onClick={() => {
                                  void toggleReaction(message.id, emoji);
                                }}
                                disabled={isDeleted || reactingMessageKey === actionKey}
                              >
                                <span>{emoji}</span>
                                {count > 0 ? <span>{count}</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {!message.id.startsWith("temp-") ? (
                        <button
                          className={styles.inlineAction}
                          type="button"
                          onClick={() => {
                            setReplyingToMessage(toReplyPreview(message));
                          }}
                          disabled={!canReplyMessages}
                        >
                          Reply
                        </button>
                      ) : null}
                      {!message.id.startsWith("temp-") ? (
                        <button
                          className={styles.inlineAction}
                          type="button"
                          onClick={() => {
                            startForwardMessage(message);
                          }}
                          disabled={isDeleted || forwardingMessage}
                        >
                          Forward
                        </button>
                      ) : null}
                      {!message.id.startsWith("temp-") ? (
                        <button
                          className={styles.inlineAction}
                          type="button"
                          onClick={() => {
                            void copyMessageLink(message.id);
                          }}
                        >
                          Copy link
                        </button>
                      ) : null}
                      {canOpenThread ? (
                        <button
                          className={styles.inlineAction}
                          type="button"
                          onClick={() => {
                            openThreadForMessage(message);
                          }}
                        >
                          {threadRootMessageId === threadRootForMessage
                            ? "Thread open"
                            : visibleReplyCount > 0
                            ? `${visibleReplyCount} ${visibleReplyCount === 1 ? "reply" : "replies"}`
                            : "Open thread"}
                        </button>
                      ) : null}
                      {!message.id.startsWith("temp-") ? (
                        <button
                          className={styles.inlineAction}
                          type="button"
                          onClick={() => {
                            void toggleSaved(message);
                          }}
                          disabled={savingMessageId === message.id}
                        >
                          {savingMessageId === message.id
                            ? "Saving..."
                            : isSavedMessage
                            ? "Saved"
                            : "Save"}
                        </button>
                      ) : null}
                      {!isSelf && !isDeleted && !message.id.startsWith("temp-") ? (
                        <button
                          className={styles.inlineAction}
                          type="button"
                          onClick={() => {
                            void reportMessage(message.id);
                          }}
                          disabled={reportingMessageId === message.id}
                        >
                          {reportingMessageId === message.id ? "Reporting..." : "Report"}
                        </button>
                      ) : null}
                      {canTogglePin ? (
                        <button
                          className={styles.inlineAction}
                          type="button"
                          onClick={() => {
                            void toggleMessagePin(message.id, !Boolean(message.pinned_at));
                          }}
                          disabled={pinningMessageId === message.id}
                        >
                          {pinningMessageId === message.id
                            ? "Saving..."
                            : message.pinned_at
                            ? "Unpin"
                          : "Pin"}
                      </button>
                    ) : null}
                      {isSelf && !message.id.startsWith("temp-") ? (
                        <div className={styles.messageActions}>
                          {!isDeleted ? (
                            <button
                              className={styles.inlineAction}
                              type="button"
                              onClick={() => {
                                setEditingMessageId(message.id);
                                setEditingBody(message.body || "");
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          {!isDeleted ? (
                            <button
                              className={styles.inlineAction}
                              type="button"
                              onClick={() => {
                                void deleteMessage(message.id);
                              }}
                              disabled={deletingMessageId === message.id}
                            >
                              {deletingMessageId === message.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.messageMeta}>
                      <span>{isSelf ? "You" : message.sender_name || "Participant"}</span>
                      <span>{formatTime(message.created_at)}</span>
                      {message.deleted_at ? <span>Deleted</span> : null}
                      {message.edited_at && !message.deleted_at ? <span>Edited</span> : null}
                      {isSelf && deliveryState ? (
                        <span
                          className={`${styles.deliveryState} ${
                            deliveryState === "failed" ? styles.deliveryStateFailed : ""
                          }`}
                        >
                          {deliveryState === "sending"
                            ? "Sending..."
                            : deliveryState === "failed"
                            ? "Failed"
                            : deliveryState === "sent"
                            ? "Sent"
                            : deliveryState === "delivered"
                            ? "Delivered"
                            : "Read"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {threadRootMessageId ? (
            <div className={styles.threadPanel}>
              <div className={styles.threadPanelHeader}>
                <strong>Thread</strong>
                <div className={styles.threadPanelActions}>
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      void jumpToMessageById(threadRootMessageId);
                    }}
                  >
                    Jump to root
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      setThreadRootMessageId(null);
                      setThreadMessages([]);
                      setLoadingThread(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
              {loadingThread ? <p className={styles.status}>Loading thread...</p> : null}
              {!loadingThread && threadMessages.length === 0 ? (
                <p className={styles.status}>No thread messages available.</p>
              ) : null}
              {!loadingThread && threadMessages.length > 0 ? (
                <div className={styles.threadPanelList}>
                  {threadMessages.map((threadMessage) => {
                    const isThreadSelf = threadMessage.sender_id === session?.user.id;
                    const isThreadDeleted = Boolean(threadMessage.deleted_at);
                    const depth = Math.max(0, Number(threadMessage.thread_depth || 0));
                    const depthOffset = Math.min(depth, 4) * 14;
                    const replyCount = Number(threadReplyCountByParentId.get(threadMessage.id) || 0);
                    return (
                      <div
                        key={threadMessage.id}
                        className={styles.threadPanelItem}
                        style={{ marginLeft: depthOffset > 0 ? `${depthOffset}px` : undefined }}
                      >
                        <div className={styles.threadPanelMeta}>
                          <strong>{isThreadSelf ? "You" : threadMessage.sender_name || "Participant"}</strong>
                          <span>{formatDateTime(threadMessage.created_at)}</span>
                        </div>
                        {threadMessage.reply_to ? (
                          <button
                            type="button"
                            className={styles.replyPreview}
                            onClick={() => {
                              if (!threadMessage.reply_to) return;
                              void jumpToMessageById(threadMessage.reply_to.id);
                            }}
                          >
                            <strong>
                              {threadMessage.reply_to.sender_id === session?.user.id
                                ? "You"
                                : threadMessage.reply_to.sender_name}
                            </strong>
                            <span>{summarizeReplyPreview(threadMessage.reply_to)}</span>
                          </button>
                        ) : null}
                        {threadMessage.body ? (
                          <p className={`${styles.messageText} ${isThreadDeleted ? styles.messageTextDeleted : ""}`}>
                            {renderMessageText(threadMessage.body)}
                          </p>
                        ) : null}
                        {!isThreadDeleted && (threadMessage.attachments || []).length ? (
                          <p className={styles.threadAttachmentSummary}>
                            {(threadMessage.attachments || []).length}{" "}
                            {(threadMessage.attachments || []).length === 1 ? "attachment" : "attachments"}
                          </p>
                        ) : null}
                        {isThreadDeleted ? <p className={styles.messageTextDeleted}>Message deleted</p> : null}
                        <div className={styles.threadPanelActionsRow}>
                          <button
                            className={styles.inlineAction}
                            type="button"
                            onClick={() => {
                              setReplyingToMessage(toReplyPreview(threadMessage));
                            }}
                            disabled={!canReplyMessages || isThreadDeleted}
                          >
                            Reply
                          </button>
                          <button
                            className={styles.inlineAction}
                            type="button"
                            onClick={() => {
                              void jumpToMessageById(threadMessage.id);
                            }}
                          >
                            Jump
                          </button>
                          {replyCount > 0 ? (
                            <span className={styles.threadReplyPill}>
                              {replyCount} {replyCount === 1 ? "reply" : "replies"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {forwardingMessageId ? (
            <div className={styles.forwardPanel}>
              <div className={styles.forwardHeader}>
                <strong>Forward message</strong>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setForwardingMessageId(null);
                    setForwardTargetConversationId("");
                    setForwardNote("");
                    setForwardingMessage(false);
                  }}
                >
                  Cancel
                </button>
              </div>
              <p className={styles.forwardSourcePreview}>
                {forwardingSourceMessage
                  ? forwardingSourceMessage.body?.trim() || summarizeMessage(forwardingSourceMessage)
                  : "Selected message"}
              </p>
              <label className={styles.field}>
                Send to conversation
                <select
                  value={forwardTargetConversationId}
                  onChange={(event) => setForwardTargetConversationId(event.target.value)}
                  disabled={forwardingMessage}
                >
                  <option value="" disabled>
                    Select conversation
                  </option>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversation.name} ({conversation.type})
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Note (optional)
                <textarea
                  value={forwardNote}
                  onChange={(event) => setForwardNote(event.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder="Add context for this forward"
                  disabled={forwardingMessage}
                />
              </label>
              <div className={styles.forwardActions}>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void submitForwardMessage();
                  }}
                  disabled={!forwardTargetConversationId || forwardingMessage}
                >
                  {forwardingMessage ? "Forwarding..." : "Forward"}
                </button>
              </div>
            </div>
          ) : null}

          {replyingToMessage ? (
            <div className={styles.replyComposerBanner}>
              <div>
                <strong>
                  Replying to{" "}
                  {replyingToMessage.sender_id === session?.user.id ? "yourself" : replyingToMessage.sender_name}
                </strong>
                <p>{summarizeReplyPreview(replyingToMessage)}</p>
              </div>
              <button
                className="button"
                type="button"
                onClick={() => {
                  setReplyingToMessage(null);
                }}
              >
                Cancel
              </button>
            </div>
          ) : null}

          {selectedFiles.length ? (
            <div className={styles.pendingFiles}>
              <div className={styles.pendingFilesHeader}>
                <strong>
                  Pending attachments ({selectedFiles.length}/{MAX_FILES_PER_MESSAGE})
                </strong>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    clearPendingFiles();
                  }}
                >
                  Clear all
                </button>
              </div>
              <p className={styles.pendingFilesMeta}>
                {formatBytes(pendingAttachmentBytes)} staged
                {attachmentQuota && pendingAttachmentRemainderBytes !== null
                  ? ` - ${formatBytes(pendingAttachmentRemainderBytes)} remaining after send`
                  : ""}
              </p>
              {selectedFiles.map((file, idx) => (
                <div key={`${file.name}-${file.size}-${idx}`} className={styles.pendingFileChip}>
                  <span>
                    {file.name} - {formatBytes(file.size)}
                  </span>
                  <button type="button" onClick={() => removePendingFile(idx)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {isRecordingVoice ? (
            <p className={styles.recordingNotice}>Recording voice note... {recordingElapsedSeconds}s</p>
          ) : null}

          {failedSends.length ? (
            <div className={styles.retryQueue}>
              <div className={styles.retryHeader}>
                <strong>Retry queue</strong>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void retryAllFailedSends();
                  }}
                  disabled={retryingFailedId !== null}
                >
                  Retry all
                </button>
              </div>
              <div className={styles.retryList}>
                {failedSends.map((item) => (
                  <div key={item.id} className={styles.retryItem}>
                    <div>
                      <strong>{item.conversationName}</strong>
                      <p>{item.body || `${item.files.length} attachment(s)`}</p>
                      <p>
                        Attempts: {item.attempts} {item.lastError ? `- ${item.lastError}` : ""}
                      </p>
                    </div>
                    <div className={styles.retryActions}>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void retryFailedSend(item);
                        }}
                        disabled={retryingFailedId === item.id}
                      >
                        {retryingFailedId === item.id ? "Retrying..." : "Retry"}
                      </button>
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          setFailedSends((prev) => prev.filter((queued) => queued.id !== item.id));
                        }}
                        disabled={retryingFailedId === item.id}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeConversation ? (
            <div className={styles.quickReplyRow}>
              {QUICK_REPLY_TEMPLATES.map((template) => (
                <button
                  key={template}
                  className={styles.quickReplyChip}
                  type="button"
                  onClick={() => {
                    setComposer(template);
                    composerInputRef.current?.focus();
                  }}
                  disabled={sending || settings?.blocked || channelArchived || viewerLocked}
                >
                  {template}
                </button>
              ))}
            </div>
          ) : null}

          <ComposerPanel>
            <form
              ref={composerFormRef}
              className={`${styles.composer} ${isDragActive ? styles.composerDropActive : ""}`}
              onSubmit={handleSendMessage}
              onDragOver={handleComposerDragOver}
              onDragLeave={handleComposerDragLeave}
              onDrop={handleComposerDrop}
            >
              <input
                ref={composerInputRef}
                type="text"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                maxLength={MAX_MESSAGE_BODY_LENGTH}
                placeholder={
                  !activeConversation
                    ? "Select a conversation"
                    : settings?.blocked
                    ? "Conversation blocked"
                    : channelArchived
                    ? "This channel is archived (read-only)"
                    : viewerLocked
                    ? "Viewer role cannot post in this channel"
                    : "Type a message..."
                }
                disabled={!activeConversation || settings?.blocked || channelArchived || viewerLocked || sending}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={styles.hiddenInput}
                accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                onChange={handleFileSelection}
              />
              <button
                className="button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  !activeConversation ||
                  settings?.blocked ||
                  channelArchived ||
                  viewerLocked ||
                  sending ||
                  isRecordingVoice ||
                  attachmentQuotaExhausted
                }
              >
                Attach
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  void toggleVoiceRecording();
                }}
                disabled={
                  !activeConversation ||
                  settings?.blocked ||
                  channelArchived ||
                  viewerLocked ||
                  sending ||
                  attachmentQuotaExhausted
                }
              >
                {isRecordingVoice ? "Stop voice" : "Voice"}
              </button>
              <button className="button" type="submit" disabled={!canSend}>
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
            <p
              className={`${styles.charCounter} ${
                composer.length > MAX_MESSAGE_BODY_LENGTH - 200 ? styles.charCounterWarn : ""
              }`}
            >
              {composer.length}/{MAX_MESSAGE_BODY_LENGTH}
            </p>
          </ComposerPanel>
          </section>
        </ThreadViewPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageClient />
    </Suspense>
  );
}
