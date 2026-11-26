"use client";

import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

export function LessonEngagementTracker({ lessonKey }: { lessonKey: string }) {
  const { session } = useSession();
  const apiBase = API_BASE;
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    return () => {
      if (!session) return;
      const openedAt = new Date(startRef.current).toISOString();
      const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
      fetch(`${apiBase}/analytics/lesson-engagement`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          lessonKey,
          openedAt,
          timeSpentSeconds,
          completed: false,
        }),
      }).catch(() => {
        // ignore
      });
    };
  }, [apiBase, lessonKey, session]);

  return null;
}
