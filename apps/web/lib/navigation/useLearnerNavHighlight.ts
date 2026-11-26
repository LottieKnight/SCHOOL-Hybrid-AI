"use client";

import { useEffect, useState } from "react";
import {
  learnerNavItems,
  resolveLearnerNavDisplayId,
  resolveLearnerNavId,
  type LearnerNavId,
} from "@/lib/navigation/navManifest";

const STORAGE_KEY = "school:last-learner-nav-id";
const learnerNavIdSet = new Set(learnerNavItems.map((item) => item.id));

function readStoredLearnerNavId() {
  if (typeof window === "undefined") return null;

  const value = window.sessionStorage.getItem(STORAGE_KEY);
  if (!value) return null;

  return learnerNavIdSet.has(value as LearnerNavId) ? (value as LearnerNavId) : null;
}

export function useLearnerNavHighlight(pathname: string) {
  const [rememberedId, setRememberedId] = useState<LearnerNavId | null>(() => readStoredLearnerNavId());
  const resolvedId = resolveLearnerNavId(pathname);
  const displayId = resolveLearnerNavDisplayId(pathname, rememberedId);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (resolvedId) {
      setRememberedId(resolvedId);
      window.sessionStorage.setItem(STORAGE_KEY, resolvedId);
    }
  }, [resolvedId]);

  return displayId;
}
