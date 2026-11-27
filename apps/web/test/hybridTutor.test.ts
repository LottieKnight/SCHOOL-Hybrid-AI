import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const getGenerativeModel = vi.fn();

const firebaseHarness = vi.hoisted(() => {
  class GoogleAIBackend {}
  const apps: Array<{ name: string; options: Record<string, string> }> = [];
  return {
    apps,
    GoogleAIBackend,
    initializeApp: vi.fn((options: Record<string, string>, name?: string) => {
      const appName = name ?? "[DEFAULT]";
      if (apps.some((app) => app.name === appName)) {
        throw new Error(`Firebase App named '${appName}' already exists`);
      }
      const app = { name: appName, options: { ...options } };
      apps.push(app);
      return app;
    }),
    getApps: vi.fn(() => apps),
    getApp: vi.fn((name?: string) => {
      const appName = name ?? "[DEFAULT]";
      const found = apps.find((app) => app.name === appName);
      if (!found) throw new Error(`No Firebase App '${appName}' has been created`);
      return found;
    }),
    initializeAppCheck: vi.fn(),
    getAI: vi.fn(() => ({ name: "ai" })),
  };
});

vi.mock("firebase/app", () => ({
  initializeApp: firebaseHarness.initializeApp,
  getApps: firebaseHarness.getApps,
  getApp: firebaseHarness.getApp,
}));

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: firebaseHarness.initializeAppCheck,
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {
    siteKey: string;
    constructor(siteKey: string) {
      this.siteKey = siteKey;
    }
  },
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getFirestore: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("firebase/remote-config", () => ({
  fetchAndActivate: vi.fn(),
  getRemoteConfig: vi.fn(),
  getValue: vi.fn(),
}));

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
  GoogleAIBackend: firebaseHarness.GoogleAIBackend,
  getAI: firebaseHarness.getAI,
  getGenerativeModel: (...args: unknown[]) => getGenerativeModel(...args),
}));

import { readPublicFirebaseAiConfig } from "../lib/hybridTutor/config";
import { formatInferenceSource } from "../lib/hybridTutor/display";
import { canRevealFinalAnswer, projectHintView } from "../lib/hybridTutor/hintGate";
import { applyMasteryEvent, masteryLabel } from "../lib/hybridTutor/mastery";
import { planOfflineHelp } from "../lib/hybridTutor/offline";
import { normalizeHint, parseModelJson } from "../lib/hybridTutor/parse";
import { buildRevisionNote } from "../lib/hybridTutor/revisionNote";
import { CLOUD_MODEL, DEFAULT_SETTINGS, resolveCloudModel, resolveInference } from "../lib/hybridTutor/routing";
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

  it("replaces a retired cloud model, including the published Remote Config id", async () => {
    expect(DEFAULT_SETTINGS.cloud_model).toBe(CLOUD_MODEL);
    expect(resolveCloudModel("gemini-2.5-flash")).toBe("gemini-3.5-flash-lite");
    expect(resolveCloudModel("models/gemini-2.5-flash")).toBe("gemini-3.5-flash-lite");
    expect(resolveCloudModel("gemini-2.5-flash-lite")).toBe("gemini-3.5-flash-lite");
    expect(resolveCloudModel("gemini-3.0-flash")).toBe("gemini-3.5-flash-lite");
    expect(resolveCloudModel("")).toBe("gemini-3.5-flash-lite");
    expect(resolveCloudModel("gemini-3.8-flash")).toBe("gemini-3.8-flash");
    expect(resolveCloudModel("gemini-4-hydrogen")).toBe("gemini-4-hydrogen");

    await runTutorTask({
      ai: {} as never,
      settings: { ...DEFAULT_SETTINGS, cloud_model: "gemini-2.5-flash" },
      task: "hint",
      parts: ["What is magnetism"],
    });
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inCloudParams: expect.objectContaining({ model: "gemini-3.5-flash-lite" }),
      }),
    );
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

const PRIMARY_FIREBASE_ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "primary-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "school-academic-platform7.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "school-academic-platform7",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "school-academic-platform7.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "815118418593",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:815118418593:web:primary",
  NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY: "primary-recaptcha-key",
} as const;

const AI_FIREBASE_ENV = {
  NEXT_PUBLIC_FIREBASE_AI_API_KEY: "ai-api-key",
  NEXT_PUBLIC_FIREBASE_AI_AUTH_DOMAIN: "gen-lang-client-0473613289.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_AI_PROJECT_ID: "gen-lang-client-0473613289",
  NEXT_PUBLIC_FIREBASE_AI_STORAGE_BUCKET: "gen-lang-client-0473613289.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_AI_MESSAGING_SENDER_ID: "50998990926",
  NEXT_PUBLIC_FIREBASE_AI_APP_ID: "1:50998990926:web:ai",
} as const;

const FIREBASE_ENV_KEYS = [
  ...Object.keys(PRIMARY_FIREBASE_ENV),
  ...Object.keys(AI_FIREBASE_ENV),
  "NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN",
  "NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_SITE_KEY",
  "NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_DEBUG_TOKEN",
];

function applyFirebaseEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

function clearFirebaseEnv() {
  for (const key of FIREBASE_ENV_KEYS) delete process.env[key];
}

function appCheckCalls() {
  return firebaseHarness.initializeAppCheck.mock.calls.map((call) => {
    const app = call[0] as { name: string; options: { projectId: string } };
    const options = call[1] as { provider: { siteKey: string } };
    return { name: app.name, projectId: app.options.projectId, siteKey: options.provider.siteKey };
  });
}

async function loadTutorClient() {
  return import("../lib/hybridTutor/client");
}

describe("secondary Firebase project for tutor AI", () => {
  beforeEach(() => {
    firebaseHarness.apps.length = 0;
    firebaseHarness.initializeApp.mockClear();
    firebaseHarness.getApp.mockClear();
    firebaseHarness.getApps.mockClear();
    firebaseHarness.initializeAppCheck.mockClear();
    firebaseHarness.getAI.mockClear();
    clearFirebaseEnv();
    applyFirebaseEnv(PRIMARY_FIREBASE_ENV);
    vi.resetModules();
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearFirebaseEnv();
  });

  it("uses the secondary app for getAI and keeps App Check on the primary project", async () => {
    applyFirebaseEnv(AI_FIREBASE_ENV);
    const config = readPublicFirebaseAiConfig();
    expect(config.dedicated).toBe(true);
    expect(config.ok).toBe(true);
    expect(config.config).toMatchObject({
      apiKey: "ai-api-key",
      authDomain: "gen-lang-client-0473613289.firebaseapp.com",
      projectId: "gen-lang-client-0473613289",
      storageBucket: "gen-lang-client-0473613289.firebasestorage.app",
      messagingSenderId: "50998990926",
      appId: "1:50998990926:web:ai",
    });

    const client = await loadTutorClient();
    expect(client.TUTOR_AI_APP_NAME).toBe("tutor-ai");
    const primary = client.getFirebaseApp();
    client.getTutorAi(primary);

    const [aiApp, aiOptions] = firebaseHarness.getAI.mock.calls[0];
    expect(aiApp).toMatchObject({
      name: "tutor-ai",
      options: expect.objectContaining({ projectId: "gen-lang-client-0473613289", apiKey: "ai-api-key" }),
    });
    expect(aiOptions).toEqual({ backend: expect.any(firebaseHarness.GoogleAIBackend) });
    expect(aiApp).not.toBe(primary);
    expect(appCheckCalls()).toEqual([
      { name: "[DEFAULT]", projectId: "school-academic-platform7", siteKey: "primary-recaptcha-key" },
    ]);
  });

  it("falls back to the primary app when the AI env vars are unset", async () => {
    const config = readPublicFirebaseAiConfig();
    expect(config.dedicated).toBe(false);
    expect(config.ok).toBe(true);
    expect(config.config.projectId).toBe("school-academic-platform7");
    expect(config.config.apiKey).toBe("primary-api-key");

    const client = await loadTutorClient();
    const primary = client.getFirebaseApp();
    expect(client.getTutorAiFirebaseApp()).toBe(primary);
    client.getTutorAi();

    expect(firebaseHarness.getAI).toHaveBeenCalledWith(primary, {
      backend: expect.any(firebaseHarness.GoogleAIBackend),
    });
    expect(firebaseHarness.apps.map((app) => app.name)).toEqual(["[DEFAULT]"]);
    expect(appCheckCalls()).toEqual([
      { name: "[DEFAULT]", projectId: "school-academic-platform7", siteKey: "primary-recaptcha-key" },
    ]);
  });

  it("does not mint the primary App Check token for the secondary app", async () => {
    applyFirebaseEnv(AI_FIREBASE_ENV);
    const client = await loadTutorClient();
    const aiApp = client.getTutorAiFirebaseApp();
    client.initAppCheck(aiApp);
    const primary = client.getFirebaseApp();
    client.initAppCheck(primary);
    expect(appCheckCalls()).toEqual([
      { name: "[DEFAULT]", projectId: "school-academic-platform7", siteKey: "primary-recaptcha-key" },
    ]);
  });

  it("starts App Check on the secondary app only with an AI-specific site key", async () => {
    applyFirebaseEnv(AI_FIREBASE_ENV);
    process.env.NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_SITE_KEY = "ai-recaptcha-key";
    const client = await loadTutorClient();
    client.getTutorAi();
    client.getTutorAi();
    expect(firebaseHarness.getAI).toHaveBeenCalledTimes(1);
    expect(appCheckCalls()).toEqual([
      { name: "[DEFAULT]", projectId: "school-academic-platform7", siteKey: "primary-recaptcha-key" },
      { name: "tutor-ai", projectId: "gen-lang-client-0473613289", siteKey: "ai-recaptcha-key" },
    ]);
  });

  it("keeps the primary app when the named AI app was created first", async () => {
    applyFirebaseEnv(AI_FIREBASE_ENV);
    const client = await loadTutorClient();
    const aiApp = client.getTutorAiFirebaseApp();
    const primary = client.getFirebaseApp();
    expect(aiApp.name).toBe("tutor-ai");
    expect(aiApp.options.projectId).toBe("gen-lang-client-0473613289");
    expect(primary.name).toBe("[DEFAULT]");
    expect(primary.options.projectId).toBe("school-academic-platform7");
    expect(primary).not.toBe(aiApp);
  });

  it("refuses a partial AI config instead of mixing the two projects", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_AI_PROJECT_ID = "gen-lang-client-0473613289";
    const config = readPublicFirebaseAiConfig();
    expect(config.dedicated).toBe(true);
    expect(config.ok).toBe(false);
    expect(config.missing).toEqual([
      "NEXT_PUBLIC_FIREBASE_AI_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AI_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_AI_APP_ID",
    ]);
    const client = await loadTutorClient();
    expect(() => client.getTutorAi()).toThrow(/Firebase AI is not configured/);
    expect(firebaseHarness.getAI).not.toHaveBeenCalled();
    expect(firebaseHarness.apps.some((app) => app.name === "tutor-ai")).toBe(false);
  });

  it("skips App Check during server render and still targets the secondary project", async () => {
    applyFirebaseEnv(AI_FIREBASE_ENV);
    vi.unstubAllGlobals();
    const client = await loadTutorClient();
    expect(() => client.getTutorAi()).not.toThrow();
    expect(firebaseHarness.initializeAppCheck).not.toHaveBeenCalled();
    expect(firebaseHarness.getAI.mock.calls[0][0].options.projectId).toBe("gen-lang-client-0473613289");
  });

  it("publishes the secondary AI web config next to the primary production config", () => {
    const production = readFileSync(join(__dirname, "..", ".env.production"), "utf8");
    const wrangler = readFileSync(join(__dirname, "..", "wrangler.jsonc"), "utf8");
    for (const file of [production, wrangler]) {
      expect(file).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
      expect(file).toContain("school-academic-platform7");
      expect(file).toContain("NEXT_PUBLIC_FIREBASE_AI_API_KEY");
      expect(file).toMatch(/NEXT_PUBLIC_FIREBASE_AI_API_KEY=.+/);
      expect(file).toContain("NEXT_PUBLIC_FIREBASE_AI_AUTH_DOMAIN");
      expect(file).toContain("gen-lang-client-0473613289.firebaseapp.com");
      expect(file).toContain("NEXT_PUBLIC_FIREBASE_AI_PROJECT_ID");
      expect(file).toContain("gen-lang-client-0473613289");
      expect(file).toContain("NEXT_PUBLIC_FIREBASE_AI_STORAGE_BUCKET");
      expect(file).toContain("gen-lang-client-0473613289.firebasestorage.app");
      expect(file).toContain("NEXT_PUBLIC_FIREBASE_AI_MESSAGING_SENDER_ID");
      expect(file).toContain("50998990926");
      expect(file).toContain("NEXT_PUBLIC_FIREBASE_AI_APP_ID");
      expect(file).toContain("1:50998990926:web:d2779dcaaffc5be23f0b1f");
      expect(file).toContain("NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_SITE_KEY");
      expect(file).toContain("6LfmijUuAAAAAJUvuYxFxlXKYFgHV09orw4TMEQa");
      expect(file).toContain("6Lf1tS0uAAAAAIUlLJgzitPaPoZ09HfW_fyz6co3");
    }
  });
});
