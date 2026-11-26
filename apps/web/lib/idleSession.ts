// Pure decision logic for the idle-session timeout, extracted so it can be
// unit-tested in a node environment (the React hook in useIdleSession.ts wires
// these helpers to timers, localStorage, and the logout callback).

export const IDLE_WARNING_MS = 9 * 60 * 1000;
export const IDLE_LOGOUT_MS = 10 * 60 * 1000;

export type IdleStartAction = { type: "seed"; at: number };

/**
 * Action to take when an authenticated session becomes active in this tab.
 *
 * The session has *already* been validated by the server (the hook is only
 * enabled once `/auth/session` succeeds), so the user is active by definition.
 * We therefore seed a fresh activity timestamp and start the timers — we
 * deliberately IGNORE any pre-existing timestamp.
 *
 * The previous implementation logged the user out here if the stored timestamp
 * was older than IDLE_LOGOUT_MS. Because that timestamp persists across logins
 * and across separate browser sessions and was never reset on login, any user
 * returning after >10 minutes was logged out the instant their (still valid,
 * 7-day) session loaded — and re-login never refreshed it, trapping them in an
 * inescapable `/auth?session_expired=true` loop. Session start is not idleness.
 */
export function idleStartAction(now: number): IdleStartAction {
  return { type: "seed", at: now };
}

/**
 * Within an active session, decide whether the elapsed time since the last
 * recorded activity warrants an idle logout. Used when the tab regains
 * visibility — at that point the stored timestamp is guaranteed to belong to
 * the current session (seeded at session start, updated by user activity).
 */
export function isIdleExpired(
  storedActivity: string | null,
  now: number,
  logoutMs: number = IDLE_LOGOUT_MS
): boolean {
  if (!storedActivity) return false;
  const last = Number(storedActivity);
  if (!Number.isFinite(last)) return false;
  return now - last > logoutMs;
}
