export type ZenExitReason = "control" | "escape" | "pop" | "fullscreen";

export type ZenSession = {
  active: boolean;
  historyPushed: boolean;
};

export function historyMarksZen(state: unknown): boolean {
  return Boolean(state && typeof state === "object" && (state as { schoolZen?: unknown }).schoolZen === true);
}

export function enterZen(session: ZenSession): { session: ZenSession; pushHistory: boolean } {
  if (session.active && session.historyPushed) {
    return { session, pushHistory: false };
  }
  return {
    session: { active: true, historyPushed: true },
    pushHistory: !session.historyPushed,
  };
}

/** Restore a saved preference without stacking another same-page history entry. */
export function restoreZen(
  session: ZenSession,
  currentEntryIsZen: boolean,
): { session: ZenSession; pushHistory: boolean } {
  if (currentEntryIsZen) {
    return { session: { active: true, historyPushed: true }, pushHistory: false };
  }
  return enterZen(session);
}

export function exitZen(
  session: ZenSession,
  reason: ZenExitReason,
): { session: ZenSession; popHistory: boolean } {
  if (!session.active) {
    return { session, popHistory: false };
  }
  const popHistory = reason !== "pop" && session.historyPushed;
  return {
    session: { active: false, historyPushed: false },
    popHistory,
  };
}

/** Android back / browser back should leave focus mode and stay on the page. */
export function onZenPop(session: ZenSession, ignoreNextPop: boolean): "ignore" | "exit" | "navigate" {
  if (ignoreNextPop) return "ignore";
  if (session.active) return "exit";
  return "navigate";
}
