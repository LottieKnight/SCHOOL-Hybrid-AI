import { useCallback, useEffect, useRef, useState } from "react";
import {
  IDLE_WARNING_MS,
  IDLE_LOGOUT_MS,
  idleStartAction,
  isIdleExpired,
} from "./idleSession";

export { IDLE_WARNING_MS, IDLE_LOGOUT_MS };

const ACTIVITY_KEY = "saedu_last_activity";
const THROTTLE_MS  = 30_000;

export function useIdleSession(options: {
  onLogout: () => void;
  enabled: boolean;
}): { isIdle: boolean; showWarning: boolean; resetTimer: () => void } {
  const [showWarning, setShowWarning] = useState(false);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef    = useRef<number>(0);
  const onLogoutRef     = useRef(options.onLogout);

  useEffect(() => { onLogoutRef.current = options.onLogout; }, [options.onLogout]);

  const resetTimer = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
    setShowWarning(false);
    warningTimerRef.current = setTimeout(() => setShowWarning(true), IDLE_WARNING_MS);
    logoutTimerRef.current  = setTimeout(() => onLogoutRef.current(), IDLE_LOGOUT_MS);
  }, []);

  useEffect(() => {
    if (!options.enabled) return;

    // Session start: the server has already validated this session, so the user
    // is active by definition. Seed a fresh activity timestamp and start the
    // timers. We must NOT log out here based on a leftover timestamp — it can
    // belong to a previous browser session and would trap returning users in an
    // inescapable /auth?session_expired=true loop (login never refreshes it).
    const start = idleStartAction(Date.now());
    localStorage.setItem(ACTIVITY_KEY, String(start.at));
    lastWriteRef.current = start.at;

    resetTimer();

    const onActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current > THROTTLE_MS) {
        localStorage.setItem(ACTIVITY_KEY, String(now));
        lastWriteRef.current = now;
      }
      resetTimer();
    };

    const onVisibilityChange = () => {
      if (document.hidden) return;
      // Within an active session, the timestamp is current-session state
      // (seeded above, updated by activity), so genuine idleness while the tab
      // was backgrounded still triggers a logout.
      if (isIdleExpired(localStorage.getItem(ACTIVITY_KEY), Date.now())) {
        onLogoutRef.current();
      }
    };

    const syncEvents = ["mousemove", "mousedown", "keydown"] as const;
    const passiveEvents = ["touchstart", "scroll"] as const;

    syncEvents.forEach(e => window.addEventListener(e, onActivity));
    passiveEvents.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
      syncEvents.forEach(e => window.removeEventListener(e, onActivity));
      passiveEvents.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [options.enabled, resetTimer]);

  return { isIdle: showWarning, showWarning, resetTimer };
}
