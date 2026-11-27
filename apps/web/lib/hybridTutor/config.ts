export type PublicFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const REQUIRED = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", "apiKey"],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "authDomain"],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "projectId"],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", "appId"],
] as const;

const AI_REQUIRED = [
  ["NEXT_PUBLIC_FIREBASE_AI_API_KEY", "apiKey"],
  ["NEXT_PUBLIC_FIREBASE_AI_AUTH_DOMAIN", "authDomain"],
  ["NEXT_PUBLIC_FIREBASE_AI_PROJECT_ID", "projectId"],
  ["NEXT_PUBLIC_FIREBASE_AI_APP_ID", "appId"],
] as const;

export function readPublicFirebaseConfig(): { ok: boolean; missing: string[]; config: PublicFirebaseConfig } {
  const config: PublicFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  const missing = REQUIRED.filter(([, key]) => !config[key]).map(([envName]) => envName);
  return { ok: missing.length === 0, missing, config };
}

export type PublicFirebaseAiConfigResult = {
  ok: boolean;
  missing: string[];
  config: PublicFirebaseConfig;
  /** True when NEXT_PUBLIC_FIREBASE_AI_* names a project of its own. */
  dedicated: boolean;
};

/**
 * Web config for Hybrid Tutor Firebase AI Logic.
 * Direct `process.env.NEXT_PUBLIC_*` reads are required so Next can inline them.
 * When every AI variable is empty, the primary Firebase web app is used.
 * A partial AI config is not merged with the primary project: Gemini would
 * then run with the wrong API key.
 */
export function readPublicFirebaseAiConfig(): PublicFirebaseAiConfigResult {
  const config: PublicFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_AI_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AI_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_AI_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_AI_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_AI_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_AI_APP_ID ?? "",
  };
  const anySet = Object.values(config).some((value) => value !== "");
  if (!anySet) {
    const primary = readPublicFirebaseConfig();
    return { ok: primary.ok, missing: primary.missing, config: primary.config, dedicated: false };
  }
  const missing = AI_REQUIRED.filter(([, key]) => !config[key]).map(([envName]) => envName);
  return { ok: missing.length === 0, missing, config, dedicated: true };
}

export function readAppCheckPublicConfig() {
  return {
    siteKey: process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY ?? "",
    debugToken: process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN ?? "",
  };
}

/** App Check for the secondary AI project only. Never reuse the primary site key. */
export function readAiAppCheckPublicConfig() {
  return {
    siteKey: process.env.NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_SITE_KEY ?? "",
    debugToken: process.env.NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_DEBUG_TOKEN ?? "",
  };
}
