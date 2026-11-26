import { randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  addParticipant,
  archiveConversation,
  countUnreadAssignmentReminderNotifications,
  createMessageActivityEvent,
  countUnreadMentionNotifications,
  countConversationParticipantsByRole,
  createConversation,
  createMessageAttachment,
  createMessage,
  createMessageReport,
  editMessageBody,
  findDirectConversationBetweenUsers,
  getConversationById,
  getConversationDetailsById,
  getConversationParticipantRole,
  getMessageAttachmentById,
  getConversationSettings,
  getFirstUnreadMessageId,
  getDirectConversationPeerUserId,
  getMessageById,
  getParticipantIds,
  isParticipant,
  removeParticipant,
  listConversationActivityEvents,
  listAssignmentReminderNotifications,
  listFollowedUsers,
  listMessagesAround,
  listThreadMessages,
  listMentionNotifications,
  listInteractedUsers,
  getWeeklyMessagingSnapshot,
  listConversationParticipants,
  listConversationPresence,
  listConversationVisibilitySettings,
  listConversationsForUser,
  listSavedMessagesForUser,
  listPinnedMessages,
  listMessages,
  markConversationMessagesRead,
  markAllAssignmentReminderNotificationsRead,
  markAssignmentReminderNotificationRead,
  pinMessage,
  resolveMentionTargets,
  searchConversationMessages,
  softDeleteMessage,
  toggleSavedMessage,
  toggleMessageReaction,
  touchConversationPresence,
  unarchiveConversation,
  unpinMessage,
  updateChannelConversationDetails,
  updateConversationParticipantRole,
  upsertConversationSettings,
  type MessageAttachmentKind,
  type MessageAttachmentRecord,
  type ConversationParticipantRole,
} from "../db/messages.js";
import { initMessageBus, onMessage, publishEvent, publishMessage } from "../lib/messageBus.js";
import { detectOffPlatform } from "../lib/off-platform.js";
import { addTrustEvent, addTutorStrike, listTrustEvents } from "../db/policies.js";
import { getTutorByUserId } from "../db/tutors.js";
import { recomputeTutorRankingSnapshot } from "../db/tutor-ranking.js";
import { findUserById } from "../db/users.js";
import { hasBlockedRelationship, setUserRelationship, userAllowsMessages } from "../db/profile.js";
import {
  addTrustEventNote,
  completeMessageUploadSession,
  createChannelAssessment,
  createChannelTask,
  createMessageUploadSession,
  createUserSuspension,
  getConversationAttachmentQuota,
  getConversationAttachmentUsage,
  getMessageUploadSession,
  getTrustEventById,
  listChannelAssessments,
  listChannelTasks,
  listTrustEventNotes,
  revokeActiveUserSuspensions,
  setMessageUploadSessionStatus,
  setTrustEventWorkflow,
  submitChannelAssessmentAttempt,
  upsertConversationAttachmentQuota,
  updateChannelTask,
  updateMessageUploadSessionProgress,
} from "../db/platform.js";
import { clearDashboardSummaryCache } from "../lib/dashboard-summary.js";
import {
  clearSocialDiscoveryCache,
  getSocialDiscoveryCacheEntry,
  setSocialDiscoveryCacheEntry,
} from "../lib/social-discovery-cache.js";

const MESSAGE_ATTACHMENTS_ROOT = fileURLToPath(new URL("../../uploads/message-attachments", import.meta.url));
const MESSAGE_UPLOAD_SESSIONS_ROOT = fileURLToPath(new URL("../../uploads/message-upload-sessions", import.meta.url));
const MAX_FILES_PER_MESSAGE = 4;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const DIRECT_CONVERSATION_DEFAULT_NAME = "Direct conversation";
const MESSAGE_POST_RATE_LIMIT = { max: 20, timeWindow: "1 minute" } as const;
const MESSAGE_ATTACHMENT_RATE_LIMIT = { max: 8, timeWindow: "1 minute" } as const;
const MESSAGE_FORWARD_RATE_LIMIT = { max: 20, timeWindow: "1 minute" } as const;
const MESSAGE_REPORT_RATE_LIMIT = { max: 12, timeWindow: "1 minute" } as const;
const USER_REPORT_RATE_LIMIT = { max: 8, timeWindow: "1 minute" } as const;
const MESSAGE_TYPING_RATE_LIMIT = { max: 90, timeWindow: "1 minute" } as const;

const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

const allowedDocumentExtensions = new Set([
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
]);

const blockedAttachmentExtensions = new Set([".exe", ".bat", ".cmd", ".ps1", ".scr", ".vbs", ".js"]);

function scanAttachmentPayload(input: { fileName: string; mimeType: string; buffer: Buffer }) {
  const lowerName = input.fileName.toLowerCase();
  const ext = path.extname(lowerName);
  if (blockedAttachmentExtensions.has(ext)) {
    return {
      status: "blocked" as const,
      reason: `Blocked executable extension ${ext}`,
    };
  }
  const head = input.buffer.slice(0, 4096).toString("utf8").toLowerCase();
  if (head.includes("<script") || head.includes("powershell")) {
    return {
      status: "blocked" as const,
      reason: "Suspicious script content detected",
    };
  }
  if (input.mimeType.startsWith("application/x-msdownload")) {
    return {
      status: "blocked" as const,
      reason: "Executable MIME type not allowed",
    };
  }
  return {
    status: "clean" as const,
    reason: null,
  };
}

type MessageSearchFilters = {
  text: string;
  fromUserId: string | null;
  hasFiles: boolean | null;
  beforeIso: string | null;
  afterIso: string | null;
};

function parseMessageSearchFilters(raw: string): MessageSearchFilters {
  const tokens = raw
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  let fromUserId: string | null = null;
  let hasFiles: boolean | null = null;
  let beforeIso: string | null = null;
  let afterIso: string | null = null;
  const textTokens: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("from:")) {
      const value = token.slice("from:".length).trim();
      if (/^[0-9a-f-]{36}$/i.test(value)) fromUserId = value;
      continue;
    }
    if (token === "has:file" || token === "has:files" || token === "has:attachment") {
      hasFiles = true;
      continue;
    }
    if (token.startsWith("before:")) {
      const value = token.slice("before:".length).trim();
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) beforeIso = new Date(parsed).toISOString();
      continue;
    }
    if (token.startsWith("after:")) {
      const value = token.slice("after:".length).trim();
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) afterIso = new Date(parsed).toISOString();
      continue;
    }
    textTokens.push(token);
  }

  return {
    text: textTokens.join(" ").trim(),
    fromUserId,
    hasFiles,
    beforeIso,
    afterIso,
  };
}

const assignmentTemplatePayloadSchema = z.object({
  templateId: z.string().min(2).max(80),
  checklist: z.array(z.string().min(1).max(160)).max(20).optional(),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1).max(140),
        dueAt: z.string().datetime({ offset: true }).optional(),
      })
    )
    .max(16)
    .optional(),
  rubric: z
    .array(
      z.object({
        criterion: z.string().min(1).max(140),
        description: z.string().max(300).optional(),
        weight: z.number().min(0).max(100).optional(),
      })
    )
    .max(16)
    .optional(),
});

const assignmentTemplateSchema = assignmentTemplatePayloadSchema.optional();

const updateChannelDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    assignmentTitle: z.string().trim().min(1).max(140).optional(),
    assignmentDescription: z.string().max(2000).nullable().optional(),
    assignmentDueAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
    assignmentTemplate: assignmentTemplatePayloadSchema.nullable().optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.assignmentTitle !== undefined ||
      payload.assignmentDescription !== undefined ||
      payload.assignmentDueAt !== undefined ||
      payload.assignmentTemplate !== undefined,
    { message: "At least one channel detail must be provided." }
  );

const createConversationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["group", "direct", "channel"]).default("group"),
  participantIds: z.array(z.string().uuid()).optional(),
  assignmentTitle: z.string().min(1).max(140).optional(),
  assignmentDescription: z.string().max(2000).optional(),
  assignmentDueAt: z.string().datetime({ offset: true }).optional(),
  assignmentTemplate: assignmentTemplateSchema,
});

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
  replyToMessageId: z.string().uuid().optional(),
});

const editMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

const messageReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});

const forwardMessageSchema = z.object({
  targetConversationId: z.string().uuid(),
  note: z.string().max(800).optional(),
});

const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().datetime({ offset: true }).optional(),
});

const messageContextQuerySchema = z.object({
  messageId: z.string().uuid(),
  before: z.coerce.number().int().min(0).max(100).optional(),
  after: z.coerce.number().int().min(0).max(120).optional(),
});

const threadMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const searchMessagesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const pinnedMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const typingSchema = z.object({
  isTyping: z.boolean(),
});

const readSchema = z.object({
  readAt: z.string().datetime({ offset: true }).optional(),
});

const settingsSchema = z.object({
  muteMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30).optional(),
  blocked: z.boolean().optional(),
  mentionNotifications: z.boolean().optional(),
  assignmentReminderMode: z.enum(["off", "72h", "24h"]).optional(),
  assignmentReminderSnoozeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30).optional(),
  assignmentOverdueRepeatHours: z.coerce.number().int().min(6).max(168).optional(),
  channelEventNotifications: z.boolean().optional(),
  messageUpdateNotifications: z.boolean().optional(),
  sharePresence: z.boolean().optional(),
  shareTyping: z.boolean().optional(),
  shareReadReceipts: z.boolean().optional(),
});

const reportMessageSchema = z.object({
  reason: z.string().min(3).max(400),
});

const reportUserParamsSchema = z.object({
  id: z.string().uuid(),
});

const reportUserSchema = z.object({
  reason: z.string().min(3).max(400),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
});

const followedSearchQuerySchema = z.object({
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

const interactedUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  q: z.string().max(80).optional(),
});

const mentionNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

const assignmentReminderNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

const weeklySnapshotQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(30).optional(),
});

const moderationFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(["off_platform_attempt", "fraud_flag", "abuse"]).optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["new", "in_review", "resolved"]).optional(),
});

const moderationActionParamsSchema = z.object({
  id: z.string().uuid(),
});

const moderationAssignSchema = z.object({
  assignedAdminId: z.string().uuid().optional(),
  note: z.string().trim().min(1).max(1000).optional(),
});

const moderationNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

const moderationActionSchema = z.object({
  action: z.enum(["warn", "mute", "suspend", "dismiss", "resolve", "reopen"]),
  targetUserId: z.string().uuid().optional(),
  note: z.string().trim().min(1).max(2000).optional(),
  suspendHours: z.coerce.number().int().min(1).max(24 * 365).optional(),
});

const attachmentQuotaSchema = z.object({
  maxBytes: z.coerce.number().int().min(1_000_000).max(5_000_000_000),
  retentionDays: z.coerce.number().int().min(1).max(365),
});

const uploadSessionCreateSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
  mimeType: z.string().trim().min(1).max(200),
  totalBytes: z.coerce.number().int().min(1).max(200 * 1024 * 1024),
});

const uploadSessionChunkSchema = z.object({
  chunkBase64: z.string().min(1),
});

const uploadSessionCompleteSchema = z.object({
  body: z.string().trim().max(2000).optional(),
  replyToMessageId: z.string().uuid().optional(),
  durationSeconds: z.coerce.number().int().min(1).max(3600).optional(),
});

const channelTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional(),
  assigneeId: z.string().uuid().optional(),
  linkedMessageId: z.string().uuid().optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
});

const channelItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const channelTaskUpdateSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(4000).optional(),
  dueAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
});

const channelTaskParamsSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
});

const channelAssessmentBodySchema = z.object({
  title: z.string().trim().min(1).max(240),
  instructions: z.string().trim().max(5000).optional(),
  questions: z.array(z.record(z.unknown())).max(80).default([]),
  maxScore: z.coerce.number().min(1).max(1000).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
});

const channelAssessmentParamsSchema = z.object({
  id: z.string().uuid(),
  assessmentId: z.string().uuid(),
});

const channelAssessmentAttemptSchema = z.object({
  answers: z.record(z.unknown()).default({}),
  score: z.coerce.number().min(0).max(1000).optional(),
});

const savedMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const archiveConversationSchema = z.object({
  archived: z.boolean(),
});

const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const messageIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const directConversationParamsSchema = z.object({
  userId: z.string().uuid(),
});

const attachmentParamsSchema = z.object({
  id: z.string().uuid(),
});

const uploadSessionParamsSchema = z.object({
  id: z.string().uuid(),
  uploadId: z.string().uuid(),
});

const assignmentReminderNotificationParamsSchema = z.object({
  id: z.string().uuid(),
});

const participantRoleParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

const threadParamsSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
});

const participantRoleSchema = z.object({
  role: z.enum(["owner", "editor", "viewer"]),
});

const addParticipantSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "editor", "viewer"]).optional(),
});

type ParsedUpload = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: MessageAttachmentKind;
  buffer: Buffer;
};

type InteractedUsersCursorPayload = {
  offset: number;
};

type FollowedUsersCursorPayload = {
  offset: number;
};

function encodeFollowedUsersCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset } satisfies FollowedUsersCursorPayload), "utf8").toString(
    "base64url"
  );
}

function decodeFollowedUsersCursor(value?: string) {
  if (!value) return { offset: 0 };
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as FollowedUsersCursorPayload;
    if (!Number.isFinite(parsed.offset) || parsed.offset < 0) {
      return null;
    }
    return { offset: Math.floor(parsed.offset) };
  } catch {
    return null;
  }
}

function buildFollowedUsersSearchCacheKey(input: {
  userId: string;
  query: string;
  limit: number;
  offset: number;
  role: string;
}) {
  return `${input.userId}|following-search|${input.query.trim().toLowerCase()}|${input.limit}|${
    input.offset
  }|${input.role.trim().toLowerCase()}`;
}

function buildInteractedUsersCacheKey(input: {
  userId: string;
  query: string;
  limit: number;
  offset: number;
  role: string;
}) {
  return `${input.userId}|interactions|${input.query.trim().toLowerCase()}|${input.limit}|${input.offset}|${input.role
    .trim()
    .toLowerCase()}`;
}

function encodeInteractedUsersCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset } satisfies InteractedUsersCursorPayload), "utf8").toString(
    "base64url"
  );
}

function decodeInteractedUsersCursor(value?: string) {
  if (!value) return { offset: 0 };
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as InteractedUsersCursorPayload;
    if (!Number.isFinite(parsed.offset) || parsed.offset < 0) {
      return null;
    }
    return { offset: Math.floor(parsed.offset) };
  } catch {
    return null;
  }
}

function displayNameForUser(user: { first_name: string; last_name: string; email: string }) {
  const full = `${user.first_name} ${user.last_name}`.trim();
  return full || user.email || DIRECT_CONVERSATION_DEFAULT_NAME;
}

function normalizeIsoTimestamp(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function inferAttachmentKind(mimeType: string, filename: string): MessageAttachmentKind | null {
  const mime = mimeType.toLowerCase();
  const extension = path.extname(filename).toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  if (allowedDocumentMimeTypes.has(mime)) return "file";
  if ((mime === "application/octet-stream" || mime === "") && allowedDocumentExtensions.has(extension)) {
    return "file";
  }

  return null;
}

function sanitizeFilename(filename: string | undefined) {
  const fallback = "attachment";
  const value = filename?.trim() || fallback;
  const safe = value.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);
  return safe || fallback;
}

function extractMentionHandles(value: string) {
  const handles = new Set<string>();
  const matcher = /(^|[\s([{.,!?;:])@([a-zA-Z0-9._-]{2,24})/g;
  let match: RegExpExecArray | null = matcher.exec(value);
  while (match) {
    const handle = match[2]?.trim().toLowerCase();
    if (handle) handles.add(handle);
    match = matcher.exec(value);
  }
  return [...handles];
}

async function readPartBuffer(stream: AsyncIterable<Buffer>, maxBytes: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += piece.length;
    if (size > maxBytes) {
      throw new Error(`Attachment exceeds ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`);
    }
    chunks.push(piece);
  }
  return { buffer: Buffer.concat(chunks), size };
}

async function parseAttachmentPayload(request: FastifyRequest) {
  let rawBody = "";
  let durationSeconds: number | null = null;
  let replyToMessageId: string | null = null;
  const uploads: ParsedUpload[] = [];

  for await (const part of request.parts()) {
    if (part.type === "field") {
      if (part.fieldname === "body" && typeof part.value === "string") {
        rawBody = part.value;
      } else if (part.fieldname === "durationSeconds" && typeof part.value === "string") {
        const parsed = Number(part.value);
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= 3600) {
          durationSeconds = parsed;
        }
      } else if (part.fieldname === "replyToMessageId" && typeof part.value === "string") {
        const value = part.value.trim();
        replyToMessageId = value || null;
      }
      continue;
    }

    if (uploads.length >= MAX_FILES_PER_MESSAGE) {
      part.file.resume();
      throw new Error(`You can upload up to ${MAX_FILES_PER_MESSAGE} files per message.`);
    }

    const fileName = sanitizeFilename(part.filename);
    const mimeType = (part.mimetype || "application/octet-stream").toLowerCase();
    const kind = inferAttachmentKind(mimeType, fileName);
    if (!kind) {
      part.file.resume();
      throw new Error("Unsupported attachment type.");
    }

    const { buffer, size } = await readPartBuffer(part.file as AsyncIterable<Buffer>, MAX_ATTACHMENT_SIZE_BYTES);
    if (size <= 0) {
      throw new Error("Attachment is empty.");
    }

    uploads.push({
      fileName,
      mimeType,
      sizeBytes: size,
      kind,
      buffer,
    });
  }

  return {
    body: rawBody.trim(),
    durationSeconds,
    replyToMessageId,
    uploads,
  };
}

async function saveAttachmentFile(input: {
  conversationId: string;
  userId: string;
  filename: string;
  buffer: Buffer;
}) {
  const ext = path.extname(input.filename).toLowerCase();
  const safeExt = ext && /^[.a-z0-9]{1,10}$/.test(ext) ? ext : "";
  const generatedName = `${Date.now()}-${randomUUID()}${safeExt}`;
  const relativePath = path.posix.join(input.conversationId, input.userId, generatedName);
  const fullPath = path.join(MESSAGE_ATTACHMENTS_ROOT, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.buffer);
  return relativePath;
}

function resolveSafeStoragePath(rootDir: string, relativePath: string) {
  const rootPath = path.resolve(rootDir);
  const resolvedPath = path.resolve(rootDir, relativePath);
  if (!resolvedPath.startsWith(rootPath + path.sep) && resolvedPath !== rootPath) {
    throw new Error("Invalid storage path.");
  }
  return resolvedPath;
}

function decodeChunkPayload(chunkBase64: string) {
  const encoded = chunkBase64.includes(",") ? chunkBase64.split(",").slice(-1)[0] : chunkBase64;
  return Buffer.from(encoded, "base64");
}

async function getAttachmentQuotaState(conversationId: string) {
  const [quota, usage] = await Promise.all([
    getConversationAttachmentQuota(conversationId),
    getConversationAttachmentUsage(conversationId),
  ]);
  const usedBytes = Number(usage.total_bytes || 0);
  const maxBytes = Number(quota.max_bytes || 0);
  const remainingBytes = Math.max(0, maxBytes - usedBytes);
  return {
    quota,
    usage: {
      totalBytes: usedBytes,
      attachmentCount: Number(usage.attachment_count || 0),
    },
    remainingBytes,
  };
}

function attachmentResponseUrl(attachmentId: string) {
  return `/api/messages/attachments/${attachmentId}`;
}

async function applyOffPlatformPolicy(userId: string, rawBody: string) {
  const detection = detectOffPlatform(rawBody);
  if (!detection.flagged) {
    return detection;
  }

  await addTrustEvent({
    actorId: userId,
    sessionId: null,
    type: "off_platform_attempt",
    severity: detection.severity === "high" ? "high" : detection.severity === "medium" ? "medium" : "low",
    metadata: detection.matches,
  });

  const tutor = await getTutorByUserId(userId);
  if (tutor) {
    await addTutorStrike({
      tutorId: tutor.id,
      sessionId: null,
      reason: "fraud",
      points: detection.severity === "high" ? 2 : 1,
    });
    await recomputeTutorRankingSnapshot(tutor.id);
  }

  return detection;
}

function enrichAttachments(attachments: MessageAttachmentRecord[]) {
  return attachments.map((attachment) => ({
    ...attachment,
    url: attachmentResponseUrl(attachment.id),
  }));
}

async function requireConversationParticipant(
  conversationId: string,
  userId: string,
  reply: { code: (status: number) => { send: (body: unknown) => void } }
) {
  const allowed = await isParticipant(conversationId, userId);
  if (!allowed) {
    reply.code(403).send({ error: "Access denied" });
    return false;
  }
  return true;
}

async function ensureDirectPeerMessagingAllowed(
  conversationId: string,
  userId: string,
  reply: { code: (status: number) => { send: (body: unknown) => void } }
) {
  const directPeerId = await getDirectConversationPeerUserId(conversationId, userId);
  if (!directPeerId) return true;

  const blocked = await hasBlockedRelationship(userId, directPeerId);
  if (blocked) {
    reply.code(403).send({ error: "Messaging is not available for this user." });
    return false;
  }

  const allowsMessages = await userAllowsMessages(directPeerId);
  if (!allowsMessages) {
    reply.code(403).send({ error: "This user is not accepting direct messages right now." });
    return false;
  }

  return true;
}

async function ensureConversationCanPost(
  conversationId: string,
  userId: string,
  reply: { code: (status: number) => { send: (body: unknown) => void } }
) {
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    reply.code(404).send({ error: "Conversation not found." });
    return false;
  }
  if (conversation.type !== "channel") return true;
  if (conversation.archived_at) {
    reply.code(403).send({ error: "This channel is archived and read-only." });
    return false;
  }

  const role = await getConversationParticipantRole(conversationId, userId);
  if (!role) {
    reply.code(403).send({ error: "Access denied" });
    return false;
  }
  if (role === "viewer") {
    reply.code(403).send({ error: "Viewers cannot post messages in this channel." });
    return false;
  }
  return true;
}

async function requireChannelConversation(
  conversationId: string,
  reply: { code: (status: number) => { send: (body: unknown) => void } }
) {
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    reply.code(404).send({ error: "Conversation not found." });
    return null;
  }
  if (conversation.type !== "channel") {
    reply.code(400).send({ error: "This endpoint is only available for channel conversations." });
    return null;
  }
  return conversation;
}

async function resolveReplyTargetMessage(
  conversationId: string,
  replyToMessageId: string | undefined | null,
  reply: { code: (status: number) => { send: (body: unknown) => void } }
) {
  if (!replyToMessageId) return null;
  const parsed = z.string().uuid().safeParse(replyToMessageId);
  if (!parsed.success) {
    reply.code(400).send({ error: "Invalid reply target message id." });
    return undefined;
  }
  const target = await getMessageById(parsed.data);
  if (!target || target.conversation_id !== conversationId) {
    reply.code(404).send({ error: "Reply target not found in this conversation." });
    return undefined;
  }
  return target.id;
}

function composeForwardMessageBody(input: {
  sourceSenderName: string;
  sourceBody: string | null;
  note?: string;
}) {
  const rawNote = input.note?.trim() || "";
  const sourceSummary = input.sourceBody?.trim() || "[attachment message]";
  const base = `Forwarded from ${input.sourceSenderName}: ${sourceSummary}`;
  if (!rawNote) return base.slice(0, 2000);

  const joined = `${rawNote}\n\n${base}`;
  if (joined.length <= 2000) return joined;

  const maxBase = Math.max(2000 - rawNote.length - 2, 60);
  const truncatedBase = base.length > maxBase ? `${base.slice(0, maxBase - 3)}...` : base;
  const finalBody = `${rawNote}\n\n${truncatedBase}`;
  return finalBody.slice(0, 2000);
}

function getAssignmentTemplateId(template?: Record<string, unknown> | null) {
  return template && typeof template.templateId === "string" ? template.templateId : null;
}

function invalidateDashboardForUsers(userIds: Array<string | null | undefined>) {
  const unique = new Set(userIds.filter((value): value is string => Boolean(value)));
  for (const userId of unique) {
    clearDashboardSummaryCache({ userId });
  }
}

function invalidateSocialDiscoveryForUsers(userIds: Array<string | null | undefined>) {
  const unique = new Set(userIds.filter((value): value is string => Boolean(value)));
  for (const userId of unique) {
    clearSocialDiscoveryCache({ userId });
  }
}

function invalidateDashboardGlobally() {
  clearDashboardSummaryCache();
}

export async function registerMessageRoutes(app: FastifyInstance) {
  app.get("/admin/messages/moderation-feed", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = moderationFeedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }

    const events = await listTrustEvents({
      limit: parsed.data.limit ?? 40,
      type: parsed.data.type,
      severity: parsed.data.severity,
      status: parsed.data.status,
    });
    reply.send({ events });
  });

  app.post(
    "/admin/messages/moderation-feed/:id/assign",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsedParams = moderationActionParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid event id" });
        return;
      }
      const parsedBody = moderationAssignSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }
      const workflow = await setTrustEventWorkflow({
        eventId: parsedParams.data.id,
        assignedAdminId: parsedBody.data.assignedAdminId ?? request.user.sub,
        status: "in_review",
      });
      if (!workflow) {
        reply.code(404).send({ error: "Moderation event not found" });
        return;
      }
      await addTrustEventNote({
        trustEventId: parsedParams.data.id,
        adminId: request.user.sub,
        actionType: "assign",
        note: parsedBody.data.note?.trim() || "Assigned moderation event",
      });
      reply.send({ event: workflow });
    }
  );

  app.get(
    "/admin/messages/moderation-feed/:id/notes",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsedParams = moderationActionParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid event id" });
        return;
      }
      const notes = await listTrustEventNotes(parsedParams.data.id, 200);
      reply.send({ notes });
    }
  );

  app.post(
    "/admin/messages/moderation-feed/:id/notes",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsedParams = moderationActionParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid event id" });
        return;
      }
      const parsedBody = moderationNoteSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }
      const note = await addTrustEventNote({
        trustEventId: parsedParams.data.id,
        adminId: request.user.sub,
        actionType: "note",
        note: parsedBody.data.note,
      });
      if (!note) {
        reply.code(404).send({ error: "Moderation event not found" });
        return;
      }
      const workflow = await setTrustEventWorkflow({
        eventId: parsedParams.data.id,
        status: "in_review",
      });
      reply.send({ note, event: workflow });
    }
  );

  app.post(
    "/admin/messages/moderation-feed/:id/action",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsedParams = moderationActionParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid event id" });
        return;
      }
      const parsedBody = moderationActionSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const event = await getTrustEventById(parsedParams.data.id);
      if (!event) {
        reply.code(404).send({ error: "Moderation event not found" });
        return;
      }

      const targetUserId = parsedBody.data.targetUserId ?? event.actor_id;
      if (parsedBody.data.action === "mute") {
        const hours = Math.min(Math.max(parsedBody.data.suspendHours ?? 24, 1), 24 * 30);
        const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        await createUserSuspension({
          userId: targetUserId,
          reason: parsedBody.data.note?.trim() || "Muted by moderation action",
          suspendedBy: request.user.sub,
          endsAt,
        });
      } else if (parsedBody.data.action === "suspend") {
        const hours = Math.min(Math.max(parsedBody.data.suspendHours ?? 24 * 7, 1), 24 * 365);
        const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        await createUserSuspension({
          userId: targetUserId,
          reason: parsedBody.data.note?.trim() || "Suspended by moderation action",
          suspendedBy: request.user.sub,
          endsAt,
        });
      } else if (parsedBody.data.action === "warn") {
        await addTrustEvent({
          actorId: targetUserId,
          sessionId: null,
          type: "abuse",
          severity: "low",
          metadata: {
            source: "moderation_warning",
            trustEventId: event.id,
            moderatorId: request.user.sub,
          },
        });
      } else if (parsedBody.data.action === "dismiss") {
        await revokeActiveUserSuspensions(targetUserId);
      } else if (parsedBody.data.action === "resolve") {
        await revokeActiveUserSuspensions(targetUserId);
      } else if (parsedBody.data.action === "reopen") {
        // no-op for user state
      }

      if (parsedBody.data.action === "mute") {
        await setUserRelationship(request.user.sub, targetUserId, "muted");
      }

      const status: "new" | "in_review" | "resolved" =
        parsedBody.data.action === "resolve" || parsedBody.data.action === "dismiss"
          ? "resolved"
          : parsedBody.data.action === "reopen"
          ? "new"
          : "in_review";
      const workflow = await setTrustEventWorkflow({
        eventId: event.id,
        status,
        assignedAdminId: request.user.sub,
        resolved: status === "resolved",
      });
      const note = await addTrustEventNote({
        trustEventId: event.id,
        adminId: request.user.sub,
        actionType:
          parsedBody.data.action === "resolve" || parsedBody.data.action === "reopen"
            ? "status_change"
            : (parsedBody.data.action as "warn" | "mute" | "suspend" | "dismiss"),
        note:
          parsedBody.data.note?.trim() ||
          `Moderation action applied: ${parsedBody.data.action}`,
      });

      reply.send({ event: workflow, note });
    }
  );

  app.get("/messages/conversations", { preHandler: requireAuth }, async (request, reply) => {
    const conversations = await listConversationsForUser(request.user.sub);
    reply.send({ conversations });
  });

  app.post("/messages/conversations", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createConversationSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.type === "channel" && !parsed.data.assignmentTitle?.trim()) {
      reply.code(400).send({ error: "Channel assignment title is required." });
      return;
    }

    const participantIds = new Set(parsed.data.participantIds || []);
    participantIds.add(request.user.sub);
    if (parsed.data.type === "direct" && participantIds.size !== 2) {
      reply.code(400).send({ error: "Direct conversations require exactly one other participant." });
      return;
    }
    if (parsed.data.type === "direct") {
      const peerUserId = [...participantIds].find((id) => id !== request.user.sub);
      if (!peerUserId) {
        reply.code(400).send({ error: "Direct conversations require exactly one other participant." });
        return;
      }
      const blocked = await hasBlockedRelationship(request.user.sub, peerUserId);
      if (blocked) {
        reply.code(403).send({ error: "Messaging is not available for this user." });
        return;
      }
      const allowsMessages = await userAllowsMessages(peerUserId);
      if (!allowsMessages) {
        reply.code(403).send({ error: "This user is not accepting direct messages right now." });
        return;
      }
    }

    const conversation = await createConversation(parsed.data.name.trim(), parsed.data.type, [...participantIds], {
      assignmentTitle: parsed.data.assignmentTitle?.trim() || null,
      assignmentDescription: parsed.data.assignmentDescription?.trim() || null,
      assignmentDueAt: parsed.data.assignmentDueAt ?? null,
      assignmentTemplate: parsed.data.assignmentTemplate ?? null,
      createdByUserId: request.user.sub,
    });
    reply.code(201).send({ conversation });
  });

  app.get("/messages/following/search", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = followedSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }
    const cursor = decodeFollowedUsersCursor(parsed.data.cursor);
    if (!cursor) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }
    const limit = parsed.data.limit ?? 20;
    const query = parsed.data.q ?? "";
    const role = request.user.role || "learner";
    const cacheKey = buildFollowedUsersSearchCacheKey({
      userId: request.user.sub,
      query,
      limit,
      offset: cursor.offset,
      role,
    });
    const cached = getSocialDiscoveryCacheEntry<{
      users: Awaited<ReturnType<typeof listFollowedUsers>>;
      hasMore: boolean;
      nextCursor: string | null;
    }>(cacheKey);
    if (cached) {
      reply.header("X-Social-Discovery-Cache", "hit");
      reply.send(cached.payload);
      return;
    }

    const rows = await listFollowedUsers(request.user.sub, query, limit + 1, cursor.offset, role);
    const hasMore = rows.length > limit;
    const users = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeFollowedUsersCursor(cursor.offset + users.length) : null;
    const payload = { users, hasMore, nextCursor };
    setSocialDiscoveryCacheEntry(cacheKey, payload);
    reply.header("X-Social-Discovery-Cache", "miss");
    reply.send(payload);
  });

  app.get("/messages/interactions", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = interactedUsersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }
    const cursor = decodeInteractedUsersCursor(parsed.data.cursor);
    if (!cursor) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }
    const limit = parsed.data.limit ?? 50;
    const query = parsed.data.q ?? "";
    const role = request.user.role || "learner";
    const cacheKey = buildInteractedUsersCacheKey({
      userId: request.user.sub,
      query,
      limit,
      offset: cursor.offset,
      role,
    });
    const cached = getSocialDiscoveryCacheEntry<{
      users: Awaited<ReturnType<typeof listInteractedUsers>>;
      hasMore: boolean;
      nextCursor: string | null;
    }>(cacheKey);
    if (cached) {
      reply.header("X-Social-Discovery-Cache", "hit");
      reply.send(cached.payload);
      return;
    }

    const rows = await listInteractedUsers(request.user.sub, limit + 1, cursor.offset, query, role);
    const hasMore = rows.length > limit;
    const users = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeInteractedUsersCursor(cursor.offset + users.length) : null;
    const payload = { users, hasMore, nextCursor };
    setSocialDiscoveryCacheEntry(cacheKey, payload);
    reply.header("X-Social-Discovery-Cache", "miss");
    reply.send(payload);
  });

  app.get("/messages/weekly-snapshot", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = weeklySnapshotQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }

    const windowDays = parsed.data.windowDays ?? 7;
    const [snapshot, unreadMentions, unreadAssignmentReminders, conversations] = await Promise.all([
      getWeeklyMessagingSnapshot(request.user.sub, { windowDays }),
      countUnreadMentionNotifications(request.user.sub),
      countUnreadAssignmentReminderNotifications(request.user.sub),
      listConversationsForUser(request.user.sub),
    ]);

    const unreadConversations = conversations.reduce(
      (total, conversation) => total + (Number(conversation.unread_count || 0) > 0 ? 1 : 0),
      0
    );

    reply.send({
      snapshot: {
        windowDays: snapshot.window_days,
        windowStart: snapshot.window_start,
        windowEnd: snapshot.window_end,
        sentMessages: snapshot.sent_messages,
        receivedMessages: snapshot.received_messages,
        activeConversations: snapshot.active_conversations,
        activeDirectConversations: snapshot.active_direct_conversations,
        activeGroupConversations: snapshot.active_group_conversations,
        activeChannelConversations: snapshot.active_channel_conversations,
        collaboratorCount: snapshot.collaborator_count,
        dueSoonChannels: snapshot.due_soon_channels,
        overdueChannels: snapshot.overdue_channels,
        unreadMentions,
        unreadAssignmentReminders,
        unreadConversations,
      },
    });
  });

  app.get("/messages/mentions", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = mentionNotificationsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }

    const [mentions, unreadCount] = await Promise.all([
      listMentionNotifications(request.user.sub, {
        limit: parsed.data.limit ?? 20,
        unreadOnly: parsed.data.unreadOnly ?? false,
      }),
      countUnreadMentionNotifications(request.user.sub),
    ]);
    reply.send({ mentions, unreadCount });
  });

  app.get("/messages/assignment-reminders", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = assignmentReminderNotificationsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }

    const [reminders, unreadCount] = await Promise.all([
      listAssignmentReminderNotifications(request.user.sub, {
        limit: parsed.data.limit ?? 20,
        unreadOnly: parsed.data.unreadOnly ?? false,
      }),
      countUnreadAssignmentReminderNotifications(request.user.sub),
    ]);
    reply.send({ reminders, unreadCount });
  });

  app.get("/messages/saved", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = savedMessagesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }
    const messages = await listSavedMessagesForUser(request.user.sub, { limit: parsed.data.limit ?? 50 });
    reply.send({
      messages: messages.map((message) => ({
        ...message,
        attachments: enrichAttachments(message.attachments || []),
      })),
    });
  });

  app.post("/messages/assignment-reminders/read-all", { preHandler: requireAuth }, async (request, reply) => {
    const updatedCount = await markAllAssignmentReminderNotificationsRead(request.user.sub);
    invalidateDashboardForUsers([request.user.sub]);
    reply.send({ ok: true, updatedCount });
  });

  app.post("/messages/assignment-reminders/:id/read", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = assignmentReminderNotificationParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid reminder id." });
      return;
    }
    const updated = await markAssignmentReminderNotificationRead(request.user.sub, parsed.data.id);
    if (updated) {
      invalidateDashboardForUsers([request.user.sub]);
    }
    reply.send({ ok: true, updated });
  });

  app.get("/messages/conversations/:id/activity", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedQuery = activityQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query", details: parsedQuery.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const events = await listConversationActivityEvents(conversationId, {
      limit: parsedQuery.data.limit ?? 40,
    });
    reply.send({ events });
  });

  app.post("/messages/conversations/direct/:userId", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = directConversationParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid user id." });
      return;
    }

    if (parsed.data.userId === request.user.sub) {
      reply.code(400).send({ error: "You cannot start a direct conversation with yourself." });
      return;
    }

    const targetUser = await findUserById(parsed.data.userId);
    if (!targetUser) {
      reply.code(404).send({ error: "User not found." });
      return;
    }

    const blocked = await hasBlockedRelationship(request.user.sub, targetUser.id);
    if (blocked) {
      reply.code(403).send({ error: "Messaging is not available for this user." });
      return;
    }
    const allowsMessages = await userAllowsMessages(targetUser.id);
    if (!allowsMessages) {
      reply.code(403).send({ error: "This user is not accepting direct messages right now." });
      return;
    }

    const existing = await findDirectConversationBetweenUsers(request.user.sub, parsed.data.userId);
    if (existing) {
      reply.send({ conversation: existing, created: false });
      return;
    }

    const conversation = await createConversation(
      displayNameForUser(targetUser),
      "direct",
      [request.user.sub, parsed.data.userId],
      { createdByUserId: request.user.sub }
    );
    reply.code(201).send({ conversation, created: true });
  });

  app.get("/messages/conversations/:id/attachment-quota", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const state = await getAttachmentQuotaState(conversationId);
    reply.send({
      quota: state.quota,
      usage: state.usage,
      remainingBytes: state.remainingBytes,
    });
  });

  app.put("/messages/conversations/:id/attachment-quota", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedBody = attachmentQuotaSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const role = await getConversationParticipantRole(conversationId, request.user.sub);
    if (!role || role === "viewer") {
      reply.code(403).send({ error: "Only channel collaborators can update quota settings." });
      return;
    }

    const quota = await upsertConversationAttachmentQuota({
      conversationId,
      maxBytes: parsedBody.data.maxBytes,
      retentionDays: parsedBody.data.retentionDays,
      updatedBy: request.user.sub,
    });
    const usage = await getConversationAttachmentUsage(conversationId);
    reply.send({
      quota,
      usage: {
        totalBytes: Number(usage.total_bytes || 0),
        attachmentCount: Number(usage.attachment_count || 0),
      },
      remainingBytes: Math.max(0, Number(quota?.max_bytes || 0) - Number(usage.total_bytes || 0)),
    });
  });

  app.post("/messages/conversations/:id/upload-sessions", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedBody = uploadSessionCreateSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;
    const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
    if (!canPost) return;

    const kind = inferAttachmentKind(parsedBody.data.mimeType, parsedBody.data.fileName);
    if (!kind) {
      reply.code(400).send({ error: "Unsupported attachment type." });
      return;
    }
    const ext = path.extname(parsedBody.data.fileName).toLowerCase();
    if (blockedAttachmentExtensions.has(ext)) {
      reply.code(400).send({ error: "Blocked file type." });
      return;
    }

    const quotaState = await getAttachmentQuotaState(conversationId);
    if (quotaState.usage.totalBytes + parsedBody.data.totalBytes > Number(quotaState.quota.max_bytes || 0)) {
      reply.code(413).send({
        error: "Conversation attachment quota exceeded.",
        quota: quotaState.quota,
        usage: quotaState.usage,
        requestedBytes: parsedBody.data.totalBytes,
      });
      return;
    }

    const relativePath = path.posix.join(
      conversationId,
      request.user.sub,
      `${Date.now()}-${randomUUID()}.part`
    );
    const fullPath = resolveSafeStoragePath(MESSAGE_UPLOAD_SESSIONS_ROOT, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, Buffer.alloc(0));

    const session = await createMessageUploadSession({
      conversationId,
      userId: request.user.sub,
      fileName: sanitizeFilename(parsedBody.data.fileName),
      mimeType: parsedBody.data.mimeType.toLowerCase(),
      totalBytes: parsedBody.data.totalBytes,
      tempStoragePath: relativePath,
    });

    reply.code(201).send({
      session,
      kind,
      quota: quotaState.quota,
      usage: quotaState.usage,
      remainingBytes: Math.max(0, quotaState.remainingBytes - parsedBody.data.totalBytes),
    });
  });

  app.get(
    "/messages/conversations/:id/upload-sessions/:uploadId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = uploadSessionParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid upload session id." });
        return;
      }

      const allowed = await requireConversationParticipant(parsedParams.data.id, request.user.sub, reply);
      if (!allowed) return;

      const session = await getMessageUploadSession(parsedParams.data.uploadId);
      if (!session || session.conversation_id !== parsedParams.data.id) {
        reply.code(404).send({ error: "Upload session not found." });
        return;
      }
      if (session.user_id !== request.user.sub) {
        reply.code(403).send({ error: "Only the uploader can view this session." });
        return;
      }
      if (new Date(session.expires_at).getTime() <= Date.now() && session.status === "open") {
        const expired = await setMessageUploadSessionStatus({
          uploadId: session.id,
          status: "expired",
          uploadedBytes: Number(session.uploaded_bytes || 0),
        });
        reply.send({ session: expired ?? session });
        return;
      }
      reply.send({ session });
    }
  );

  app.put(
    "/messages/conversations/:id/upload-sessions/:uploadId/chunk",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = uploadSessionParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid upload session id." });
        return;
      }
      const parsedBody = uploadSessionChunkSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
      if (!canPost) return;

      const session = await getMessageUploadSession(parsedParams.data.uploadId);
      if (!session || session.conversation_id !== conversationId) {
        reply.code(404).send({ error: "Upload session not found." });
        return;
      }
      if (session.user_id !== request.user.sub) {
        reply.code(403).send({ error: "Only the uploader can append chunks." });
        return;
      }
      if (session.status !== "open") {
        reply.code(409).send({ error: "Upload session is not open." });
        return;
      }
      if (new Date(session.expires_at).getTime() <= Date.now()) {
        await setMessageUploadSessionStatus({
          uploadId: session.id,
          status: "expired",
          uploadedBytes: Number(session.uploaded_bytes || 0),
        });
        reply.code(410).send({ error: "Upload session expired." });
        return;
      }

      let chunk: Buffer;
      try {
        chunk = decodeChunkPayload(parsedBody.data.chunkBase64);
      } catch {
        reply.code(400).send({ error: "Invalid chunk payload." });
        return;
      }
      if (chunk.length === 0) {
        reply.code(400).send({ error: "Chunk cannot be empty." });
        return;
      }

      const uploadedBytes = Number(session.uploaded_bytes || 0);
      const totalBytes = Number(session.total_bytes || 0);
      const nextUploadedBytes = uploadedBytes + chunk.length;
      if (nextUploadedBytes > totalBytes) {
        reply.code(400).send({
          error: "Chunk exceeds declared file size.",
          uploadedBytes,
          totalBytes,
        });
        return;
      }

      const fullPath = resolveSafeStoragePath(MESSAGE_UPLOAD_SESSIONS_ROOT, session.temp_storage_path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.appendFile(fullPath, chunk);
      const updatedSession = await updateMessageUploadSessionProgress({
        uploadId: session.id,
        uploadedBytes: nextUploadedBytes,
      });

      reply.send({
        session: updatedSession,
        complete: nextUploadedBytes >= totalBytes,
        remainingBytes: Math.max(0, totalBytes - nextUploadedBytes),
      });
    }
  );

  app.post(
    "/messages/conversations/:id/upload-sessions/:uploadId/complete",
    { preHandler: requireAuth, config: { rateLimit: MESSAGE_ATTACHMENT_RATE_LIMIT } },
    async (request, reply) => {
      const parsedParams = uploadSessionParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid upload session id." });
        return;
      }
      const parsedBody = uploadSessionCompleteSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
      if (!canPost) return;

      const session = await getMessageUploadSession(parsedParams.data.uploadId);
      if (!session || session.conversation_id !== conversationId) {
        reply.code(404).send({ error: "Upload session not found." });
        return;
      }
      if (session.user_id !== request.user.sub) {
        reply.code(403).send({ error: "Only the uploader can complete this session." });
        return;
      }
      if (session.status !== "open") {
        reply.code(409).send({ error: "Upload session is not open." });
        return;
      }

      const totalBytes = Number(session.total_bytes || 0);
      const uploadedBytes = Number(session.uploaded_bytes || 0);
      if (uploadedBytes < totalBytes) {
        reply.code(409).send({ error: "Upload is incomplete." });
        return;
      }

      const fullPath = resolveSafeStoragePath(MESSAGE_UPLOAD_SESSIONS_ROOT, session.temp_storage_path);
      let buffer: Buffer;
      try {
        buffer = await fs.readFile(fullPath);
      } catch {
        reply.code(404).send({ error: "Upload file missing." });
        return;
      }

      if (buffer.length !== totalBytes) {
        reply.code(409).send({
          error: "Upload size mismatch.",
          uploadedBytes: buffer.length,
          totalBytes,
        });
        return;
      }

      const kind = inferAttachmentKind(session.mime_type, session.file_name);
      if (!kind) {
        await setMessageUploadSessionStatus({
          uploadId: session.id,
          status: "aborted",
          uploadedBytes: buffer.length,
        });
        await fs.unlink(fullPath).catch(() => undefined);
        reply.code(400).send({ error: "Unsupported attachment type." });
        return;
      }

      const scan = scanAttachmentPayload({
        fileName: session.file_name,
        mimeType: session.mime_type,
        buffer,
      });
      if (scan.status === "blocked") {
        await setMessageUploadSessionStatus({
          uploadId: session.id,
          status: "aborted",
          uploadedBytes: buffer.length,
        });
        await fs.unlink(fullPath).catch(() => undefined);
        reply.code(400).send({ error: "Attachment blocked by safety scanner.", reason: scan.reason });
        return;
      }

      const quotaState = await getAttachmentQuotaState(conversationId);
      if (quotaState.usage.totalBytes + buffer.length > Number(quotaState.quota.max_bytes || 0)) {
        reply.code(413).send({
          error: "Conversation attachment quota exceeded.",
          quota: quotaState.quota,
          usage: quotaState.usage,
          requestedBytes: buffer.length,
        });
        return;
      }

      const settings = await getConversationSettings(conversationId, request.user.sub);
      if (settings?.blocked) {
        reply.code(403).send({ error: "Conversation is blocked for this account." });
        return;
      }

      const directPeerAllowed = await ensureDirectPeerMessagingAllowed(
        conversationId,
        request.user.sub,
        reply
      );
      if (!directPeerAllowed) return;

      const rawBody = parsedBody.data.body?.trim() ?? "";
      const detection = rawBody ? await applyOffPlatformPolicy(request.user.sub, rawBody) : null;
      const safeBody = detection ? detection.redacted.trim() : rawBody;
      const mentionHandles = safeBody ? extractMentionHandles(safeBody) : [];
      const mentionTargets = mentionHandles.length
        ? await resolveMentionTargets(conversationId, mentionHandles)
        : [];
      const mentionUserIds = mentionTargets
        .map((target) => target.user_id)
        .filter((userId) => userId !== request.user.sub);
      const replyToMessageId = await resolveReplyTargetMessage(
        conversationId,
        parsedBody.data.replyToMessageId,
        reply
      );
      if (replyToMessageId === undefined) return;

      const message = await createMessage(conversationId, request.user.sub, safeBody || null, {
        mentionUserIds,
        parentMessageId: replyToMessageId,
      });

      let storagePath: string | null = null;
      let attachment: MessageAttachmentRecord | null = null;
      try {
        storagePath = await saveAttachmentFile({
          conversationId,
          userId: request.user.sub,
          filename: session.file_name,
          buffer,
        });
        attachment = await createMessageAttachment({
          messageId: message.id,
          conversationId,
          uploaderId: request.user.sub,
          fileName: session.file_name,
          storagePath,
          mimeType: session.mime_type,
          sizeBytes: buffer.length,
          kind,
          durationSeconds: kind === "audio" ? parsedBody.data.durationSeconds ?? null : null,
          scanStatus: "clean",
          scanReason: null,
          scannedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (storagePath) {
          const attachmentPath = resolveSafeStoragePath(MESSAGE_ATTACHMENTS_ROOT, storagePath);
          await fs.unlink(attachmentPath).catch(() => undefined);
        }
        throw error;
      } finally {
        await fs.unlink(fullPath).catch(() => undefined);
      }

      await completeMessageUploadSession(session.id);
      await touchConversationPresence({
        conversationId,
        userId: request.user.sub,
        touchActive: true,
      });

      const participants = await getParticipantIds(conversationId);
      const messagePayload = {
        ...message,
        attachments: enrichAttachments(attachment ? [attachment] : []),
      };
      await publishMessage({
        event: "message",
        conversationId,
        message: messagePayload,
        participants,
      });
      invalidateSocialDiscoveryForUsers(participants);
      invalidateDashboardForUsers(participants);
      invalidateDashboardGlobally();

      reply.code(201).send({
        message: messagePayload,
        warning:
          detection?.flagged === true
            ? "Message contained off-platform contact info and was redacted."
            : undefined,
      });
    }
  );

  app.get("/messages/conversations/:id/channel-tasks", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedQuery = channelItemsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query", details: parsedQuery.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;
    const channel = await requireChannelConversation(conversationId, reply);
    if (!channel) return;

    const tasks = await listChannelTasks(conversationId, parsedQuery.data.limit ?? 120);
    reply.send({ tasks });
  });

  app.post("/messages/conversations/:id/channel-tasks", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedBody = channelTaskBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;
    const channel = await requireChannelConversation(conversationId, reply);
    if (!channel) return;
    const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
    if (!canPost) return;

    const task = await createChannelTask({
      conversationId,
      createdBy: request.user.sub,
      assigneeId: parsedBody.data.assigneeId ?? null,
      linkedMessageId: parsedBody.data.linkedMessageId ?? null,
      title: parsedBody.data.title,
      description: parsedBody.data.description,
      dueAt: parsedBody.data.dueAt ?? null,
    });
    reply.code(201).send({ task });
  });

  app.patch(
    "/messages/conversations/:id/channel-tasks/:taskId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = channelTaskParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid params", details: parsedParams.error.flatten() });
        return;
      }
      const parsedBody = channelTaskUpdateSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const channel = await requireChannelConversation(conversationId, reply);
      if (!channel) return;
      const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
      if (!canPost) return;

      const task = await updateChannelTask({
        taskId: parsedParams.data.taskId,
        status: parsedBody.data.status,
        assigneeId: parsedBody.data.assigneeId ?? null,
        title: parsedBody.data.title,
        description: parsedBody.data.description ?? null,
        dueAt: parsedBody.data.dueAt ?? null,
      });
      if (!task || task.conversation_id !== conversationId) {
        reply.code(404).send({ error: "Task not found." });
        return;
      }
      reply.send({ task });
    }
  );

  app.get(
    "/messages/conversations/:id/channel-assessments",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = conversationIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid conversation id." });
        return;
      }
      const parsedQuery = channelItemsQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        reply.code(400).send({ error: "Invalid query", details: parsedQuery.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const channel = await requireChannelConversation(conversationId, reply);
      if (!channel) return;

      const assessments = await listChannelAssessments(conversationId, parsedQuery.data.limit ?? 50);
      reply.send({ assessments });
    }
  );

  app.post(
    "/messages/conversations/:id/channel-assessments",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = conversationIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid conversation id." });
        return;
      }
      const parsedBody = channelAssessmentBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const channel = await requireChannelConversation(conversationId, reply);
      if (!channel) return;
      const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
      if (!canPost) return;

      const assessment = await createChannelAssessment({
        conversationId,
        createdBy: request.user.sub,
        title: parsedBody.data.title,
        instructions: parsedBody.data.instructions,
        questionsJson: parsedBody.data.questions,
        maxScore: parsedBody.data.maxScore,
        dueAt: parsedBody.data.dueAt ?? null,
      });
      reply.code(201).send({ assessment });
    }
  );

  app.post(
    "/messages/conversations/:id/channel-assessments/:assessmentId/attempts",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = channelAssessmentParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid params", details: parsedParams.error.flatten() });
        return;
      }
      const parsedBody = channelAssessmentAttemptSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const channel = await requireChannelConversation(conversationId, reply);
      if (!channel) return;

      const attempt = await submitChannelAssessmentAttempt({
        assessmentId: parsedParams.data.assessmentId,
        conversationId,
        learnerId: request.user.sub,
        answersJson: parsedBody.data.answers,
        score: parsedBody.data.score ?? null,
      });
      reply.code(201).send({ attempt });
    }
  );

  app.get(
    "/messages/conversations/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedQuery = listMessagesQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        reply.code(400).send({ error: "Invalid query" });
        return;
      }

      const conversationId = (request.params as { id: string }).id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;

      await touchConversationPresence({
        conversationId,
        userId: request.user.sub,
        touchActive: true,
      });

      const limit = parsedQuery.data.limit ?? 50;
      const before = parsedQuery.data.before ?? null;
      const [messages, firstUnreadMessageId] = await Promise.all([
        listMessages(conversationId, { limit: limit + 1, before }, request.user.sub),
        getFirstUnreadMessageId(conversationId, request.user.sub),
      ]);
      const hasMore = messages.length > limit;
      const trimmed = hasMore ? messages.slice(1) : messages;
      reply.send({ messages: trimmed, hasMore, firstUnreadMessageId });
    }
  );

  app.get("/messages/conversations/:id/messages/context", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedQuery = messageContextQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query", details: parsedQuery.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    await touchConversationPresence({
      conversationId,
      userId: request.user.sub,
      touchActive: true,
    });

    const context = await listMessagesAround(
      conversationId,
      parsedQuery.data.messageId,
      {
        before: parsedQuery.data.before ?? 20,
        after: parsedQuery.data.after ?? 40,
      },
      request.user.sub
    );

    if (!context) {
      reply.code(404).send({ error: "Message not found in this conversation." });
      return;
    }

    reply.send({
      messages: context.messages.map((message) => ({
        ...message,
        attachments: enrichAttachments(message.attachments || []),
      })),
      anchorMessageId: context.anchorMessageId,
      hasBefore: context.hasBefore,
      hasAfter: context.hasAfter,
    });
  });

  app.get("/messages/conversations/:id/threads/:messageId", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = threadParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid params", details: parsedParams.error.flatten() });
      return;
    }
    const parsedQuery = threadMessagesQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query", details: parsedQuery.error.flatten() });
      return;
    }

    const { id: conversationId, messageId } = parsedParams.data;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    await touchConversationPresence({
      conversationId,
      userId: request.user.sub,
      touchActive: true,
    });

    const thread = await listThreadMessages(
      conversationId,
      messageId,
      { limit: parsedQuery.data.limit ?? 80 },
      request.user.sub
    );
    if (!thread) {
      reply.code(404).send({ error: "Thread not found in this conversation." });
      return;
    }

    reply.send({
      rootMessageId: thread.rootMessageId,
      messages: thread.messages.map((message) => ({
        ...message,
        attachments: enrichAttachments(message.attachments || []),
      })),
    });
  });

  app.get("/messages/conversations/:id/search", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }

    const parsedQuery = searchMessagesQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    await touchConversationPresence({
      conversationId,
      userId: request.user.sub,
      touchActive: true,
    });

    const filters = parseMessageSearchFilters(parsedQuery.data.q);
    const messages = await searchConversationMessages(
      conversationId,
      filters.text,
      {
        limit: parsedQuery.data.limit ?? 25,
        fromUserId: filters.fromUserId,
        hasFiles: filters.hasFiles,
        before: filters.beforeIso,
        after: filters.afterIso,
      },
      request.user.sub
    );

    reply.send({
      messages,
      filters: {
        fromUserId: filters.fromUserId,
        hasFiles: filters.hasFiles,
        before: filters.beforeIso,
        after: filters.afterIso,
      },
    });
  });

  app.get("/messages/conversations/:id/pins", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedQuery = pinnedMessagesQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const messages = await listPinnedMessages(
      conversationId,
      { limit: parsedQuery.data.limit ?? 25 },
      request.user.sub
    );

    reply.send({
      messages: messages.map((message) => ({
        ...message,
        attachments: enrichAttachments(message.attachments || []),
      })),
    });
  });

  app.put("/messages/messages/:id/edit", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = messageIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid message id." });
      return;
    }
    const parsedBody = editMessageSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const existing = await getMessageById(parsedParams.data.id);
    if (!existing) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }
    const allowed = await requireConversationParticipant(existing.conversation_id, request.user.sub, reply);
    if (!allowed) return;
    if (existing.deleted_at) {
      reply.code(400).send({ error: "Deleted messages cannot be pinned." });
      return;
    }
    if (existing.sender_id !== request.user.sub) {
      reply.code(403).send({ error: "Only the sender can edit this message." });
      return;
    }
    if (existing.deleted_at) {
      reply.code(400).send({ error: "Deleted messages cannot be edited." });
      return;
    }

    const canPost = await ensureConversationCanPost(existing.conversation_id, request.user.sub, reply);
    if (!canPost) return;

    const rawBody = parsedBody.data.body.trim();
    const detection = await applyOffPlatformPolicy(request.user.sub, rawBody);
    const safeBody = detection.redacted.trim() || "[message removed for safety]";
    const mentionHandles = extractMentionHandles(safeBody);
    const mentionTargets = mentionHandles.length
      ? await resolveMentionTargets(existing.conversation_id, mentionHandles)
      : [];
    const mentionUserIds = mentionTargets
      .map((target) => target.user_id)
      .filter((userId) => userId !== request.user.sub);

    const message = await editMessageBody(existing.id, request.user.sub, safeBody, { mentionUserIds });
    if (!message) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }

    const messagePayload = {
      ...message,
      attachments: enrichAttachments(message.attachments || []),
    };
    await touchConversationPresence({
      conversationId: existing.conversation_id,
      userId: request.user.sub,
      touchActive: true,
    });
    const participants = await getParticipantIds(existing.conversation_id);
    await publishEvent({
      event: "message_update",
      conversationId: existing.conversation_id,
      participants,
      userId: request.user.sub,
      kind: "edited",
      message: messagePayload,
    });

    reply.send({
      message: messagePayload,
      warning: detection.flagged ? "Message contained off-platform contact info and was redacted." : undefined,
    });
  });

  app.delete("/messages/messages/:id", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = messageIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid message id." });
      return;
    }

    const existing = await getMessageById(parsedParams.data.id);
    if (!existing) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }
    const allowed = await requireConversationParticipant(existing.conversation_id, request.user.sub, reply);
    if (!allowed) return;
    if (existing.deleted_at) {
      reply.code(400).send({ error: "Deleted messages cannot be unpinned." });
      return;
    }
    if (existing.sender_id !== request.user.sub) {
      reply.code(403).send({ error: "Only the sender can delete this message." });
      return;
    }
    if (existing.deleted_at) {
      reply.send({
        message: {
          ...existing,
          attachments: enrichAttachments(existing.attachments || []),
        },
      });
      return;
    }

    const message = await softDeleteMessage(existing.id, request.user.sub);
    if (!message) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }

    const messagePayload = {
      ...message,
      attachments: enrichAttachments(message.attachments || []),
    };
    await touchConversationPresence({
      conversationId: existing.conversation_id,
      userId: request.user.sub,
      touchActive: true,
    });
    const participants = await getParticipantIds(existing.conversation_id);
    await publishEvent({
      event: "message_update",
      conversationId: existing.conversation_id,
      participants,
      userId: request.user.sub,
      kind: "deleted",
      message: messagePayload,
    });

    reply.send({ message: messagePayload });
  });

  app.post("/messages/messages/:id/reactions", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = messageIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid message id." });
      return;
    }
    const parsedBody = messageReactionSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const existing = await getMessageById(parsedParams.data.id);
    if (!existing) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }
    const allowed = await requireConversationParticipant(existing.conversation_id, request.user.sub, reply);
    if (!allowed) return;
    if (existing.deleted_at) {
      reply.code(400).send({ error: "Reactions are unavailable for deleted messages." });
      return;
    }

    const result = await toggleMessageReaction(
      existing.id,
      existing.conversation_id,
      request.user.sub,
      parsedBody.data.emoji
    );
    if (!result.message) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }

    const messagePayload = {
      ...result.message,
      attachments: enrichAttachments(result.message.attachments || []),
    };
    await touchConversationPresence({
      conversationId: existing.conversation_id,
      userId: request.user.sub,
      touchActive: true,
    });
    const participants = await getParticipantIds(existing.conversation_id);
    await publishEvent({
      event: "message_update",
      conversationId: existing.conversation_id,
      participants,
      userId: request.user.sub,
      kind: "reaction",
      emoji: parsedBody.data.emoji.trim(),
      reacted: result.reacted,
      message: messagePayload,
    });

    reply.send({
      emoji: parsedBody.data.emoji.trim(),
      reacted: result.reacted,
      message: messagePayload,
    });
  });

  app.post("/messages/messages/:id/saved", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = messageIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid message id." });
      return;
    }

    const existing = await getMessageById(parsedParams.data.id);
    if (!existing) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }

    const allowed = await requireConversationParticipant(existing.conversation_id, request.user.sub, reply);
    if (!allowed) return;

    const toggled = await toggleSavedMessage(existing.id, request.user.sub);
    const refreshed = await getMessageById(existing.id);
    const messagePayload = refreshed
      ? {
          ...refreshed,
          attachments: enrichAttachments(refreshed.attachments || []),
        }
      : null;

    reply.send({
      saved: toggled.saved,
      savedAt: toggled.savedAt,
      message: messagePayload,
    });
  });

  app.put("/messages/messages/:id/pin", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = messageIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid message id." });
      return;
    }

    const existing = await getMessageById(parsedParams.data.id);
    if (!existing) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }
    const allowed = await requireConversationParticipant(existing.conversation_id, request.user.sub, reply);
    if (!allowed) return;

    const conversation = await getConversationById(existing.conversation_id);
    if (!conversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }
    if (conversation.type === "channel") {
      const role = await getConversationParticipantRole(existing.conversation_id, request.user.sub);
      if (role !== "owner" && role !== "editor") {
        reply.code(403).send({ error: "Only owners or editors can pin messages in this channel." });
        return;
      }
    }

    const message = await pinMessage(parsedParams.data.id, request.user.sub);
    if (!message) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }

    const messagePayload = {
      ...message,
      attachments: enrichAttachments(message.attachments || []),
    };
    const participants = await getParticipantIds(message.conversation_id);
    await publishEvent({
      event: "pin",
      conversationId: message.conversation_id,
      participants,
      userId: request.user.sub,
      pinned: true,
      message: messagePayload,
    });
    await createMessageActivityEvent({
      conversationId: message.conversation_id,
      actorId: request.user.sub,
      eventType: "message_pinned",
      messageId: message.id,
      metadata: {
        pinnedBy: request.user.sub,
      },
    });

    reply.send({
      ok: true,
      message: messagePayload,
    });
  });

  app.delete("/messages/messages/:id/pin", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = messageIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid message id." });
      return;
    }

    const existing = await getMessageById(parsedParams.data.id);
    if (!existing) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }
    const allowed = await requireConversationParticipant(existing.conversation_id, request.user.sub, reply);
    if (!allowed) return;

    const conversation = await getConversationById(existing.conversation_id);
    if (!conversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }
    if (conversation.type === "channel") {
      const role = await getConversationParticipantRole(existing.conversation_id, request.user.sub);
      if (role !== "owner" && role !== "editor") {
        reply.code(403).send({ error: "Only owners or editors can unpin messages in this channel." });
        return;
      }
    }

    const message = await unpinMessage(parsedParams.data.id, request.user.sub);
    if (!message) {
      reply.code(404).send({ error: "Message not found." });
      return;
    }

    const messagePayload = {
      ...message,
      attachments: enrichAttachments(message.attachments || []),
    };
    const participants = await getParticipantIds(message.conversation_id);
    await publishEvent({
      event: "pin",
      conversationId: message.conversation_id,
      participants,
      userId: request.user.sub,
      pinned: false,
      message: messagePayload,
    });
    await createMessageActivityEvent({
      conversationId: message.conversation_id,
      actorId: request.user.sub,
      eventType: "message_unpinned",
      messageId: message.id,
      metadata: {
        unpinnedBy: request.user.sub,
      },
    });

    reply.send({
      ok: true,
      message: messagePayload,
    });
  });

  app.put("/messages/conversations/:id/archive", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedBody = archiveConversationSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const conversation = await getConversationDetailsById(conversationId);
    if (!conversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }
    if (conversation.type !== "channel") {
      reply.code(400).send({ error: "Archive controls are only available for channels." });
      return;
    }

    const actorRole = await getConversationParticipantRole(conversationId, request.user.sub);
    if (actorRole !== "owner") {
      reply.code(403).send({ error: "Only channel owners can archive or unarchive channels." });
      return;
    }

    const updated = parsedBody.data.archived
      ? await archiveConversation(conversationId, request.user.sub)
      : await unarchiveConversation(conversationId);

    if (!updated) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }

    const participants = await getParticipantIds(conversationId);
    await publishEvent({
      event: "archive",
      conversationId,
      participants,
      userId: request.user.sub,
      archived: Boolean(updated.archived_at),
      archivedAt: updated.archived_at,
      archivedBy: updated.archived_by,
    });
    await createMessageActivityEvent({
      conversationId,
      actorId: request.user.sub,
      eventType: updated.archived_at ? "conversation_archived" : "conversation_unarchived",
      metadata: {
        archived: Boolean(updated.archived_at),
        archivedAt: updated.archived_at,
        archivedBy: updated.archived_by,
      },
    });

    reply.send({ conversation: updated });
  });

  app.patch("/messages/conversations/:id/channel", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedBody = updateChannelDetailsSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const conversation = await getConversationDetailsById(conversationId);
    if (!conversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }
    if (conversation.type !== "channel") {
      reply.code(400).send({ error: "Assignment details can only be updated for channels." });
      return;
    }

    const actorRole = await getConversationParticipantRole(conversationId, request.user.sub);
    if (actorRole !== "owner" && actorRole !== "editor") {
      reply.code(403).send({ error: "Only channel owners or editors can update assignment details." });
      return;
    }

    const assignmentDescription =
      parsedBody.data.assignmentDescription === undefined
        ? undefined
        : parsedBody.data.assignmentDescription === null
        ? null
        : parsedBody.data.assignmentDescription.trim() || null;

    const updatedConversation = await updateChannelConversationDetails(conversationId, {
      name: parsedBody.data.name?.trim(),
      assignmentTitle: parsedBody.data.assignmentTitle?.trim(),
      assignmentDescription,
      assignmentDueAt: parsedBody.data.assignmentDueAt,
      assignmentTemplate: parsedBody.data.assignmentTemplate,
    });
    if (!updatedConversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }

    const participants = await getParticipantIds(conversationId);
    await publishEvent({
      event: "conversation",
      conversationId,
      participants,
      userId: request.user.sub,
      kind: "channel_details_updated",
      conversation: updatedConversation,
    });
    const previousTemplateSnapshot = conversation.assignment_template
      ? JSON.stringify(conversation.assignment_template)
      : null;
    const nextTemplateSnapshot = updatedConversation.assignment_template
      ? JSON.stringify(updatedConversation.assignment_template)
      : null;
    const changedFields: string[] = [];
    if (conversation.name !== updatedConversation.name) changedFields.push("name");
    if (conversation.assignment_title !== updatedConversation.assignment_title) {
      changedFields.push("assignmentTitle");
    }
    if (conversation.assignment_description !== updatedConversation.assignment_description) {
      changedFields.push("assignmentDescription");
    }
    if (conversation.assignment_due_at !== updatedConversation.assignment_due_at) {
      changedFields.push("assignmentDueAt");
    }
    if (previousTemplateSnapshot !== nextTemplateSnapshot) {
      changedFields.push("assignmentTemplate");
    }
    await createMessageActivityEvent({
      conversationId,
      actorId: request.user.sub,
      eventType: "channel_details_updated",
      metadata: {
        changedFields,
        requestedFields: {
          name: parsedBody.data.name !== undefined,
          assignmentTitle: parsedBody.data.assignmentTitle !== undefined,
          assignmentDescription: parsedBody.data.assignmentDescription !== undefined,
          assignmentDueAt: parsedBody.data.assignmentDueAt !== undefined,
          assignmentTemplate: parsedBody.data.assignmentTemplate !== undefined,
        },
        before: {
          name: conversation.name,
          assignmentTitle: conversation.assignment_title,
          assignmentDescription: conversation.assignment_description,
          assignmentDueAt: conversation.assignment_due_at,
          assignmentTemplateId: getAssignmentTemplateId(conversation.assignment_template),
        },
        after: {
          name: updatedConversation.name,
          assignmentTitle: updatedConversation.assignment_title,
          assignmentDescription: updatedConversation.assignment_description,
          assignmentDueAt: updatedConversation.assignment_due_at,
          assignmentTemplateId: getAssignmentTemplateId(updatedConversation.assignment_template),
        },
      },
    });

    reply.send({ conversation: updatedConversation });
  });

  app.post(
    "/messages/conversations/:id/messages",
    { preHandler: requireAuth, config: { rateLimit: MESSAGE_POST_RATE_LIMIT } },
    async (request, reply) => {
      const conversationId = (request.params as { id: string }).id;
      const parsed = messageSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
      if (!canPost) return;

      const settings = await getConversationSettings(conversationId, request.user.sub);
      if (settings?.blocked) {
        reply.code(403).send({ error: "Conversation is blocked for this account." });
        return;
      }

      const directPeerAllowed = await ensureDirectPeerMessagingAllowed(
        conversationId,
        request.user.sub,
        reply
      );
      if (!directPeerAllowed) return;

      const rawBody = parsed.data.body.trim();
      const detection = await applyOffPlatformPolicy(request.user.sub, rawBody);
      const safeBody = detection.redacted;
      const messageBody = safeBody.trim() || "[message removed for safety]";
      const mentionHandles = extractMentionHandles(messageBody);
      const mentionTargets = mentionHandles.length
        ? await resolveMentionTargets(conversationId, mentionHandles)
        : [];
      const mentionUserIds = mentionTargets
        .map((target) => target.user_id)
        .filter((userId) => userId !== request.user.sub);
      const replyToMessageId = await resolveReplyTargetMessage(
        conversationId,
        parsed.data.replyToMessageId,
        reply
      );
      if (replyToMessageId === undefined) return;
      const message = await createMessage(conversationId, request.user.sub, messageBody, {
        mentionUserIds,
        parentMessageId: replyToMessageId,
      });
      await touchConversationPresence({
        conversationId,
        userId: request.user.sub,
        touchActive: true,
      });
      const messagePayload = { ...message, attachments: [] as MessageAttachmentRecord[] };
      const participants = await getParticipantIds(conversationId);
      await publishMessage({
        event: "message",
        conversationId,
        message: messagePayload,
        participants,
      });
      invalidateSocialDiscoveryForUsers(participants);
      invalidateDashboardForUsers(participants);
      invalidateDashboardGlobally();
      reply.code(201).send({
        message: messagePayload,
        warning: detection.flagged ? "Message contained off-platform contact info and was redacted." : undefined,
      });
    }
  );

  app.post(
    "/messages/conversations/:id/messages/attachments",
    { preHandler: requireAuth, config: { rateLimit: MESSAGE_ATTACHMENT_RATE_LIMIT } },
    async (request, reply) => {
      const conversationId = (request.params as { id: string }).id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;
      const canPost = await ensureConversationCanPost(conversationId, request.user.sub, reply);
      if (!canPost) return;

      const settings = await getConversationSettings(conversationId, request.user.sub);
      if (settings?.blocked) {
        reply.code(403).send({ error: "Conversation is blocked for this account." });
        return;
      }

      const directPeerAllowed = await ensureDirectPeerMessagingAllowed(
        conversationId,
        request.user.sub,
        reply
      );
      if (!directPeerAllowed) return;

      let parsedPayload: Awaited<ReturnType<typeof parseAttachmentPayload>>;
      try {
        parsedPayload = await parseAttachmentPayload(request);
      } catch (error) {
        reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to process attachments.",
        });
        return;
      }

      if (parsedPayload.body.length > 2000) {
        reply.code(400).send({ error: "Message body must be 2000 characters or fewer." });
        return;
      }
      if (!parsedPayload.body && parsedPayload.uploads.length === 0) {
        reply.code(400).send({ error: "Add message text or at least one attachment." });
        return;
      }

      const scannedUploads = parsedPayload.uploads.map((upload) => ({
        upload,
        scan: scanAttachmentPayload({
          fileName: upload.fileName,
          mimeType: upload.mimeType,
          buffer: upload.buffer,
        }),
      }));
      const blockedUpload = scannedUploads.find((entry) => entry.scan.status === "blocked");
      if (blockedUpload) {
        reply.code(400).send({
          error: "Attachment blocked by safety scanner.",
          reason: blockedUpload.scan.reason,
          fileName: blockedUpload.upload.fileName,
        });
        return;
      }

      const totalUploadBytes = parsedPayload.uploads.reduce((sum, upload) => sum + upload.sizeBytes, 0);
      if (totalUploadBytes > 0) {
        const quotaState = await getAttachmentQuotaState(conversationId);
        if (quotaState.usage.totalBytes + totalUploadBytes > Number(quotaState.quota.max_bytes || 0)) {
          reply.code(413).send({
            error: "Conversation attachment quota exceeded.",
            quota: quotaState.quota,
            usage: quotaState.usage,
            requestedBytes: totalUploadBytes,
          });
          return;
        }
      }

      const detection = parsedPayload.body
        ? await applyOffPlatformPolicy(request.user.sub, parsedPayload.body)
        : null;
      const safeBody = detection ? detection.redacted.trim() : parsedPayload.body.trim();
      const mentionHandles = safeBody ? extractMentionHandles(safeBody) : [];
      const mentionTargets = mentionHandles.length
        ? await resolveMentionTargets(conversationId, mentionHandles)
        : [];
      const mentionUserIds = mentionTargets
        .map((target) => target.user_id)
        .filter((userId) => userId !== request.user.sub);
      const replyToMessageId = await resolveReplyTargetMessage(
        conversationId,
        parsedPayload.replyToMessageId,
        reply
      );
      if (replyToMessageId === undefined) return;
      const message = await createMessage(conversationId, request.user.sub, safeBody || null, {
        mentionUserIds,
        parentMessageId: replyToMessageId,
      });

      const storedPaths: string[] = [];
      const createdAttachments: MessageAttachmentRecord[] = [];
      try {
        for (const [index, upload] of parsedPayload.uploads.entries()) {
          const storagePath = await saveAttachmentFile({
            conversationId,
            userId: request.user.sub,
            filename: upload.fileName,
            buffer: upload.buffer,
          });
          storedPaths.push(storagePath);

          const attachment = await createMessageAttachment({
            messageId: message.id,
            conversationId,
            uploaderId: request.user.sub,
            fileName: upload.fileName,
            storagePath,
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
            kind: upload.kind,
            durationSeconds:
              upload.kind === "audio" && index === 0 ? parsedPayload.durationSeconds ?? null : null,
            scanStatus: scannedUploads[index]?.scan.status ?? "pending",
            scanReason: scannedUploads[index]?.scan.reason ?? null,
            scannedAt: new Date().toISOString(),
          });
          createdAttachments.push(attachment);
        }
      } catch (error) {
        for (const relativePath of storedPaths) {
          const fullPath = resolveSafeStoragePath(MESSAGE_ATTACHMENTS_ROOT, relativePath);
          await fs.unlink(fullPath).catch(() => undefined);
        }
        throw error;
      }

      await touchConversationPresence({
        conversationId,
        userId: request.user.sub,
        touchActive: true,
      });

      const participants = await getParticipantIds(conversationId);
      const messagePayload = {
        ...message,
        attachments: enrichAttachments(createdAttachments),
      };

      await publishMessage({
        event: "message",
        conversationId,
        message: messagePayload,
        participants,
      });
      invalidateSocialDiscoveryForUsers(participants);
      invalidateDashboardForUsers(participants);
      invalidateDashboardGlobally();

      reply.code(201).send({
        message: messagePayload,
        warning:
          detection?.flagged === true
            ? "Message contained off-platform contact info and was redacted."
            : undefined,
      });
    }
  );

  app.get("/messages/attachments/:id", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = attachmentParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid attachment id." });
      return;
    }

    const attachment = await getMessageAttachmentById(parsed.data.id);
    if (!attachment) {
      reply.code(404).send({ error: "Attachment not found." });
      return;
    }

    const allowed = await requireConversationParticipant(attachment.conversation_id, request.user.sub, reply);
    if (!allowed) return;
    if (attachment.scan_status === "blocked") {
      reply.code(403).send({ error: "Attachment is not available." });
      return;
    }

    const rootPath = path.resolve(MESSAGE_ATTACHMENTS_ROOT);
    const resolvedPath = path.resolve(MESSAGE_ATTACHMENTS_ROOT, attachment.storage_path);
    if (!resolvedPath.startsWith(rootPath + path.sep) && resolvedPath !== rootPath) {
      reply.code(400).send({ error: "Invalid attachment path." });
      return;
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      reply.code(404).send({ error: "Attachment file missing." });
      return;
    }

    const safeName = attachment.file_name.replace(/["\\]/g, "_");
    reply.type(attachment.mime_type || "application/octet-stream");
    reply.header(
      "Content-Disposition",
      `${attachment.kind === "file" ? "attachment" : "inline"}; filename="${safeName}"`
    );
    return reply.send(createReadStream(resolvedPath));
  });

  app.get("/messages/conversations/:id/state", { preHandler: requireAuth }, async (request, reply) => {
    const conversationId = (request.params as { id: string }).id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const [participants, presence, settings, visibilitySettings] = await Promise.all([
      listConversationParticipants(conversationId),
      listConversationPresence(conversationId),
      getConversationSettings(conversationId, request.user.sub),
      listConversationVisibilitySettings(conversationId),
    ]);

    const visibilityByUserId = new Map(visibilitySettings.map((item) => [item.user_id, item]));
    const filteredPresence = presence
      .map((row) => {
        if (row.user_id === request.user.sub) return row;
        const visibility = visibilityByUserId.get(row.user_id);
        if (visibility?.share_presence === false) return null;
        return {
          ...row,
          last_typing_at: visibility?.share_typing === false ? null : row.last_typing_at,
          last_read_at: visibility?.share_read_receipts === false ? null : row.last_read_at,
        };
      })
      .filter((row): row is (typeof presence)[number] => row !== null);

    reply.send({
      participants,
      presence: filteredPresence,
      settings: settings || {
        conversation_id: conversationId,
        user_id: request.user.sub,
        muted_until: null,
        blocked: false,
        mention_notifications: true,
        assignment_reminder_mode: "72h",
        assignment_reminder_snoozed_until: null,
        assignment_overdue_repeat_hours: 24,
        channel_event_notifications: true,
        message_update_notifications: true,
        share_presence: true,
        share_typing: true,
        share_read_receipts: true,
      },
    });
  });

  app.post(
    "/messages/conversations/:id/typing",
    { preHandler: requireAuth, config: { rateLimit: MESSAGE_TYPING_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = typingSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const conversationId = (request.params as { id: string }).id;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;

      const actorSettings = await getConversationSettings(conversationId, request.user.sub);
      if (actorSettings?.blocked) {
        reply.code(403).send({ error: "Conversation is blocked for this account." });
        return;
      }
      const directPeerAllowed = await ensureDirectPeerMessagingAllowed(
        conversationId,
        request.user.sub,
        reply
      );
      if (!directPeerAllowed) return;

      const nowIso = new Date().toISOString();
      await touchConversationPresence({
        conversationId,
        userId: request.user.sub,
        touchActive: true,
        touchTyping: parsed.data.isTyping,
      });
      if (actorSettings?.share_typing === false) {
        reply.send({ ok: true });
        return;
      }
      const participants = await getParticipantIds(conversationId);
      await publishEvent({
        event: "typing",
        conversationId,
        participants,
        userId: request.user.sub,
        isTyping: parsed.data.isTyping,
        at: nowIso,
      });
      reply.send({ ok: true });
    }
  );

  app.post("/messages/conversations/:id/read", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = readSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const conversationId = (request.params as { id: string }).id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const readAt = parsed.data.readAt || new Date().toISOString();
    await touchConversationPresence({
      conversationId,
      userId: request.user.sub,
      touchActive: true,
      readAt,
    });
    await markConversationMessagesRead(conversationId, request.user.sub, readAt);
    invalidateDashboardForUsers([request.user.sub]);
    const actorSettings = await getConversationSettings(conversationId, request.user.sub);
    if (actorSettings?.share_read_receipts !== false) {
      const participants = await getParticipantIds(conversationId);
      await publishEvent({
        event: "read",
        conversationId,
        participants,
        userId: request.user.sub,
        readAt,
      });
    }
    reply.send({ ok: true, readAt });
  });

  app.put("/messages/conversations/:id/settings", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const conversationId = (request.params as { id: string }).id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;
    const hasAssignmentReminderUpdate =
      parsed.data.assignmentReminderMode !== undefined ||
      parsed.data.assignmentReminderSnoozeMinutes !== undefined ||
      parsed.data.assignmentOverdueRepeatHours !== undefined;
    const hasNotificationPrivacyUpdate =
      parsed.data.channelEventNotifications !== undefined ||
      parsed.data.messageUpdateNotifications !== undefined ||
      parsed.data.sharePresence !== undefined ||
      parsed.data.shareTyping !== undefined ||
      parsed.data.shareReadReceipts !== undefined;
    let settingsConversation: Awaited<ReturnType<typeof getConversationById>> | null = null;
    let previousSettings: Awaited<ReturnType<typeof getConversationSettings>> | null = null;
    if (hasAssignmentReminderUpdate || hasNotificationPrivacyUpdate) {
      settingsConversation = await getConversationById(conversationId);
      if (!settingsConversation) {
        reply.code(404).send({ error: "Conversation not found." });
        return;
      }
      if (hasAssignmentReminderUpdate && settingsConversation.type !== "channel") {
        reply.code(400).send({ error: "Assignment reminders are only available for channels." });
        return;
      }
      previousSettings = await getConversationSettings(conversationId, request.user.sub);
    }

    const muteMinutes = parsed.data.muteMinutes;
    const hasMuteUpdate = muteMinutes !== undefined;
    const mutedUntil = !hasMuteUpdate
      ? undefined
      : muteMinutes === 0
        ? null
        : new Date(Date.now() + muteMinutes * 60 * 1000).toISOString();
    const assignmentReminderSnoozeMinutes = parsed.data.assignmentReminderSnoozeMinutes;
    const hasSnoozeUpdate = assignmentReminderSnoozeMinutes !== undefined;
    const assignmentReminderSnoozedUntil = !hasSnoozeUpdate
      ? undefined
      : assignmentReminderSnoozeMinutes === 0
        ? null
        : new Date(Date.now() + assignmentReminderSnoozeMinutes * 60 * 1000).toISOString();

    const settings = await upsertConversationSettings({
      conversationId,
      userId: request.user.sub,
      mutedUntil,
      setMutedUntil: hasMuteUpdate,
      blocked: parsed.data.blocked,
      mentionNotifications: parsed.data.mentionNotifications,
      assignmentReminderMode: parsed.data.assignmentReminderMode,
      assignmentReminderSnoozedUntil,
      setAssignmentReminderSnoozedUntil: hasSnoozeUpdate,
      assignmentOverdueRepeatHours: parsed.data.assignmentOverdueRepeatHours,
      channelEventNotifications: parsed.data.channelEventNotifications,
      messageUpdateNotifications: parsed.data.messageUpdateNotifications,
      sharePresence: parsed.data.sharePresence,
      shareTyping: parsed.data.shareTyping,
      shareReadReceipts: parsed.data.shareReadReceipts,
    });
    if ((hasAssignmentReminderUpdate || hasNotificationPrivacyUpdate) && settingsConversation?.type === "channel" && settings) {
      if (hasAssignmentReminderUpdate) {
        const beforeReminderMode = previousSettings?.assignment_reminder_mode ?? "72h";
        const beforeSnoozedUntil = normalizeIsoTimestamp(
          previousSettings?.assignment_reminder_snoozed_until ?? null
        );
        const beforeOverdueRepeatHours = Number(previousSettings?.assignment_overdue_repeat_hours ?? 24);

        const afterReminderMode = settings.assignment_reminder_mode;
        const afterSnoozedUntil = normalizeIsoTimestamp(settings.assignment_reminder_snoozed_until);
        const afterOverdueRepeatHours = Number(settings.assignment_overdue_repeat_hours ?? 24);

        const changedFields: string[] = [];
        if (beforeReminderMode !== afterReminderMode) {
          changedFields.push("assignmentReminderMode");
        }
        if (beforeSnoozedUntil !== afterSnoozedUntil) {
          changedFields.push("assignmentReminderSnoozedUntil");
        }
        if (beforeOverdueRepeatHours !== afterOverdueRepeatHours) {
          changedFields.push("assignmentOverdueRepeatHours");
        }

        if (changedFields.length > 0) {
          await createMessageActivityEvent({
            conversationId,
            actorId: request.user.sub,
            eventType: "channel_reminder_settings_updated",
            metadata: {
              changedFields,
              before: {
                assignmentReminderMode: beforeReminderMode,
                assignmentReminderSnoozedUntil: beforeSnoozedUntil,
                assignmentOverdueRepeatHours: beforeOverdueRepeatHours,
              },
              after: {
                assignmentReminderMode: afterReminderMode,
                assignmentReminderSnoozedUntil: afterSnoozedUntil,
                assignmentOverdueRepeatHours: afterOverdueRepeatHours,
              },
            },
          });
        }
      }

      if (hasNotificationPrivacyUpdate) {
        const beforeChannelEventNotifications = previousSettings?.channel_event_notifications ?? true;
        const beforeMessageUpdateNotifications = previousSettings?.message_update_notifications ?? true;
        const beforeSharePresence = previousSettings?.share_presence ?? true;
        const beforeShareTyping = previousSettings?.share_typing ?? true;
        const beforeShareReadReceipts = previousSettings?.share_read_receipts ?? true;

        const afterChannelEventNotifications = settings.channel_event_notifications ?? true;
        const afterMessageUpdateNotifications = settings.message_update_notifications ?? true;
        const afterSharePresence = settings.share_presence ?? true;
        const afterShareTyping = settings.share_typing ?? true;
        const afterShareReadReceipts = settings.share_read_receipts ?? true;

        const changedFields: string[] = [];
        if (beforeChannelEventNotifications !== afterChannelEventNotifications) {
          changedFields.push("channelEventNotifications");
        }
        if (beforeMessageUpdateNotifications !== afterMessageUpdateNotifications) {
          changedFields.push("messageUpdateNotifications");
        }
        if (beforeSharePresence !== afterSharePresence) {
          changedFields.push("sharePresence");
        }
        if (beforeShareTyping !== afterShareTyping) {
          changedFields.push("shareTyping");
        }
        if (beforeShareReadReceipts !== afterShareReadReceipts) {
          changedFields.push("shareReadReceipts");
        }

        if (changedFields.length > 0) {
          await createMessageActivityEvent({
            conversationId,
            actorId: request.user.sub,
            eventType: "channel_notification_settings_updated",
            metadata: {
              changedFields,
              before: {
                channelEventNotifications: beforeChannelEventNotifications,
                messageUpdateNotifications: beforeMessageUpdateNotifications,
                sharePresence: beforeSharePresence,
                shareTyping: beforeShareTyping,
                shareReadReceipts: beforeShareReadReceipts,
              },
              after: {
                channelEventNotifications: afterChannelEventNotifications,
                messageUpdateNotifications: afterMessageUpdateNotifications,
                sharePresence: afterSharePresence,
                shareTyping: afterShareTyping,
                shareReadReceipts: afterShareReadReceipts,
              },
            },
          });
        }
      }
    }
    reply.send({ settings });
  });

  app.post(
    "/messages/messages/:id/report",
    { preHandler: requireAuth, config: { rateLimit: MESSAGE_REPORT_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = reportMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const messageId = (request.params as { id: string }).id;
      const message = await getMessageById(messageId);
      if (!message) {
        reply.code(404).send({ error: "Message not found" });
        return;
      }
      const allowed = await requireConversationParticipant(message.conversation_id, request.user.sub, reply);
      if (!allowed) return;

      if (message.sender_id === request.user.sub) {
        reply.code(400).send({ error: "You cannot report your own message." });
        return;
      }

      const reason = parsed.data.reason.trim();
      await createMessageReport(messageId, request.user.sub, reason);
      await addTrustEvent({
        actorId: message.sender_id,
        sessionId: null,
        type: "abuse",
        severity: "medium",
        metadata: {
          source: "message_report",
          messageId,
          conversationId: message.conversation_id,
          reason,
          reporterId: request.user.sub,
          targetUserId: message.sender_id,
        },
      });

      const participants = await getParticipantIds(message.conversation_id);
      await publishEvent({
        event: "moderation",
        conversationId: message.conversation_id,
        participants,
        userId: request.user.sub,
        kind: "message_reported",
        messageId,
      });

      reply.send({ ok: true });
    }
  );

  app.post(
    "/messages/users/:id/report",
    { preHandler: requireAuth, config: { rateLimit: USER_REPORT_RATE_LIMIT } },
    async (request, reply) => {
      const parsedParams = reportUserParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid user id." });
        return;
      }
      const parsedBody = reportUserSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const targetUserId = parsedParams.data.id;
      if (targetUserId === request.user.sub) {
        reply.code(400).send({ error: "You cannot report yourself." });
        return;
      }

      const targetUser = await findUserById(targetUserId);
      if (!targetUser) {
        reply.code(404).send({ error: "User not found." });
        return;
      }

      const reason = parsedBody.data.reason.trim();
      const conversationId = parsedBody.data.conversationId ?? null;
      const messageId = parsedBody.data.messageId ?? null;
      if (!conversationId && !messageId) {
        reply.code(400).send({ error: "Report context is required (conversationId or messageId)." });
        return;
      }

      let resolvedConversationId: string | null = conversationId;
      if (conversationId) {
        const participant = await requireConversationParticipant(conversationId, request.user.sub, reply);
        if (!participant) return;
        const targetInConversation = await isParticipant(conversationId, targetUserId);
        if (!targetInConversation) {
          reply.code(400).send({ error: "Reported user is not part of this conversation." });
          return;
        }
      }

      if (messageId) {
        const message = await getMessageById(messageId);
        if (!message) {
          reply.code(404).send({ error: "Message not found." });
          return;
        }
        if (message.sender_id !== targetUserId) {
          reply.code(400).send({ error: "Reported message does not belong to the reported user." });
          return;
        }
        const participant = await requireConversationParticipant(message.conversation_id, request.user.sub, reply);
        if (!participant) return;
        if (resolvedConversationId && resolvedConversationId !== message.conversation_id) {
          reply.code(400).send({ error: "Message and conversation context do not match." });
          return;
        }
        resolvedConversationId = message.conversation_id;
      }

      const event = await addTrustEvent({
        actorId: targetUserId,
        sessionId: null,
        type: "abuse",
        severity: "medium",
        metadata: {
          source: "user_report",
          reason,
          reporterId: request.user.sub,
          targetUserId,
          conversationId: resolvedConversationId,
          messageId,
        },
      });

      reply.code(201).send({ ok: true, eventId: event?.id ?? null });
    }
  );

  app.post(
    "/messages/messages/:id/forward",
    { preHandler: requireAuth, config: { rateLimit: MESSAGE_FORWARD_RATE_LIMIT } },
    async (request, reply) => {
      const parsedParams = messageIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid message id." });
        return;
      }
      const parsedBody = forwardMessageSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
        return;
      }

      const sourceMessage = await getMessageById(parsedParams.data.id);
      if (!sourceMessage) {
        reply.code(404).send({ error: "Message not found." });
        return;
      }
      const allowedSource = await requireConversationParticipant(
        sourceMessage.conversation_id,
        request.user.sub,
        reply
      );
      if (!allowedSource) return;

      const targetConversationId = parsedBody.data.targetConversationId;
      const allowedTarget = await requireConversationParticipant(targetConversationId, request.user.sub, reply);
      if (!allowedTarget) return;
      const canPost = await ensureConversationCanPost(targetConversationId, request.user.sub, reply);
      if (!canPost) return;

      const targetSettings = await getConversationSettings(targetConversationId, request.user.sub);
      if (targetSettings?.blocked) {
        reply.code(403).send({ error: "Conversation is blocked for this account." });
        return;
      }

      const targetDirectPeerAllowed = await ensureDirectPeerMessagingAllowed(
        targetConversationId,
        request.user.sub,
        reply
      );
      if (!targetDirectPeerAllowed) return;

      const rawNote = parsedBody.data.note?.trim() || "";
      const noteDetection = rawNote ? await applyOffPlatformPolicy(request.user.sub, rawNote) : null;
      const safeNote = noteDetection ? noteDetection.redacted : rawNote;
      const sourceSenderName =
        sourceMessage.sender_id === request.user.sub ? "you" : sourceMessage.sender_name || "participant";
      const messageBody = composeForwardMessageBody({
        sourceSenderName,
        sourceBody: sourceMessage.body,
        note: safeNote || undefined,
      });

      const mentionHandles = extractMentionHandles(messageBody);
      const mentionTargets = mentionHandles.length
        ? await resolveMentionTargets(targetConversationId, mentionHandles)
        : [];
      const mentionUserIds = mentionTargets
        .map((target) => target.user_id)
        .filter((userId) => userId !== request.user.sub);

      const message = await createMessage(targetConversationId, request.user.sub, messageBody, {
        mentionUserIds,
      });
      await touchConversationPresence({
        conversationId: targetConversationId,
        userId: request.user.sub,
        touchActive: true,
      });

      const messagePayload = {
        ...message,
        attachments: [] as MessageAttachmentRecord[],
      };
      const participants = await getParticipantIds(targetConversationId);
      await publishMessage({
        event: "message",
        conversationId: targetConversationId,
        message: messagePayload,
        participants,
      });
      invalidateSocialDiscoveryForUsers(participants);
      invalidateDashboardForUsers(participants);
      invalidateDashboardGlobally();

      reply.send({
        ok: true,
        message: messagePayload,
        warning: noteDetection?.flagged
          ? "Your forward note contained off-platform contact info and was redacted."
          : undefined,
      });
    }
  );

  app.post("/messages/conversations/:id/participants", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }
    const parsedBody = addParticipantSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid participant payload.", details: parsedBody.error.flatten() });
      return;
    }

    const conversationId = parsedParams.data.id;
    const targetUserId = parsedBody.data.userId;
    if (targetUserId === request.user.sub) {
      reply.code(400).send({ error: "You are already part of this conversation." });
      return;
    }

    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }
    if (conversation.type === "direct") {
      reply.code(400).send({ error: "Direct conversations cannot add participants." });
      return;
    }

    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      reply.code(404).send({ error: "User not found." });
      return;
    }

    const blocked = await hasBlockedRelationship(request.user.sub, targetUserId);
    if (blocked) {
      reply.code(403).send({ error: "Messaging is not available for this user." });
      return;
    }

    let role: ConversationParticipantRole = "member";
    if (conversation.type === "channel") {
      const actorRole = await getConversationParticipantRole(conversationId, request.user.sub);
      if (actorRole !== "owner" && actorRole !== "editor") {
        reply.code(403).send({ error: "Only channel owners or editors can invite participants." });
        return;
      }

      const requestedRole = parsedBody.data.role ?? "editor";
      if (requestedRole === "owner" && actorRole !== "owner") {
        reply.code(403).send({ error: "Only channel owners can grant owner access." });
        return;
      }
      role = requestedRole;
    }

    const alreadyParticipant = await isParticipant(conversationId, targetUserId);
    if (alreadyParticipant) {
      const participants = await listConversationParticipants(conversationId);
      reply.send({ ok: true, added: false, participants });
      return;
    }

    await addParticipant(conversationId, targetUserId, role);
    await createMessageActivityEvent({
      conversationId,
      actorId: request.user.sub,
      eventType: "participant_added",
      metadata: {
        targetUserId,
        targetUserName: displayNameForUser(targetUser),
        role,
      },
    });
    const participants = await listConversationParticipants(conversationId);
    const participantIds = participants.map((participant) => participant.user_id);
    await publishEvent({
      event: "participant",
      conversationId,
      participants: participantIds,
      actorId: request.user.sub,
      targetUserId,
      action: "added",
      role,
    });
    invalidateSocialDiscoveryForUsers(participantIds);
    reply.code(201).send({
      ok: true,
      added: true,
      participant: {
        userId: targetUserId,
        role,
      },
      participants,
    });
  });

  app.delete(
    "/messages/conversations/:id/participants/:userId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = participantRoleParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid params", details: parsedParams.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const targetUserId = parsedParams.data.userId;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;

      const conversation = await getConversationById(conversationId);
      if (!conversation) {
        reply.code(404).send({ error: "Conversation not found." });
        return;
      }
      if (conversation.type === "direct") {
        reply.code(400).send({ error: "Direct conversations cannot remove participants." });
        return;
      }

      const targetRole = await getConversationParticipantRole(conversationId, targetUserId);
      if (!targetRole) {
        reply.code(404).send({ error: "Participant not found in this conversation." });
        return;
      }

      const isSelf = targetUserId === request.user.sub;
      if (conversation.type === "channel") {
        const actorRole = await getConversationParticipantRole(conversationId, request.user.sub);
        if (!actorRole) {
          reply.code(403).send({ error: "Access denied" });
          return;
        }

        if (!isSelf && actorRole !== "owner" && actorRole !== "editor") {
          reply.code(403).send({ error: "Only channel owners or editors can remove participants." });
          return;
        }
        if (actorRole === "editor" && targetRole === "owner") {
          reply.code(403).send({ error: "Editors cannot remove channel owners." });
          return;
        }

        if (targetRole === "owner") {
          const ownerCount = await countConversationParticipantsByRole(conversationId, "owner");
          if (ownerCount <= 1) {
            reply.code(400).send({ error: "Channels must keep at least one owner." });
            return;
          }
        }
      } else if (!isSelf) {
        reply.code(403).send({ error: "Group members can only remove themselves." });
        return;
      }

      const existingParticipants = await listConversationParticipants(conversationId);
      if (existingParticipants.length <= 1) {
        reply.code(400).send({ error: "Conversation must keep at least one participant." });
        return;
      }
      const targetParticipant = existingParticipants.find(
        (participant) => participant.user_id === targetUserId
      );

      const removed = await removeParticipant(conversationId, targetUserId);
      if (!removed) {
        reply.code(404).send({ error: "Participant not found in this conversation." });
        return;
      }

      await createMessageActivityEvent({
        conversationId,
        actorId: request.user.sub,
        eventType: isSelf ? "participant_left" : "participant_removed",
        metadata: {
          targetUserId,
          targetUserName: targetParticipant?.name || null,
          role: removed.role,
        },
      });

      const participants = await listConversationParticipants(conversationId);
      const participantIds = Array.from(
        new Set([...participants.map((participant) => participant.user_id), targetUserId])
      );
      await publishEvent({
        event: "participant",
        conversationId,
        participants: participantIds,
        actorId: request.user.sub,
        targetUserId,
        action: isSelf ? "left" : "removed",
        role: removed.role,
      });
      invalidateSocialDiscoveryForUsers(participantIds);

      reply.send({
        ok: true,
        removed: true,
        action: isSelf ? "left" : "removed",
        participants,
      });
    }
  );

  app.post("/messages/conversations/:id/leave", { preHandler: requireAuth }, async (request, reply) => {
    const parsedParams = conversationIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid conversation id." });
      return;
    }

    const conversationId = parsedParams.data.id;
    const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
    if (!allowed) return;

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }
    if (conversation.type === "direct") {
      reply.code(400).send({ error: "Direct conversations cannot be left." });
      return;
    }

    const participantsBefore = await listConversationParticipants(conversationId);
    if (participantsBefore.length <= 1) {
      reply.code(400).send({ error: "Conversation must keep at least one participant." });
      return;
    }

    if (conversation.type === "channel") {
      const actorRole = await getConversationParticipantRole(conversationId, request.user.sub);
      if (actorRole === "owner") {
        const ownerCount = await countConversationParticipantsByRole(conversationId, "owner");
        if (ownerCount <= 1) {
          reply.code(400).send({ error: "Channels must keep at least one owner." });
          return;
        }
      }
    }

    const removed = await removeParticipant(conversationId, request.user.sub);
    if (!removed) {
      reply.code(404).send({ error: "Participant not found in this conversation." });
      return;
    }

    await createMessageActivityEvent({
      conversationId,
      actorId: request.user.sub,
      eventType: "participant_left",
      metadata: {
        targetUserId: request.user.sub,
        role: removed.role,
      },
    });

    const participants = await listConversationParticipants(conversationId);
    const participantIds = Array.from(
      new Set([...participants.map((participant) => participant.user_id), request.user.sub])
    );
    await publishEvent({
      event: "participant",
      conversationId,
      participants: participantIds,
      actorId: request.user.sub,
      targetUserId: request.user.sub,
      action: "left",
      role: removed.role,
    });
    invalidateSocialDiscoveryForUsers(participantIds);

    reply.send({ ok: true, left: true });
  });

  app.put(
    "/messages/conversations/:id/participants/:userId/role",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsedParams = participantRoleParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        reply.code(400).send({ error: "Invalid params", details: parsedParams.error.flatten() });
        return;
      }
      const parsedBody = participantRoleSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: "Invalid role", details: parsedBody.error.flatten() });
        return;
      }

      const conversationId = parsedParams.data.id;
      const targetUserId = parsedParams.data.userId;
      const allowed = await requireConversationParticipant(conversationId, request.user.sub, reply);
      if (!allowed) return;

      const conversation = await getConversationById(conversationId);
      if (!conversation) {
        reply.code(404).send({ error: "Conversation not found." });
        return;
      }
      if (conversation.type !== "channel") {
        reply.code(400).send({ error: "Role management is only available for channels." });
        return;
      }

      const actorRole = await getConversationParticipantRole(conversationId, request.user.sub);
      if (actorRole !== "owner") {
        reply.code(403).send({ error: "Only channel owners can change participant roles." });
        return;
      }

      const targetRole = await getConversationParticipantRole(conversationId, targetUserId);
      if (!targetRole) {
        reply.code(404).send({ error: "Participant not found in this channel." });
        return;
      }

      if (targetUserId === request.user.sub && parsedBody.data.role !== "owner") {
        reply.code(400).send({ error: "You cannot remove your own owner access." });
        return;
      }

      if (targetRole === "owner" && parsedBody.data.role !== "owner") {
        const ownerCount = await countConversationParticipantsByRole(conversationId, "owner");
        if (ownerCount <= 1) {
          reply.code(400).send({ error: "Channels must keep at least one owner." });
          return;
        }
      }

      const updated = await updateConversationParticipantRole(
        conversationId,
        targetUserId,
        parsedBody.data.role
      );
      if (!updated) {
        reply.code(404).send({ error: "Participant not found in this channel." });
        return;
      }

      const participants = await listConversationParticipants(conversationId);
      reply.send({ ok: true, participant: updated, participants });
    }
  );

  app.get("/messages/stream", { preHandler: requireAuth }, async (request, reply) => {
    await initMessageBus();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write("\n");

    const userId = request.user.sub;
    const joinedConversations = await listConversationsForUser(userId);
    for (const conversation of joinedConversations) {
      const actorSettings = await getConversationSettings(conversation.id, userId);
      const touched = await touchConversationPresence({
        conversationId: conversation.id,
        userId,
        isOnline: true,
        touchActive: true,
      });
      if (touched && actorSettings?.share_presence !== false) {
        const participants = await getParticipantIds(conversation.id);
        await publishEvent({
          event: "presence",
          conversationId: conversation.id,
          participants,
          userId,
          isOnline: true,
          lastActiveAt: touched.last_active_at,
        });
      }
    }

    const offMessage = onMessage((payload) => {
      if (!payload.participants.includes(userId)) return;
      reply.raw.write(`event: ${payload.event}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write("event: ping\ndata: {}\n\n");
    }, 25000);

    request.raw.on("close", async () => {
      clearInterval(heartbeat);
      offMessage();
      for (const conversation of joinedConversations) {
        const actorSettings = await getConversationSettings(conversation.id, userId);
        const touched = await touchConversationPresence({
          conversationId: conversation.id,
          userId,
          isOnline: false,
          touchActive: true,
        });
        if (touched && actorSettings?.share_presence !== false) {
          const participants = await getParticipantIds(conversation.id);
          await publishEvent({
            event: "presence",
            conversationId: conversation.id,
            participants,
            userId,
            isOnline: false,
            lastActiveAt: touched.last_active_at,
          });
        }
      }
    });
  });

  app.post("/messages/conversations/:id/join", { preHandler: requireAuth }, async (request, reply) => {
    const conversationId = (request.params as { id: string }).id;
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      reply.code(404).send({ error: "Conversation not found." });
      return;
    }
    const role: ConversationParticipantRole = conversation.type === "channel" ? "viewer" : "member";
    const alreadyParticipant = await isParticipant(conversationId, request.user.sub);
    if (alreadyParticipant) {
      reply.send({ ok: true, joined: false });
      return;
    }
    await addParticipant(conversationId, request.user.sub, role);
    await createMessageActivityEvent({
      conversationId,
      actorId: request.user.sub,
      eventType: "participant_added",
      metadata: {
        targetUserId: request.user.sub,
        role,
      },
    });
    const participants = await listConversationParticipants(conversationId);
    await publishEvent({
      event: "participant",
      conversationId,
      participants: participants.map((participant) => participant.user_id),
      actorId: request.user.sub,
      targetUserId: request.user.sub,
      action: "added",
      role,
    });
    invalidateSocialDiscoveryForUsers([
      ...participants.map((participant) => participant.user_id),
      request.user.sub,
    ]);
    reply.send({ ok: true, joined: true });
  });
}
