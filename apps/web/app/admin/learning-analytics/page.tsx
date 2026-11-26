"use client";

import { useEffect, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { useSession } from "@/components/SessionProvider";

type ScoreRow = { subject: string; grade: number; avg_score: number; attempts: number };
type EngagementRow = { lesson_key: string; opens: number; avg_time: number };
type ObservabilitySummary = {
  uptimeSeconds: number;
  oneMinute: {
    requests: number;
    errors5xx: number;
    errorRate: number;
    latencyP95Ms: number;
    cacheHitRate: number;
  };
  memoryUsageBytes: number;
};
type FeatureFlag = {
  flag_key: string;
  description: string | null;
  enabled: boolean;
  rollout_percent: number;
  kill_switch: boolean;
  allow_roles: string[];
};

type Notice = { type: "success" | "error" | "info"; message: string };

export default function LearningAnalyticsAdminPage() {
  const apiBase = API_BASE;
  const { session } = useSession();
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [engagement, setEngagement] = useState<EngagementRow[]>([]);
  const [observability, setObservability] = useState<ObservabilitySummary | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [flagUpdatingKey, setFlagUpdatingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAdminPanels = async () => {
    const [analyticsResponse, observabilityResponse, flagsResponse] = await Promise.all([
      fetch(`${apiBase}/admin/learning-analytics`, { credentials: "include" }),
      fetch(`${apiBase}/admin/observability/summary`, { credentials: "include" }),
      fetch(`${apiBase}/admin/feature-flags`, { credentials: "include" }),
    ]);

    if (!analyticsResponse.ok) throw new Error("Unable to load analytics.");
    const analyticsData = await analyticsResponse.json();
    setScores(analyticsData.scores || []);
    setEngagement(analyticsData.engagement || []);

    if (observabilityResponse.ok) {
      const observabilityData = (await observabilityResponse.json()) as {
        summary?: ObservabilitySummary;
      };
      setObservability(observabilityData.summary ?? null);
    } else {
      setObservability(null);
    }

    if (flagsResponse.ok) {
      const flagsData = (await flagsResponse.json()) as { flags?: FeatureFlag[] };
      setFeatureFlags(flagsData.flags || []);
    } else {
      setFeatureFlags([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refreshAdminPanels();
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load analytics.") });
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  const handleToggleFlag = async (flag: FeatureFlag) => {
    if (!session || flagUpdatingKey) return;
    setFlagUpdatingKey(flag.flag_key);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/feature-flags/${encodeURIComponent(flag.flag_key)}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          enabled: !flag.enabled,
          rolloutPercent: flag.rollout_percent,
          killSwitch: flag.kill_switch,
          allowRoles: flag.allow_roles,
          description: flag.description,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update feature flag.");
      }
      await refreshAdminPanels();
      setNotice({
        type: "success",
        message: `Feature flag ${flag.flag_key} ${flag.enabled ? "disabled" : "enabled"}.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to update feature flag."),
      });
    } finally {
      setFlagUpdatingKey(null);
    }
  };

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Learning analytics</h1>
      <p className="subtitle">Aggregated engagement and quiz performance.</p>
      <AdminQuickLinks />
      {notice && <div className="badge">{notice.message}</div>}
      {loading ? (
        <p className="subtitle">Loading analytics...</p>
      ) : (
        <>
          <h3>Average quiz scores</h3>
          <div className="grid">
            {scores.map((row) => (
              <div className="list-item" key={`${row.subject}-${row.grade}`}>
                <strong>{row.subject}</strong>
                <p className="subtitle">Grade {row.grade}</p>
                <p className="subtitle">Avg score: {Number(row.avg_score).toFixed(1)}%</p>
                <p className="subtitle">Attempts: {row.attempts}</p>
              </div>
            ))}
          </div>

          <div className="spacer" />
          <h3>Lesson engagement</h3>
          <div className="grid">
            {engagement.map((row) => (
              <div className="list-item" key={row.lesson_key}>
                <strong>{row.lesson_key}</strong>
                <p className="subtitle">Opens: {row.opens}</p>
                <p className="subtitle">Avg time: {Number(row.avg_time).toFixed(0)}s</p>
              </div>
            ))}
          </div>

          <div className="spacer" />
          <h3>System observability</h3>
          {observability ? (
            <div className="grid">
              <div className="list-item">
                <strong>Uptime</strong>
                <p className="subtitle">{Math.round(observability.uptimeSeconds / 60)} min</p>
              </div>
              <div className="list-item">
                <strong>Requests (1m)</strong>
                <p className="subtitle">{observability.oneMinute.requests}</p>
              </div>
              <div className="list-item">
                <strong>Errors (1m)</strong>
                <p className="subtitle">{observability.oneMinute.errors5xx}</p>
              </div>
              <div className="list-item">
                <strong>P95 latency</strong>
                <p className="subtitle">{observability.oneMinute.latencyP95Ms}ms</p>
              </div>
            </div>
          ) : (
            <p className="subtitle">Observability summary unavailable.</p>
          )}

          <div className="spacer" />
          <h3>Feature flags</h3>
          <div className="grid">
            {featureFlags.length === 0 ? (
              <p className="subtitle">No feature flags configured.</p>
            ) : (
              featureFlags.map((flag) => (
                <div className="list-item" key={flag.flag_key}>
                  <strong>{flag.flag_key}</strong>
                  <p className="subtitle">{flag.description || "No description"}</p>
                  <p className="subtitle">
                    Enabled: {flag.enabled ? "Yes" : "No"} | Rollout: {flag.rollout_percent}% |
                    Kill switch: {flag.kill_switch ? "On" : "Off"}
                  </p>
                  <button
                    className="button"
                    type="button"
                    onClick={() => void handleToggleFlag(flag)}
                    disabled={!session || flagUpdatingKey === flag.flag_key}
                  >
                    {flagUpdatingKey === flag.flag_key
                      ? "Updating..."
                      : flag.enabled
                      ? "Disable"
                      : "Enable"}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
