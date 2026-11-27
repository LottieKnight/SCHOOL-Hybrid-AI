"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/components/SessionProvider";
import { MINIMAL_PROFILE_EVENT, readMinimalProfile } from "@/lib/minimalProfile";
import { reconcileMinimalProfile } from "@/lib/minimalProfileSync";

export function MinimalProfileSync() {
  const { session } = useSession();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || synced.current === userId) return;
    synced.current = userId;
    void reconcileMinimalProfile(window.localStorage, session).then((saved) => {
      if (saved && saved.updatedAt !== readMinimalProfile(window.localStorage)?.updatedAt) {
        window.dispatchEvent(new Event(MINIMAL_PROFILE_EVENT));
      } else if (saved) {
        window.dispatchEvent(new Event(MINIMAL_PROFILE_EVENT));
      }
    });
  }, [session]);

  return null;
}
