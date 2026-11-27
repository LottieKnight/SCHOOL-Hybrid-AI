const OPEN_PREFIXES = ["/dashboard", "/onboarding", "/login", "/signup", "/register", "/settings", "/auth"];

function pathnameOnly(value: string) {
  const path = (value || "/").split("?")[0] || "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isOpenWithoutBackendCookie(path: string) {
  return OPEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Firebase Google sign-in does not mint the legacy `saedu_session` cookie.
 * Dashboard, onboarding, login, and middleware must not answer that absence
 * by sending the learner back to /login — that is the mobile sign-in loop.
 * Middleware calls this with `enforceLegacyCookie: false` because the server
 * cannot see the Firebase user at all.
 */
export function loginRedirectForMissingBackendCookie(input: {
  pathname: string;
  hasBackendSessionCookie: boolean;
  firebaseUserSignedIn?: boolean;
  enforceLegacyCookie?: boolean;
}): string | null {
  if (input.firebaseUserSignedIn) return null;
  const path = pathnameOnly(input.pathname);
  if (isOpenWithoutBackendCookie(path)) return null;
  if (input.enforceLegacyCookie !== true) return null;
  if (input.hasBackendSessionCookie) return null;
  return `/login?next=${encodeURIComponent(path)}`;
}
