"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { rememberOpenedLesson } from "@/lib/hybridTutor/offline";

export function OpenedLessonMemory() {
  const pathname = usePathname() || "/";
  useEffect(() => {
    if (!pathname.startsWith("/learn") && !pathname.startsWith("/phase")) return;
    try {
      rememberOpenedLesson(window.localStorage, pathname);
    } catch {
      // Private mode can block storage. The offline page still works.
    }
  }, [pathname]);
  return null;
}
