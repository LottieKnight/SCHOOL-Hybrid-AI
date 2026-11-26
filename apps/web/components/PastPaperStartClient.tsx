"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PastPaperStartClientProps = {
  classId: string;
  pastPaperId: string;
  liveHref: string;
};

export function PastPaperStartClient({ classId, pastPaperId, liveHref }: PastPaperStartClientProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAttempt = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/past-papers/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, pastPaperId }),
      });
      if (!response.ok) {
        throw new Error("Failed to start attempt");
      }
      const data = await response.json();
      const attemptId = data.attemptId as string;
      router.push(liveHref + "?attempt=" + encodeURIComponent(attemptId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start attempt");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="list">
      <button className="button" type="button" onClick={startAttempt} disabled={isStarting}>
        {isStarting ? "Starting..." : "Start live attempt"}
      </button>
      {error ? <div className="profile-notice profile-notice--error">{error}</div> : null}
    </div>
  );
}
