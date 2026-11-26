"use client";

import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "school:route-scroll:";

function normalizePathname(pathname: string) {
  const withoutQuery = pathname.split("?")[0] ?? "/";
  const withoutHash = withoutQuery.split("#")[0] ?? "/";
  const normalized = withoutHash.replace(/\/+$/, "");
  return normalized.length ? normalized : "/";
}

function storageKey(pathname: string) {
  return `${STORAGE_PREFIX}${normalizePathname(pathname)}`;
}

function readScrollPosition(pathname: string) {
  if (typeof window === "undefined") return 0;

  const raw = window.sessionStorage.getItem(storageKey(pathname));
  if (!raw) return 0;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function writeScrollPosition(pathname: string, value: number) {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(storageKey(pathname), String(Math.max(0, Math.round(value))));
}

export function useRouteScrollMemory(pathname: string, enabled: boolean) {
  const previousPathnameRef = useRef(pathname);
  const restoringRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    window.history.scrollRestoration = "manual";
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const previousPathname = previousPathnameRef.current;
    if (previousPathname !== pathname) {
      writeScrollPosition(previousPathname, window.scrollY);
    }

    restoringRef.current = true;
    window.scrollTo({ top: readScrollPosition(pathname), left: 0, behavior: "auto" });
    const releaseRestoreFlag = window.requestAnimationFrame(() => {
      restoringRef.current = false;
    });

    const saveCurrentPosition = () => {
      if (restoringRef.current) return;
      writeScrollPosition(pathname, window.scrollY);
    };

    window.addEventListener("scroll", saveCurrentPosition, { passive: true });
    window.addEventListener("pagehide", saveCurrentPosition);

    previousPathnameRef.current = pathname;

    return () => {
      window.cancelAnimationFrame(releaseRestoreFlag);
      saveCurrentPosition();
      window.removeEventListener("scroll", saveCurrentPosition);
      window.removeEventListener("pagehide", saveCurrentPosition);
    };
  }, [enabled, pathname]);
}
