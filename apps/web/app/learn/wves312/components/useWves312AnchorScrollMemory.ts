"use client";

import { useCallback, useEffect, useRef } from "react";
import { CHAPTERS } from "../data";

const STORAGE_PREFIX = "school:wves312-anchor-scroll:";
const ACTIVE_THRESHOLD = 128;

const ANCILLARY_ANCHORS = ["briefing", "ch18-thinkers", "mcq", "flashcards", "cases"] as const;

function normalizeAnchorId(value: string) {
  const trimmed = value.trim().replace(/^#/, "");
  return trimmed || "briefing";
}

const ANCHOR_TARGET_IDS = ["briefing", ...CHAPTERS.map((chapter) => `chapter-${chapter.id}`), ...ANCILLARY_ANCHORS.slice(1)] as const;

function storageKey(anchorId: string) {
  return `${STORAGE_PREFIX}${normalizeAnchorId(anchorId)}`;
}

function readStoredScrollPosition(anchorId: string) {
  if (typeof window === "undefined") return 0;

  const raw = window.sessionStorage.getItem(storageKey(anchorId));
  if (!raw) return 0;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function writeStoredScrollPosition(anchorId: string, value: number) {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(storageKey(anchorId), String(Math.max(0, Math.round(value))));
}

function getMobileStickyOffset() {
  if (typeof window === "undefined") return 0;
  if (!window.matchMedia("(max-width: 720px)").matches) return 0;

  const nav = document.querySelector(".wves312-chapnav") as HTMLElement | null;
  return Math.max(0, Math.round(nav?.getBoundingClientRect().height ?? 0));
}

function getActiveAnchorId(anchorIds: readonly string[]) {
  let activeAnchorId = anchorIds[0] ?? "briefing";

  for (const anchorId of anchorIds) {
    const element = document.getElementById(anchorId);
    if (element && element.getBoundingClientRect().top <= ACTIVE_THRESHOLD) {
      activeAnchorId = anchorId;
    }
  }

  return activeAnchorId;
}

export function useWves312AnchorScrollMemory() {
  const restoringRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const restoreFromHash = () => {
      const targetAnchorId = normalizeAnchorId(window.location.hash);
      const stored = readStoredScrollPosition(targetAnchorId);
      if (stored <= 0) return;

      restoringRef.current = true;
      window.scrollTo({ top: Math.max(0, stored - getMobileStickyOffset()), left: 0, behavior: "auto" });
      window.requestAnimationFrame(() => {
        restoringRef.current = false;
      });
    };

    const captureActivePosition = () => {
      if (restoringRef.current) return;
      const activeAnchorId = getActiveAnchorId(ANCHOR_TARGET_IDS);
      writeStoredScrollPosition(activeAnchorId, window.scrollY);
    };

    captureActivePosition();
    restoreFromHash();

    window.addEventListener("scroll", captureActivePosition, { passive: true });
    window.addEventListener("hashchange", restoreFromHash);
    window.addEventListener("pagehide", captureActivePosition);

    return () => {
      captureActivePosition();
      window.removeEventListener("scroll", captureActivePosition);
      window.removeEventListener("hashchange", restoreFromHash);
      window.removeEventListener("pagehide", captureActivePosition);
    };
  }, []);

  return useCallback(
    (anchorId: string) => {
      if (typeof window === "undefined") return;

      const normalized = normalizeAnchorId(anchorId);
      const currentHash = normalizeAnchorId(window.location.hash);

      if (currentHash !== normalized) {
        window.location.hash = normalized;
        return;
      }

      const stored = readStoredScrollPosition(normalized);
      if (stored > 0) {
        window.scrollTo({ top: Math.max(0, stored - getMobileStickyOffset()), left: 0, behavior: "auto" });
        return;
      }

      const element = document.getElementById(normalized);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    []
  );
}
