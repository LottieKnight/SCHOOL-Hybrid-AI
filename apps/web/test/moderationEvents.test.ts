import { describe, expect, it } from "vitest";
import {
  getModerationEventTarget,
  getModerationSeverityLabel,
  getModerationTypeLabel,
} from "../lib/moderationEvents";

describe("moderation event helpers", () => {
  it("maps type and severity labels", () => {
    expect(getModerationTypeLabel("off_platform_attempt")).toBe("Off-platform attempt");
    expect(getModerationTypeLabel("fraud_flag")).toBe("Fraud flag");
    expect(getModerationTypeLabel("abuse")).toBe("Abuse report");

    expect(getModerationSeverityLabel("high")).toBe("High severity");
    expect(getModerationSeverityLabel("medium")).toBe("Medium severity");
    expect(getModerationSeverityLabel("low")).toBe("Low severity");
  });

  it("extracts conversation and message targets from camelCase metadata keys", () => {
    expect(
      getModerationEventTarget({
        metadata: {
          conversationId: "00000000-0000-0000-0000-000000000101",
          messageId: "00000000-0000-0000-0000-000000000202",
        },
        sessionId: "00000000-0000-0000-0000-000000000303",
      })
    ).toEqual({
      conversationId: "00000000-0000-0000-0000-000000000101",
      messageId: "00000000-0000-0000-0000-000000000202",
      sessionId: "00000000-0000-0000-0000-000000000303",
    });
  });

  it("supports snake_case metadata keys and trims values", () => {
    expect(
      getModerationEventTarget({
        metadata: {
          conversation_id: " 00000000-0000-0000-0000-000000000404 ",
          message_id: " 00000000-0000-0000-0000-000000000505 ",
        },
        sessionId: "   ",
      })
    ).toEqual({
      conversationId: "00000000-0000-0000-0000-000000000404",
      messageId: "00000000-0000-0000-0000-000000000505",
      sessionId: null,
    });
  });

  it("returns null targets when metadata is missing or invalid", () => {
    expect(
      getModerationEventTarget({
        metadata: { conversationId: 123, message_id: "" },
      })
    ).toEqual({
      conversationId: null,
      messageId: null,
      sessionId: null,
    });
  });
});
