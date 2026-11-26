import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTopicSignalBody } from "@/lib/sessionTopicSignal";

const storeTopicSignal = vi.fn();
const getBackendSessionFromRequest = vi.fn();

vi.mock("@/lib/server/sessionTopics", () => ({
  storeTopicSignal: (...args: unknown[]) => storeTopicSignal(...args),
}));

vi.mock("@/lib/server/backendSession", () => ({
  getBackendSessionFromRequest: (...args: unknown[]) => getBackendSessionFromRequest(...args),
}));

describe("topic signal parsing", () => {
  it("attributes the signal to the session user, not the body", () => {
    const parsed = parseTopicSignalBody(
      {
        userId: "victim-user",
        sessionId: "sess-1",
        topic: "quadratic equations",
        subject: "Mathematics",
        grade_inferred: 11,
        weakness_detected: true,
        difficulty_level: 4,
      },
      "real-learner",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.userId).toBe("real-learner");
      expect(parsed.value.topic).toBe("quadratic equations");
      expect(parsed.value.weaknessDetected).toBe(true);
    }
  });

  it("rejects a signal with no topic", () => {
    const parsed = parseTopicSignalBody({ sessionId: "sess-1", subject: "Mathematics" }, "real-learner");
    expect(parsed.ok).toBe(false);
  });
});

describe("POST /api/sessions/topics", () => {
  beforeEach(() => {
    storeTopicSignal.mockReset();
    getBackendSessionFromRequest.mockReset();
  });

  it("rejects a caller with no session before writing", async () => {
    getBackendSessionFromRequest.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sessions/topics/route");
    const response = await POST(
      new Request("http://localhost/api/sessions/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "victim-user",
          sessionId: "sess-1",
          topic: "trigonometry",
          subject: "Mathematics",
          weakness_detected: true,
        }),
      }) as never,
    );
    expect(response.status).toBe(401);
    expect(storeTopicSignal).not.toHaveBeenCalled();
  });

  it("stores the signed-in learner even when the body names someone else", async () => {
    getBackendSessionFromRequest.mockResolvedValue({ user: { id: "real-learner" } });
    storeTopicSignal.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/sessions/topics/route");
    const response = await POST(
      new Request("http://localhost/api/sessions/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "victim-user",
          sessionId: "sess-1",
          topic: "trigonometry",
          subject: "Mathematics",
          weakness_detected: true,
          difficulty_level: 2,
        }),
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(storeTopicSignal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "real-learner", topic: "trigonometry" }),
    );
  });
});
