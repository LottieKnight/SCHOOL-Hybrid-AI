import { deleteApp, getApps } from "firebase/app";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { getGenerativeModel } from "firebase/ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real Firebase SDK (not the mocks in hybridTutor.test.ts).
 * `@firebase/ai` 3.1.0 appends `X-Firebase-AppCheck` from `app-check-internal`
 * on the same FirebaseApp. These tests drive `generateContent` and read that header.
 */

const DUMMY_APP_CHECK_TOKEN = "eyJlcnJvciI6IlVOS05PV05fRVJST1IifQ==";

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

type RecordedRequest = { url: string; headers: Headers };

const recorded: RecordedRequest[] = [];

function applyFirebaseEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

function clearFirebaseEnv() {
  for (const key of FIREBASE_ENV_KEYS) delete process.env[key];
}

function installBrowserStubs() {
  const grecaptcha = {
    ready(callback: () => void) {
      callback();
    },
    render() {
      return 1;
    },
    execute() {
      return Promise.resolve("recaptcha-token");
    },
  };
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("self", globalThis);
  vi.stubGlobal("document", {
    createElement: () => ({ style: {}, id: "", setAttribute() {} }),
    head: { appendChild() {} },
    body: { appendChild() {} },
  });
  (globalThis as { grecaptcha?: { enterprise: typeof grecaptcha } }).grecaptcha = { enterprise: grecaptcha };
}

function installFetch() {
  recorded.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      recorded.push({ url, headers: new Headers(init?.headers) });
      if (url.includes(":generateContent")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: { message: "ignored" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

async function deleteFirebaseApps() {
  await Promise.all(getApps().map((app) => deleteApp(app).catch(() => undefined)));
}

async function loadTutorClient() {
  return import("../lib/hybridTutor/client");
}

function generateContentRequest() {
  const request = recorded.find((entry) => entry.url.includes(":generateContent"));
  expect(request, "Firebase AI generateContent request").toBeTruthy();
  return request!;
}

describe("tutor-ai App Check header", () => {
  beforeEach(async () => {
    clearFirebaseEnv();
    applyFirebaseEnv(PRIMARY_FIREBASE_ENV);
    applyFirebaseEnv(AI_FIREBASE_ENV);
    delete process.env.NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_SITE_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_DEBUG_TOKEN;
    installBrowserStubs();
    installFetch();
    await deleteFirebaseApps();
    vi.resetModules();
  });

  afterEach(async () => {
    await deleteFirebaseApps();
    vi.unstubAllGlobals();
    delete (globalThis as { grecaptcha?: unknown }).grecaptcha;
    clearFirebaseEnv();
  });

  it("does not send X-Firebase-AppCheck after initAppCheck on the primary app", async () => {
    const client = await loadTutorClient();
    const primary = client.getFirebaseApp();
    client.initAppCheck(primary);
    expect(primary.name).toBe("[DEFAULT]");

    const ai = client.getTutorAi(primary);
    const model = getGenerativeModel(ai, { model: "gemini-3.5-flash-lite" });
    await model.generateContent("What is 2 + 2?");

    const request = generateContentRequest();
    expect(request.url).toContain("projects/gen-lang-client-0473613289/");
    expect(request.url).toContain("models/gemini-3.5-flash-lite:generateContent");
    expect(request.headers.get("x-goog-api-key")).toBe("ai-api-key");
    expect(request.headers.has("X-Firebase-AppCheck")).toBe(false);
    expect(request.headers.has("x-firebase-appcheck")).toBe(false);
  });

  it("strips a dummy App Check token from tutor-ai when the AI site key is unset", async () => {
    const client = await loadTutorClient();
    const primary = client.getFirebaseApp();
    client.initAppCheck(primary);
    const aiApp = client.getTutorAiFirebaseApp(primary);
    initializeAppCheck(aiApp, {
      provider: new CustomProvider({
        getToken: () =>
          Promise.resolve({
            token: DUMMY_APP_CHECK_TOKEN,
            expireTimeMillis: Date.now() + 60 * 60 * 1000,
          }),
      }),
      isTokenAutoRefreshEnabled: false,
    });

    const ai = client.getTutorAi(primary);
    const model = getGenerativeModel(ai, { model: "gemini-3.5-flash-lite" });
    await model.generateContent("What is 2 + 2?");

    const request = generateContentRequest();
    expect(request.url).toContain("projects/gen-lang-client-0473613289/");
    expect(request.headers.get("X-Firebase-AppCheck")).not.toBe(DUMMY_APP_CHECK_TOKEN);
    expect(request.headers.has("X-Firebase-AppCheck")).toBe(false);
  });

  it("initializes a separate reCAPTCHA Enterprise widget on each app before getAI", async () => {
    const aiSiteKey = "6LfmijUuAAAAAJUvuYxFxlXKYFgHV09orw4TMEQa";
    process.env.NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_SITE_KEY = aiSiteKey;
    const renders: Array<{ container: string; sitekey: string }> = [];
    (globalThis as { grecaptcha?: unknown }).grecaptcha = {
      enterprise: {
        ready(callback: () => void) {
          callback();
        },
        render(container: string, options: { sitekey: string; callback?: () => void }) {
          renders.push({ container, sitekey: options.sitekey });
          options.callback?.();
          return renders.length;
        },
        execute() {
          return Promise.resolve("recaptcha-token");
        },
      },
    };
    vi.resetModules();
    const client = await loadTutorClient();
    const primary = client.getFirebaseApp();

    const ai = client.getTutorAi(primary);
    expect(() => client.getTutorAi(primary)).not.toThrow();

    const aiApp = client.getTutorAiFirebaseApp(primary);
    const appCheckActive = (app: object) => {
      const container = (app as { container: { getProvider: (name: string) => { isInitialized: () => boolean } } }).container;
      return container.getProvider("app-check-internal").isInitialized();
    };
    expect(appCheckActive(primary)).toBe(true);
    expect(appCheckActive(aiApp)).toBe(true);
    expect(aiApp).not.toBe(primary);
    expect((ai as { appCheck?: unknown }).appCheck).toBeTruthy();
    expect(renders).toEqual([
      { container: "fire_app_check_[DEFAULT]", sitekey: "primary-recaptcha-key" },
      { container: "fire_app_check_tutor-ai", sitekey: aiSiteKey },
    ]);
  });
});
