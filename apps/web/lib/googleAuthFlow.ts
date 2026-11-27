export type GoogleSignInMode = "link-popup" | "sign-in-popup" | "sign-in-redirect" | "sign-in-credential";

export type GoogleSignInSuccess = { ok: true; mode: GoogleSignInMode };
export type GoogleSignInFailure = { ok: false; code: string; message: string; mode: GoogleSignInMode };
export type GoogleSignInResult = GoogleSignInSuccess | GoogleSignInFailure;

export function googleAuthMessage(code: string) {
  switch (code) {
    case "auth/operation-not-allowed":
      return "Google sign-in is not switched on for this app yet. You can use email, or continue without an account. In Firebase Console, enable the Google provider and add school.ditshego-ventures.co.za as an authorized domain.";
    case "auth/not-configured":
      return "Google sign-in is not configured in this environment. You can use email, or continue without an account.";
    case "auth/popup-blocked":
      return "The browser blocked the Google window. Allow popups, or continue with the full-page sign-in.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was closed before it finished. You can try again, use email, or continue without an account.";
    case "auth/credential-already-in-use":
    case "auth/email-already-in-use":
    case "auth/provider-already-linked":
      return "That Google account already exists. Signing in to it so your saved SCHOOL profile can load.";
    case "auth/operation-not-supported-in-this-environment":
      return "This browser could not open the Google window. You can try again, use email, or continue without an account.";
    case "auth/network-request-failed":
      return "The network dropped during Google sign-in. Check your connection and try again.";
    default:
      return "Google sign-in did not finish. You can try again, use email, or continue without an account.";
  }
}

/**
 * Mobile used to force `signInWithRedirect`. That loops on
 * school.ditshego-ventures.co.za: Firebase's authDomain is a different site,
 * and Chrome's third-party storage partitioning makes `getRedirectResult`
 * return null after the browser comes back. Popup sign-in, started from the
 * tap, is not affected. This stays false for every device.
 */
export function shouldUseRedirect(_input: { mobileUserAgent: boolean; narrowViewport: boolean; coarsePointer: boolean }) {
  return false;
}

export function readRedirectSignals(target: { userAgent?: string; matchMedia?: (query: string) => { matches: boolean } } | null | undefined) {
  const userAgent = target?.userAgent ?? "";
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const narrowViewport = Boolean(target?.matchMedia?.("(max-width: 900px)").matches);
  const coarsePointer = Boolean(target?.matchMedia?.("(pointer: coarse)").matches);
  return { mobileUserAgent, narrowViewport, coarsePointer };
}

function codeOf(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "auth/unknown";
}

function credentialOf(error: unknown) {
  if (error && typeof error === "object" && "credential" in error) {
    return (error as { credential?: unknown }).credential ?? null;
  }
  return null;
}

function failure(code: string, mode: GoogleSignInMode): GoogleSignInFailure {
  return { ok: false, code, message: googleAuthMessage(code), mode };
}

async function redirectFallback(
  signInWithRedirect: () => Promise<void>,
  mode: GoogleSignInMode,
): Promise<GoogleSignInResult> {
  try {
    await signInWithRedirect();
    return { ok: true, mode: "sign-in-redirect" };
  } catch (error) {
    return failure(codeOf(error), mode);
  }
}

const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
]);

const EXISTING_ACCOUNT_CODES = new Set([
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
  "auth/provider-already-linked",
]);

const TERMINAL_CODES = new Set([
  "auth/operation-not-allowed",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

async function signInExistingAccount(
  input: {
    signInWithPopup: () => Promise<void>;
    signInWithRedirect: () => Promise<void>;
    signInWithCredential: (credential: unknown) => Promise<void>;
  },
  error: unknown,
): Promise<GoogleSignInResult> {
  const credential = credentialOf(error);
  if (credential) {
    try {
      await input.signInWithCredential(credential);
      return { ok: true, mode: "sign-in-credential" };
    } catch (credentialError) {
      const nextCode = codeOf(credentialError);
      if (TERMINAL_CODES.has(nextCode)) return failure(nextCode, "sign-in-credential");
      if (REDIRECT_FALLBACK_CODES.has(nextCode)) return redirectFallback(input.signInWithRedirect, "sign-in-credential");
    }
  }

  try {
    await input.signInWithPopup();
    return { ok: true, mode: "sign-in-popup" };
  } catch (popupError) {
    const popupCode = codeOf(popupError);
    if (REDIRECT_FALLBACK_CODES.has(popupCode)) return redirectFallback(input.signInWithRedirect, "sign-in-popup");
    return failure(popupCode, "sign-in-popup");
  }
}

export async function runGoogleSignIn(input: {
  isAnonymous: boolean;
  linkWithPopup: () => Promise<void>;
  signInWithPopup: () => Promise<void>;
  signInWithRedirect: () => Promise<void>;
  signInWithCredential: (credential: unknown) => Promise<void>;
}): Promise<GoogleSignInResult> {
  // Always open Google from the tap. Redirect is only a fallback when the
  // browser itself refuses the popup — never because the screen is narrow.
  const mode: GoogleSignInMode = input.isAnonymous ? "link-popup" : "sign-in-popup";
  try {
    if (input.isAnonymous) await input.linkWithPopup();
    else await input.signInWithPopup();
    return { ok: true, mode };
  } catch (error) {
    const code = codeOf(error);
    if (TERMINAL_CODES.has(code)) return failure(code, mode);
    if (EXISTING_ACCOUNT_CODES.has(code)) return signInExistingAccount(input, error);
    if (REDIRECT_FALLBACK_CODES.has(code)) return redirectFallback(input.signInWithRedirect, mode);
    return failure(code, mode);
  }
}
