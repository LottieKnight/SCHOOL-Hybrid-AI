"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RecoveryActionCard } from "@/components/RecoveryActionCard";
import { PerformanceSampleBeacon } from "@/components/PerformanceSampleBeacon";
import { useSession } from "@/components/SessionProvider";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { buildWeaknessMap, type WeaknessRecommendation, type WeaknessReview } from "@/lib/learning/weaknesses";

type Summary = {
  role: "learner" | "tutor" | "admin";
  activity: {
    recommendations?: WeaknessRecommendation[];
    dueReviews?: WeaknessReview[];
  };
};

export default function WeaknessesPage() {
  const { session } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/analytics/dashboard-summary`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load weakness signals.");
      const data = (await response.json()) as { summary?: Summary };
      setSummary(data.summary ?? null);
    } catch (cause) {
      setSummary(null);
      setError(getApiErrorMessage(cause, "Unable to load weakness signals."));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      setSummary(null);
      return;
    }
    void loadSummary();
  }, [loadSummary, session]);

  const weaknesses = useMemo(
    () => buildWeaknessMap(summary?.activity.recommendations, summary?.activity.dueReviews),
    [summary]
  );

  if (!session) {
    return <StateCard title="Your weakness map" description="Sign in to see the topics that deserve your next focused attempt." />;
  }

  return (
    <div className="glass card card-with-back">
      <PerformanceSampleBeacon routeTag="/dashboard/weaknesses" />
      <RouteHeader
        eyebrow="Progress / Recovery"
        title="Your weakness map"
        description="A short list of evidence-led recovery opportunities. SCHOOL will not label an area weak without enough signal."
        size={76}
      >
        <div className="outline-actions">
          <button type="button" onClick={() => void loadSummary()} disabled={loading}>{loading ? "Refreshing…" : "Refresh signals"}</button>
          <Link className="button button--ghost" href="/dashboard/progress" prefetch={false}>Back to progress</Link>
        </div>
      </RouteHeader>

      {error ? <StateCard tone="danger" title="The map needs a refresh" description={error}><button type="button" onClick={() => void loadSummary()}>Try again</button></StateCard> : null}
      {loading ? <StateCard title="Reading your evidence" description="SCHOOL is comparing recent results, recommendations, and spaced reviews." /> : null}
      {!loading && !error && !summary ? <StateCard title="No evidence available yet" description="Complete a lesson, quiz, or past-paper attempt and your first recovery signals will appear here." /> : null}
      {!loading && !error && summary?.role !== "learner" ? <StateCard title="Learner map only" description="This view is designed for learner evidence. Open the relevant dashboard for your role." /> : null}
      {!loading && !error && summary?.role === "learner" && weaknesses.length === 0 ? (
        <StateCard tone="success" title="No actionable weaknesses yet" description="That is a good sign—or simply a sign that SCHOOL needs more evidence. Complete another linked learning action to sharpen the map.">
          <Link className="button" href="/learn" prefetch={false}>Continue learning</Link>
          <Link className="button button--ghost" href="/past-papers" prefetch={false}>Try a past paper</Link>
        </StateCard>
      ) : null}
      {!loading && !error && summary?.role === "learner" && weaknesses.length > 0 ? (
        <>
          <div className="weakness-map-intro">
            <span className="eyebrow">Next best recovery</span>
            <strong>Choose one area. Make one focused attempt. Let the evidence move.</strong>
            <span>{weaknesses.length} signal{weaknesses.length === 1 ? "" : "s"} shown · sorted by recovery leverage</span>
          </div>
          <div className="recovery-action-grid">
            {weaknesses.map((weakness) => <RecoveryActionCard key={weakness.id} weakness={weakness} />)}
          </div>
        </>
      ) : null}
    </div>
  );
}
