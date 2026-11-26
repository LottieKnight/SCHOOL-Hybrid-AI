import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const getGenerativeModel = vi.fn();

vi.mock("firebase/ai", () => ({
  InferenceMode: {
    PREFER_ON_DEVICE: "prefer_on_device",
    ONLY_ON_DEVICE: "only_on_device",
    ONLY_IN_CLOUD: "only_in_cloud",
    PREFER_IN_CLOUD: "prefer_in_cloud",
  },
  InferenceSource: {
    ON_DEVICE: "on_device",
    IN_CLOUD: "in_cloud",
  },
  GoogleAIBackend: class GoogleAIBackend {},
  getAI: vi.fn(() => ({ name: "ai" })),
  getGenerativeModel: (...args: unknown[]) => getGenerativeModel(...args),
}));

import { formatInferenceSource } from "../lib/hybridTutor/display";
import { canRevealFinalAnswer, projectHintView } from "../lib/hybridTutor/hintGate";
import { applyMasteryEvent, masteryLabel } from "../lib/hybridTutor/mastery";
import { planOfflineHelp } from "../lib/hybridTutor/offline";
import { normalizeHint, parseModelJson } from "../lib/hybridTutor/parse";
import { buildRevisionNote } from "../lib/hybridTutor/revisionNote";
import { DEFAULT_SETTINGS, resolveInference } from "../lib/hybridTutor/routing";
import { runTutorTask } from "../lib/hybridTutor/runTask";
import { enableOnDeviceFromGesture } from "../lib/hybridTutor/hybridModel";
import { estimateSavings, formatSavings, recordInference } from "../lib/hybridTutor/stats";
import { pickWeighted, questionWeight } from "../lib/hybridTutor/sitting";
import { fittedSize } from "../lib/hybridTutor/imageFit";

const hintJson = {
  topic: "Linear functions",
  hints: ["Read the intercept.", "Use gradient times run.", "Substitute x = 2."],
  solution: "y = 3(2) + 1",
  final_answer: "7",
};

beforeEach(() => {
  generateContent.mockReset();
  getGenerativeModel.mockReset();
  getGenerativeModel.mockImplementation((_ai: unknown, params: { mode: string }) => ({
    initializeDeviceModel: vi.fn(),
    generateContent: (parts: unknown) => generateContent(parts, params),
  }));
  generateContent.mockImplementation(async (_parts: unknown, params: { mode: string }) => ({
    response: {
      text: () => JSON.stringify(params.mode === "only_in_cloud" ? { ...hintJson, topic: "Cloud topic" } : hintJson),
      inferenceSource: params.mode === "only_in_cloud" ? "in_cloud" : "on_device",
    },
  }));
});

describe("hybrid inference routing", () => {
  it("keeps a short mark on-device and shows that source", async () => {
    const result = await runTutorTask({
      ai: {} as never,
      settings: DEFAULT_SETTINGS,
      task: "mark",
      answerText: "x = 4",
      parts: ["mark"],
    });
    expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mode: "prefer_on_device" }));
    expect(result.source).toBe("on_device");
    expect(result.display).toBe(formatInferenceSource("on_device"));
    expect(result.display).toContain("on this device");
  });

  it("sends a long learner answer to the cloud", async () => {
    const result = await runTutorTask({
      ai: {} as never,
      settings: { ...DEFAULT_SETTINGS, long_answer_chars: 10 },
      task: "mark",
      answerText: "this answer is definitely longer than ten",
      parts: ["mark"],
    });
    expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mode: "only_in_cloud" }));
    expect(result.source).toBe("in_cloud");
    expect(result.display).toContain("cloud");
  });

  it("sends a PDF plan to the cloud", async () => {
    const result = await runTutorTask({
      ai: {} as never,
      settings: DEFAULT_SETTINGS,
      task: "plan",
      hasPdf: true,
      planDays: 3,
      parts: ["plan"],
    });
    expect(result.reason).toBe("pdf");
    expect(result.mode).toBe("ONLY_IN_CLOUD");
    expect(result.source).toBe("in_cloud");
  });

  it("keeps an offline hint on-device only", () => {
    expect(resolveInference({ task: "hint", offline: true, settings: DEFAULT_SETTINGS })).toMatchObject({
      mode: "ONLY_ON_DEVICE",
      forceCloud: false,
      reason: "offline_hint",
    });
  });

  it("does not call the model when the kill switch is off", async () => {
    await expect(runTutorTask({
      ai: {} as never,
      settings: { ...DEFAULT_SETTINGS, ai_enabled: false },
      task: "hint",
      parts: ["hint"],
    })).rejects.toThrow(/switched off/);
    expect(getGenerativeModel).not.toHaveBeenCalled();
  });

  it("parses a JSON object wrapped in prose", () => {
    const parsed = normalizeHint(parseModelJson(`Here is the ladder:\n${JSON.stringify(hintJson)}\nThanks`));
    expect(parsed.final_answer).toBe("7");
    expect(parsed.hints).toHaveLength(3);
  });
});

describe("hint ladder gate and skill map", () => {
  const full = normalizeHint(hintJson);

  it("hides the final answer until the learner asks after all three hints", () => {
    const first = projectHintView(full, { hintsShown: 1, solutionAsked: false, answerAsked: true });
    expect(first.final_answer).toBeNull();
    expect(first.hints).toEqual([full.hints[0]]);
    expect(canRevealFinalAnswer({ hintsShown: 3, solutionAsked: false, answerAsked: false })).toBe(false);
    const asked = projectHintView(full, { hintsShown: 3, solutionAsked: true, answerAsked: true });
    expect(asked.final_answer).toBe("7");
    expect(asked.solution).toContain("y = 3");
  });

  it("moves mastery from hints, retries and quiz scores", () => {
    let map = applyMasteryEvent({}, { type: "hint", topic: "Gradients", subject: "Maths", depth: 3 });
    expect(map["maths::gradients"].mastery).toBe(34);
    map = applyMasteryEvent(map, { type: "quiz", topic: "Gradients", subject: "Maths", score: 2, outOf: 10 });
    expect(map["maths::gradients"].quizzes).toBe(1);
    expect(map["maths::gradients"].mastery).toBeLessThan(34);
    map = applyMasteryEvent(map, { type: "retry", topic: "Gradients", subject: "Maths" });
    expect(map["maths::gradients"].retries).toBe(1);
    expect(masteryLabel(85)).toBe("Secure");
  });
});

describe("paper sitting, revision notes, offline and stats", () => {
  it("weights a weak topic above an untouched one", () => {
    const weak = questionWeight({ subject: "Mathematics", topicTags: "functions" }, [{ topic: "functions", subject: "Mathematics", mastery: 20 }]);
    const other = questionWeight({ subject: "History", topicTags: "sources" }, [{ topic: "functions", subject: "Mathematics", mastery: 20 }]);
    expect(weak).toBeGreaterThan(other);
    const picked = pickWeighted(
      [
        { id: "low", weight: 1 },
        { id: "high", weight: 10 },
      ],
      1,
      () => 0.5,
    );
    expect(picked[0].id).toBe("high");
  });

  it("links a revision note to the source question and one follow-up", () => {
    const note = buildRevisionNote({
      questionId: "q1",
      questionLabel: "Q1",
      topic: "Newton's laws",
      subject: "Physical Sciences",
      missedSteps: ["free-body diagram"],
      score: 2,
      outOf: 6,
    });
    expect(note.sourceType).toBe("past_paper_question");
    expect(note.sourceId).toBe("q1");
    expect(note.followUp.prompt).toContain("Newton's laws");
    expect(note.body).toContain("free-body diagram");
    expect(note.followUp.href).toContain("/tutor?mode=hints");
  });

  it("keeps hints on-device offline and falls back to a saved topic or the offline page", () => {
    expect(planOfflineHelp({ offline: true, onDeviceReady: true, hasCachedTopic: false, hasOpenedLessons: false, task: "hint" }).mode).toBe("on_device");
    expect(planOfflineHelp({ offline: true, onDeviceReady: false, hasCachedTopic: true, hasOpenedLessons: false, task: "mark" }).mode).toBe("cached_topic");
    expect(planOfflineHelp({ offline: true, onDeviceReady: false, hasCachedTopic: false, hasOpenedLessons: false, task: "plan" }).mode).toBe("offline_page");
  });

  it("counts on-device calls and estimates rands at R85/GB", () => {
    const stats = recordInference(recordInference({ onDevice: 0, inCloud: 0 }, "on_device"), "in_cloud");
    expect(stats).toEqual({ onDevice: 1, inCloud: 1 });
    expect(estimateSavings(1).mb).toBe(0.4);
    expect(estimateSavings(1).rands).toBe(0.03);
    expect(formatSavings(2)).toContain("MB");
    expect(formatSavings(2)).toContain("R85/GB");
  });

  it("shrinks a camera photo so the long edge stays within 1280px", () => {
    expect(fittedSize(4000, 3000)).toEqual({ width: 1280, height: 960, scale: 0.32 });
    expect(fittedSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
  });

  it("starts the on-device model from the gesture helper", () => {
    const initializeDeviceModel = vi.fn(async () => undefined);
    void enableOnDeviceFromGesture({ initializeDeviceModel }, () => undefined);
    expect(initializeDeviceModel).toHaveBeenCalledTimes(1);
  });
});
