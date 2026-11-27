/** Lets the Google OAuth popup postMessage back to the opener. `same-origin` severs that channel. */
export const CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups" as const;

/**
 * Google sign-in opens a popup from /login, /signup, /register, /settings,
 * and /onboarding. The same header is set on every route so a popup started
 * from the app shell is not severed either.
 */
export function crossOriginOpenerPolicyForPath(_pathname = "/") {
  return CROSS_ORIGIN_OPENER_POLICY;
}
