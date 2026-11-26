import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from "firebase/remote-config";
import { readAppCheckPublicConfig, readPublicFirebaseConfig } from "./config";
import { DEFAULT_SETTINGS, type TutorSettings } from "./routing";

let appCheckStarted = false;
let aiInstance: AI | null = null;

export function getFirebaseApp(): FirebaseApp {
  const { ok, missing, config } = readPublicFirebaseConfig();
  if (!ok) {
    throw new Error(`Firebase is not configured (${missing.join(", ")}).`);
  }
  const existing = getApps()[0];
  return existing ?? initializeApp(config);
}

export function initAppCheck(app: FirebaseApp) {
  if (typeof window === "undefined" || appCheckStarted) return;
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

export function getTutorAi(app: FirebaseApp = getFirebaseApp()): AI {
  initAppCheck(app);
  if (!aiInstance) {
    aiInstance = getAI(app, { backend: new GoogleAIBackend() });
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
  const model = getValue(remoteConfig, "cloud_model").asString() || DEFAULT_SETTINGS.cloud_model;
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
