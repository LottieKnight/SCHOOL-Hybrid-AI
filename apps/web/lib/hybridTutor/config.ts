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

export function readPublicFirebaseConfig(): { ok: boolean; missing: string[]; config: PublicFirebaseConfig } {
  const config: PublicFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  const missing = REQUIRED.filter(([envName, key]) => !config[key]).map(([envName]) => envName);
  return { ok: missing.length === 0, missing, config };
}

export function readAppCheckPublicConfig() {
  return {
    siteKey: process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY ?? "",
    debugToken: process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN ?? "",
  };
}
