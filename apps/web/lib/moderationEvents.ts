export type ModerationEventType = "off_platform_attempt" | "fraud_flag" | "abuse";
export type ModerationEventSeverity = "low" | "medium" | "high";
export type ModerationEventTypeFilter = "all" | ModerationEventType;
export type ModerationEventSeverityFilter = "all" | ModerationEventSeverity;

export type ModerationEventTarget = {
  conversationId: string | null;
  messageId: string | null;
  sessionId: string | null;
};

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function getModerationTypeLabel(type: ModerationEventType) {
  if (type === "off_platform_attempt") return "Off-platform attempt";
  if (type === "fraud_flag") return "Fraud flag";
  return "Abuse report";
}

export function getModerationSeverityLabel(severity: ModerationEventSeverity) {
  if (severity === "high") return "High severity";
  if (severity === "medium") return "Medium severity";
  return "Low severity";
}

export function getModerationEventTarget(input: {
  metadata?: Record<string, unknown> | null;
  sessionId?: string | null;
}): ModerationEventTarget {
  return {
    conversationId: readMetadataString(input.metadata, "conversationId", "conversation_id"),
    messageId: readMetadataString(input.metadata, "messageId", "message_id"),
    sessionId:
      typeof input.sessionId === "string" && input.sessionId.trim().length > 0
        ? input.sessionId.trim()
        : null,
  };
}
