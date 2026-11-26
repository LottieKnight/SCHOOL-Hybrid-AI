"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { Card, CardAction, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { API_BASE } from "@/lib/apiBase";

type InsightPayload = {
  institution: { name: string; shortName: string | null; faculty: string | null } | null;
  modules: string[];
  metrics: { sessions: number; artifacts: number; scheduled: number; completed: number; skipped: number; activeModuleCount: number };
  subjects: Array<{ label: string; count: number }>;
  recentEvidence: Array<{ id: string; title: string; sourceType: string | null; createdAt: string | null }>;
};

export function InstitutionInsightCard() {
  const { session } = useSession();
  const [data, setData] = useState<InsightPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!session) {
      setLoading(false);
      return () => { active = false; };
    }

    fetch(`${API_BASE}/learning/institution-insights`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load institution insight.");
        return (await response.json()) as InsightPayload;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [session]);

  if (!session || (!loading && !data)) return null;

  const institutionLabel = data?.institution?.shortName || data?.institution?.name || "Your academic context";
  const completionRate = data && data.metrics.scheduled + data.metrics.completed > 0
    ? Math.round((data.metrics.completed / (data.metrics.scheduled + data.metrics.completed)) * 100)
    : 0;

  return (
    <Card className="institution-insight-card">
      <CardHeader>
        <div>
          <span className="eyebrow">INSTITUTION COMPASS</span>
          <CardTitle>{loading ? <Skeleton style={{ width: "210px", height: "24px" }} /> : `${institutionLabel} study signal`}</CardTitle>
        </div>
        <CardAction>
          <Link href="/profile/learning" prefetch={false}>Tune profile</Link>
        </CardAction>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="institution-insight-loading" aria-label="Loading institution study insight">
            <Skeleton style={{ width: "100%", height: "12px" }} />
            <Skeleton style={{ width: "72%", height: "12px" }} />
            <Skeleton style={{ width: "88%", height: "12px" }} />
          </div>
        ) : (
          <div className="institution-insight-stack">
            <p className="institution-insight-lede">
              {data?.institution?.faculty ? `${data.institution.faculty} · ` : ""}
              {data?.metrics.activeModuleCount
                ? `${data.metrics.activeModuleCount} of ${data.modules.length || data.metrics.activeModuleCount} current modules have learning evidence.`
                : "Your first saved learning artifact will create a clearer academic signal here."}
            </p>

            <div className="institution-insight-metrics" aria-label="Institution study metrics">
              <div><strong>{data?.metrics.sessions ?? 0}</strong><span>sessions</span></div>
              <div><strong>{data?.metrics.artifacts ?? 0}</strong><span>artifacts</span></div>
              <div><strong>{completionRate}%</strong><span>recovery closed</span></div>
            </div>

            {data?.subjects.length ? (
              <div className="institution-insight-subjects" aria-label="Evidence by subject">
                {data.subjects.map((subject) => (
                  <span key={subject.label} className="institution-insight-subject">
                    <strong>{subject.label}</strong><small>{subject.count} {subject.count === 1 ? "signal" : "signals"}</small>
                  </span>
                ))}
              </div>
            ) : null}

            {data?.recentEvidence.length ? (
              <div className="institution-insight-evidence">
                <span className="institution-insight-label">Latest proof</span>
                {data.recentEvidence.map((evidence) => (
                  <Link key={evidence.id} href={`/dashboard/revision/${evidence.id}`} prefetch={false}>
                    <span>{evidence.title}</span><span aria-hidden="true">-&gt;</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
