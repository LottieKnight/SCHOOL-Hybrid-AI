const RECAPTCHA_SCRIPTS = [
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://www.recaptcha.net",
  "https://recaptcha.google.com",
];

const RECAPTCHA_FRAMES = [
  "https://www.google.com",
  "https://www.google.com/recaptcha/",
  "https://recaptcha.google.com",
  "https://recaptcha.google.com/recaptcha/",
  "https://www.recaptcha.net",
];

/** Hosts Firebase Google sign-in needs. Popup, redirect, and avatar loads fail closed without these. */
export const FIREBASE_GOOGLE_CSP_HOSTS = [
  "https://accounts.google.com",
  "https://apis.google.com",
  "https://*.firebaseapp.com",
  "https://lh3.googleusercontent.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
] as const;

const GOOGLE_AUTH_SCRIPTS = [
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://*.firebaseapp.com",
];

const GOOGLE_AUTH_FRAMES = [
  "https://accounts.google.com",
  "https://*.google.com",
  "https://*.firebaseapp.com",
  "https://apis.google.com",
];

/**
 * Firebase AI Logic (`GoogleAIBackend`) and Firebase Installations.
 * The tutor may call these from a secondary Firebase app. The project is
 * selected by that app's config; the hosts stay the same.
 * `connect-src` also allows the `https:` and `wss:` schemes, which already
 * covers `wss://firebasevertexai.googleapis.com` (live API). These explicit
 * hosts keep Gemini and Installations reachable if that scheme source is tightened.
 */
export const FIREBASE_AI_CSP_HOSTS = [
  "https://firebasevertexai.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
] as const;

const GOOGLE_AUTH_CONNECT = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://firebase.googleapis.com",
  "https://www.googleapis.com",
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://*.firebaseapp.com",
  ...FIREBASE_AI_CSP_HOSTS,
];

export function buildContentSecurityPolicy(nonce: string, isDev: boolean) {
  const scriptHosts = Array.from(new Set([...RECAPTCHA_SCRIPTS, ...GOOGLE_AUTH_SCRIPTS])).join(" ");
  const frameHosts = Array.from(new Set([...RECAPTCHA_FRAMES, ...GOOGLE_AUTH_FRAMES])).join(" ");
  const connectHosts = GOOGLE_AUTH_CONNECT.join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : "'strict-dynamic'"} 'unsafe-inline'`,
    `script-src-elem 'self' 'nonce-${nonce}' 'unsafe-inline' ${scriptHosts}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'; style-src-attr 'unsafe-inline'`,
    "img-src 'self' data: https: blob: https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src 'self' https: wss: ${connectHosts}`,
    "media-src 'self' https: blob:",
    `frame-src 'self' ${frameHosts}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self' https://accounts.google.com https://*.firebaseapp.com https://*.google.com`,
  ].join("; ");
}
