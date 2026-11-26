"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { enterZen, exitZen, historyMarksZen, onZenPop, restoreZen, type ZenExitReason, type ZenSession } from "@/lib/zenMode";
import styles from "./ZenFocusToggle.module.css";

const STORAGE_KEY = "saedu_zen_mode";

export function ZenFocusToggle() {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sessionRef = useRef<ZenSession>({ active: false, historyPushed: false });
  const ignorePopRef = useRef(false);
  const exitingRef = useRef(false);

  const paint = useCallback((next: boolean) => {
    setActive(next);
    document.body.classList.toggle("zen-mode", next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Private mode can block storage. Focus mode still toggles for this visit.
    }
  }, []);

  const leaveFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // The browser can refuse; focus mode still ends.
    }
  }, []);

  const requestFullscreen = useCallback(async () => {
    if (document.fullscreenElement || typeof document.documentElement.requestFullscreen !== "function") return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Phones often block fullscreen without a gesture. Focus mode still hides the chrome.
    }
  }, []);

  const leave = useCallback(async (reason: ZenExitReason) => {
    if (exitingRef.current || !sessionRef.current.active) return;
    exitingRef.current = true;
    try {
      const result = exitZen(sessionRef.current, reason);
      sessionRef.current = result.session;
      if (reason !== "fullscreen") await leaveFullscreen();
      paint(false);
      if (result.popHistory) {
        ignorePopRef.current = true;
        history.back();
      }
    } finally {
      exitingRef.current = false;
    }
  }, [leaveFullscreen, paint]);

  const enter = useCallback(async () => {
    const result = enterZen(sessionRef.current);
    sessionRef.current = result.session;
    paint(true);
    if (result.pushHistory) {
      history.pushState({ ...(history.state ?? {}), schoolZen: true }, "");
    }
    await requestFullscreen();
  }, [paint, requestFullscreen]);

  useEffect(() => {
    setMounted(true);
    let saved = false;
    try {
      saved = localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      saved = false;
    }
    if (!saved) return;
    const result = restoreZen(sessionRef.current, historyMarksZen(history.state));
    sessionRef.current = result.session;
    paint(true);
    if (result.pushHistory) history.pushState({ ...(history.state ?? {}), schoolZen: true }, "");
  }, [paint]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !sessionRef.current.active) return;
      event.preventDefault();
      event.stopPropagation();
      void leave("escape");
    };
    const onPop = () => {
      const decision = onZenPop(sessionRef.current, ignorePopRef.current);
      if (decision === "ignore") {
        ignorePopRef.current = false;
        return;
      }
      if (decision === "exit") void leave("pop");
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement && sessionRef.current.active) void leave("fullscreen");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [leave]);

  return (
    <>
      <div className={`${styles.wrap} topbar-zen`}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => void (active ? leave("control") : enter())}
          data-active={active || undefined}
          aria-pressed={active}
          aria-label={active ? "Exit focus mode" : "Enter focus mode"}
        >
          <span className={styles.icon} aria-hidden="true">{active ? "×" : "◎"}</span>
          <span className={styles.label}>{active ? "Exit focus mode" : "Focus mode"}</span>
        </button>
      </div>
      {mounted && active
        ? createPortal(
            <button type="button" className={styles.exitFloat} onClick={() => void leave("control")} aria-label="Exit focus mode">
              Exit focus mode
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
