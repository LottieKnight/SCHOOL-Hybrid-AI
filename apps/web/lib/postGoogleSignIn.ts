import type { MinimalProfile } from "@/lib/minimalProfile";
import { safeReturnUrl } from "@/lib/safeReturnUrl";

const AUTH_ENTRY = /^\/(login|signup|register|auth)(\/|$)/;

export function safeNextPath(requested: string | null | undefined) {
  const next = safeReturnUrl(requested, "/dashboard");
  const path = next.split("?")[0] || "/";
  if (AUTH_ENTRY.test(path)) return "/dashboard";
  return next;
}

/**
 * After a real Google sign-in, leave the entry screen.
 * A profile with no grade yet goes to onboarding. The destination is never
 * /login, /signup, /register, or /auth, so a finished sign-in cannot loop.
 */
export function destinationAfterGoogleSignIn(input: {
  requestedNext: string | null | undefined;
  profile: Pick<MinimalProfile, "grade" | "skipped"> | null;
}) {
  const next = safeNextPath(input.requestedNext);
  const path = next.split("?")[0] || "/";
  const hasGrade = Boolean(input.profile?.grade);
  const skipped = input.profile?.skipped === true;
  if (!hasGrade && !skipped) {
    if (path === "/onboarding" || path.startsWith("/onboarding/")) return next;
    return `/onboarding?returnUrl=${encodeURIComponent(next)}`;
  }
  return next;
}

/**
 * A Firebase user who already exists when the entry screen opens must still
 * see it (logout only used to clear the backend cookie). Leave automatically
 * for a redirect that just finished, or for a sign-in that happens while the
 * screen is open.
 */
export function shouldAutoLeaveLogin(input: {
  source: "redirect-result" | "auth-state";
  initialSnapshot: boolean;
  hasAccount: boolean;
}) {
  if (!input.hasAccount) return false;
  if (input.source === "redirect-result") return true;
  return !input.initialSnapshot;
}

/** React Strict Mode runs the entry effect twice. Firebase returns a redirect result only to the first caller, so the replay must share that in-flight read. */
export function shareInFlight<T>(current: Promise<T> | null, start: () => Promise<T>): Promise<T> {
  return current ?? start();
}
