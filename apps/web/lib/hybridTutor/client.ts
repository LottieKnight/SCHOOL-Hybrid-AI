import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from "firebase/remote-config";
import {
  readAiAppCheckPublicConfig,
  readAppCheckPublicConfig,
  readPublicFirebaseAiConfig,
  readPublicFirebaseConfig,
} from "./config";
import { DEFAULT_SETTINGS, resolveCloudModel, type TutorSettings } from "./routing";

/** Firebase's name for the unnamed app. Auth, Firestore, and Remote Config stay here. */
const DEFAULT_FIREBASE_APP_NAME = "[DEFAULT]";

/**
 * Secondary app for Firebase AI Logic when NEXT_PUBLIC_FIREBASE_AI_* is set.
 * Gemini then uses that project's API key instead of school-academic-platform7.
 */
export const TUTOR_AI_APP_NAME = "tutor-ai";

let appCheckStarted = false;
let aiAppCheckStarted = false;
let aiInstance: AI | null = null;

function appNamed(name: string): FirebaseApp | undefined {
  return getApps().find((candidate) => candidate.name === name);
}

export function getFirebaseApp(): FirebaseApp {
  const { ok, missing, config } = readPublicFirebaseConfig();
  if (!ok) {
    throw new Error(`Firebase is not configured (${missing.join(", ")}).`);
  }
  // Do not use getApps()[0]: the named tutor-ai app may have been created first.
  return appNamed(DEFAULT_FIREBASE_APP_NAME) ?? initializeApp(config);
}

/**
 * App passed to `getAI`. The named secondary app is used only when the
 * NEXT_PUBLIC_FIREBASE_AI_* config is present; otherwise this is the primary app.
 */
export function getTutorAiFirebaseApp(primary?: FirebaseApp): FirebaseApp {
  const ai = readPublicFirebaseAiConfig();
  if (!ai.dedicated) return primary ?? getFirebaseApp();
  if (!ai.ok) {
    throw new Error(`Firebase AI is not configured (${ai.missing.join(", ")}).`);
  }
  return appNamed(TUTOR_AI_APP_NAME) ?? initializeApp(ai.config, TUTOR_AI_APP_NAME);
}

export function initAppCheck(app: FirebaseApp) {
  if (typeof window === "undefined" || appCheckStarted) return;
  // school-academic-platform7's reCAPTCHA Enterprise site key mints App Check
  // tokens for that project only. gen-lang-client-0473613289 rejects them.
  if (app.name === TUTOR_AI_APP_NAME) return;
  const { siteKey, debugToken } = readAppCheckPublicConfig();
  if (!siteKey) return;
  if (process.env.NODE_ENV !== "production" && debugToken) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckStarted = true;
}

function initDedicatedTutorAiAppCheck(app: FirebaseApp) {
  if (app.name !== TUTOR_AI_APP_NAME) return;
  if (typeof window === "undefined" || aiAppCheckStarted) return;
  const { siteKey, debugToken } = readAiAppCheckPublicConfig();
  if (!siteKey) return;
  if (process.env.NODE_ENV !== "production" && debugToken) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  aiAppCheckStarted = true;
}

type AppCheckSlot = {
  isInitialized: () => boolean;
  clearInstance: () => void;
};

/**
 * `@firebase/ai` calls `app-check-internal.getToken()` only after that component
 * is initialized on the same app, then sends whatever token comes back as
 * `X-Firebase-AppCheck`. A failed `getToken()` is not empty: `@firebase/app-check`
 * substitutes the dummy `{"error":"UNKNOWN_ERROR"}` token, and
 * `firebasevertexai.googleapis.com` rejects that header with 401.
 * Importing `firebase/app-check` registers the component for every app, including
 * `tutor-ai`, but does not initialize it. With no AI site key, drop any
 * activation so `getAI` does not attach the header.
 */
function detachTutorAiAppCheck(app: FirebaseApp) {
  if (app.name !== TUTOR_AI_APP_NAME) return;
  const container = (
    app as FirebaseApp & { container?: { getProvider: (name: string) => AppCheckSlot } }
  ).container;
  if (!container) return;
  for (const name of ["app-check-internal", "app-check"]) {
    const provider = container.getProvider(name);
    if (provider.isInitialized()) provider.clearInstance();
  }
}

export function getTutorAi(primary: FirebaseApp = getFirebaseApp()): AI {
  const appCheckApp = primary.name === TUTOR_AI_APP_NAME ? getFirebaseApp() : primary;
  initAppCheck(appCheckApp);
  const aiApp = getTutorAiFirebaseApp(appCheckApp);
  // Each FirebaseApp has its own App Check state. @firebase/app-check renders a
  // separate invisible reCAPTCHA Enterprise widget per app (`fire_app_check_${name}`),
  // so the primary site key and the AI site key do not overwrite each other.
  // Initialize tutor-ai before getAI(), which reads app-check-internal once.
  if (readAiAppCheckPublicConfig().siteKey) {
    initDedicatedTutorAiAppCheck(aiApp);
  } else {
    detachTutorAiAppCheck(aiApp);
  }
  if (!aiInstance) {
    aiInstance = getAI(aiApp, { backend: new GoogleAIBackend() });
  }
  return aiInstance;
}

export async function ensureAnonymousUser(app: FirebaseApp): Promise<string | null> {
  try {
    const auth = getAuth(app);
    if (auth.currentUser) return auth.currentUser.uid;
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  } catch {
    return null;
  }
}

function readSettings(remoteConfig: RemoteConfig): TutorSettings {
  const mode = getValue(remoteConfig, "inference_mode").asString() || DEFAULT_SETTINGS.inference_mode;
  const chars = getValue(remoteConfig, "long_answer_chars").asNumber();
  const model = resolveCloudModel(getValue(remoteConfig, "cloud_model").asString() || DEFAULT_SETTINGS.cloud_model);
  const enabledRaw = getValue(remoteConfig, "ai_enabled").asString();
  const aiEnabled = enabledRaw === "" ? DEFAULT_SETTINGS.ai_enabled : getValue(remoteConfig, "ai_enabled").asBoolean();
  return {
    inference_mode: mode,
    long_answer_chars: Number.isFinite(chars) && chars > 0 ? chars : DEFAULT_SETTINGS.long_answer_chars,
    cloud_model: model,
    ai_enabled: aiEnabled,
  };
}

export async function loadTutorSettings(app: FirebaseApp): Promise<{ settings: TutorSettings; source: "remote_config" | "defaults" }> {
  try {
    const remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = 60_000;
    remoteConfig.defaultConfig = {
      inference_mode: DEFAULT_SETTINGS.inference_mode,
      long_answer_chars: DEFAULT_SETTINGS.long_answer_chars,
      cloud_model: DEFAULT_SETTINGS.cloud_model,
      ai_enabled: DEFAULT_SETTINGS.ai_enabled,
    };
    await fetchAndActivate(remoteConfig);
    return { settings: readSettings(remoteConfig), source: "remote_config" };
  } catch {
    return { settings: DEFAULT_SETTINGS, source: "defaults" };
  }
}

export async function saveTutorAttempt(app: FirebaseApp, uid: string, attempt: Record<string, unknown>) {
  const db = getFirestore(app);
  const id = crypto.randomUUID();
  await setDoc(doc(db, "users", uid, "tutorAttempts", id), {
    ...attempt,
    uid,
    createdAt: serverTimestamp(),
  });
  return id;
}

export function firebaseAppOrNull() {
  try {
    return getApps().length ? getApp() : null;
  } catch {
    return null;
  }
}
