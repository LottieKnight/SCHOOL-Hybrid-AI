import { EventEmitter } from "node:events";
import { Redis } from "ioredis";
import { config } from "../config.js";
import type { AssignmentReminderKind, MessageRecord } from "../db/messages.js";

type EventBase = {
  conversationId: string;
  participants: string[];
  event:
    | "message"
    | "message_update"
    | "typing"
    | "read"
    | "presence"
    | "moderation"
    | "pin"
    | "archive"
    | "participant"
    | "conversation"
    | "assignment_reminder";
};

export type MessageBusPayload = EventBase & {
  event: "message";
  message: MessageRecord;
};

export type TypingBusPayload = EventBase & {
  event: "typing";
  userId: string;
  isTyping: boolean;
  at: string;
};

export type ReadBusPayload = EventBase & {
  event: "read";
  userId: string;
  readAt: string;
};

export type PresenceBusPayload = EventBase & {
  event: "presence";
  userId: string;
  isOnline: boolean;
  lastActiveAt: string;
};

export type ModerationBusPayload = EventBase & {
  event: "moderation";
  userId: string;
  kind: "message_reported";
  messageId: string;
};

export type PinBusPayload = EventBase & {
  event: "pin";
  userId: string;
  pinned: boolean;
  message: MessageRecord;
};

export type ArchiveBusPayload = EventBase & {
  event: "archive";
  userId: string;
  archived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
};

export type ParticipantBusPayload = EventBase & {
  event: "participant";
  actorId: string;
  targetUserId: string;
  action: "added" | "removed" | "left";
  role?: "owner" | "editor" | "viewer" | "member" | "tutor" | "student" | null;
};

type ChannelConversationPayload = {
  id: string;
  name: string;
  type: "group" | "direct" | "channel";
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
  assignment_title: string | null;
  assignment_description: string | null;
  assignment_due_at: string | null;
  assignment_template: Record<string, unknown> | null;
};

export type ConversationBusPayload = EventBase & {
  event: "conversation";
  userId: string;
  kind: "channel_details_updated";
  conversation: ChannelConversationPayload;
};

export type MessageUpdateBusPayload = EventBase & {
  event: "message_update";
  userId: string;
  kind: "edited" | "deleted" | "reaction";
  emoji?: string;
  reacted?: boolean;
  message: MessageRecord;
};

export type AssignmentReminderBusPayload = EventBase & {
  event: "assignment_reminder";
  userId: string;
  conversationName: string;
  assignmentTitle: string | null;
  assignmentDueAt: string;
  reminderKind: AssignmentReminderKind;
};

export type MessageBusEvent =
  | MessageBusPayload
  | MessageUpdateBusPayload
  | TypingBusPayload
  | ReadBusPayload
  | PresenceBusPayload
  | ModerationBusPayload
  | PinBusPayload
  | ArchiveBusPayload
  | ParticipantBusPayload
  | ConversationBusPayload
  | AssignmentReminderBusPayload;

const CHANNEL = "saedu:messages";
const emitter = new EventEmitter();
emitter.setMaxListeners(200);

let initialized = false;
let redisEnabled = false;
let publisher: Redis | null = null;
let subscriber: Redis | null = null;

const createRedis = () =>
  new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

export async function initMessageBus() {
  if (initialized) return;
  initialized = true;

  if (config.env === "test") {
    redisEnabled = false;
    return;
  }

  try {
    publisher = createRedis();
    subscriber = createRedis();

    await subscriber.connect();
    await publisher.connect();

    await subscriber.subscribe(CHANNEL);
    subscriber.on("message", (channel, message) => {
      if (channel !== CHANNEL) return;
      try {
        const payload = JSON.parse(message) as MessageBusEvent;
        emitter.emit("message", payload);
      } catch {
        // ignore malformed payloads
      }
    });

    subscriber.on("error", () => {
      redisEnabled = false;
    });
    publisher.on("error", () => {
      redisEnabled = false;
    });

    redisEnabled = true;
  } catch {
    redisEnabled = false;
    publisher?.disconnect();
    subscriber?.disconnect();
    console.warn("Redis pub/sub unavailable, falling back to local emitter.");
  }
}

export async function publishMessage(payload: MessageBusPayload) {
  return publishEvent(payload);
}

export async function publishEvent(payload: MessageBusEvent) {
  await initMessageBus();
  if (redisEnabled && publisher) {
    try {
      await publisher.publish(CHANNEL, JSON.stringify(payload));
      return;
    } catch {
      redisEnabled = false;
    }
  }
  emitter.emit("message", payload);
}

export function onMessage(handler: (payload: MessageBusEvent) => void) {
  emitter.on("message", handler);
  return () => emitter.off("message", handler);
}
