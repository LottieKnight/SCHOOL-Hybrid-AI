"use client";

import { useEffect, useState } from "react";
import { flushQueue, getQueue, subscribeToOnline } from "@/lib/offlineUnlockQueue";

export function OfflineUnlockQueueFlusher() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const flush = async () => {
      if (getQueue().length === 0) return;
      await flushQueue((count) => {
        setNotice(`${count} queued unlock${count > 1 ? "s" : ""} submitted while you were offline.`);
        setTimeout(() => setNotice(null), 5000);
      });
    };

    flush();
    return subscribeToOnline(flush);
  }, []);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "80px",
        right: "16px",
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: "var(--r-md, 10px)",
        padding: "10px 16px",
        fontSize: "13px",
        color: "var(--text-1)",
        boxShadow: "var(--sh-md)",
        zIndex: 9000,
        maxWidth: "280px",
      }}
    >
      {notice}
    </div>
  );
}
