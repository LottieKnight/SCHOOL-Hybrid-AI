"use client";

import { useState } from "react";

type SaveButtonProps = {
  jsonUrl: string;
  pageUrl?: string;
};

export function SaveLessonOfflineButton({ jsonUrl, pageUrl }: SaveButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    if (!("caches" in window)) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      const cache = await caches.open("saedu-lessons-v1");
      const urls = [jsonUrl];
      if (pageUrl) {
        urls.push(pageUrl);
      } else if (typeof window !== "undefined") {
        urls.push(window.location.href);
      }
      await cache.addAll(urls);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="outline-actions">
      <button type="button" onClick={handleSave} disabled={status === "saving"}>
        {status === "saved" ? "Saved for offline" : status === "saving" ? "Saving..." : "Save this week offline"}
      </button>
      {status === "error" && <span className="badge">Offline cache unavailable.</span>}
    </div>
  );
}
