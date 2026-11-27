"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyProgress,
  emptyProgressStore,
  mergeProgressStores,
  type ProgressEvent,
  type ProgressStore,
} from "@/lib/lessons/progress";
import {
  pullRemoteProgress,
  pushRemoteProgress,
  readStoredAudience,
  readStoredProgress,
  writeStoredAudience,
  writeStoredProgress,
  type LearnAudience,
} from "@/lib/lessons/progressStorage";

export function useLearnProgress() {
  const [store, setStore] = useState<ProgressStore>(emptyProgressStore);
  const [ready, setReady] = useState(false);
  const [savedOnDevice, setSavedOnDevice] = useState(false);

  useEffect(() => {
    const local = readStoredProgress();
    setStore(local);
    setReady(true);
    let cancelled = false;
    pullRemoteProgress().then((remote) => {
      if (!remote || cancelled) return;
      setStore((current) => {
        const merged = mergeProgressStores(current, remote);
        writeStoredProgress(merged);
        return merged;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((event: ProgressEvent) => {
    setStore((current) => {
      const next = applyProgress(current, event);
      writeStoredProgress(next);
      setSavedOnDevice(true);
      void pushRemoteProgress(next);
      return next;
    });
  }, []);

  return { store, ready, savedOnDevice, commit };
}

export function useLearnAudience() {
  const [audience, setAudienceState] = useState<LearnAudience>("student");

  useEffect(() => {
    const stored = readStoredAudience();
    const requested = new URLSearchParams(window.location.search).get("as");
    const next = requested === "teacher" || requested === "student" ? requested : stored;
    setAudienceState(next);
    if (next !== stored) writeStoredAudience(next);
  }, []);

  const setAudience = useCallback((next: LearnAudience) => {
    setAudienceState(next);
    writeStoredAudience(next);
  }, []);

  return { audience, setAudience };
}
