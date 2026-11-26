"use client";

import { useEffect, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { useSession } from "@/components/SessionProvider";

type ImpactAttemptsDay = {
  day: string;
  attempts: number;
};

type ImpactSummary = {
  range: "7d" | "30d";
  rangeDays: number;
  generatedAt: string;
  dau: number;
  wau: number;
  activeUsers: number;
  attemptsSubmittedPerDay: ImpactAttemptsDay[];
  avgScoreImprovementAttempt1To2: number;
  improvementPairCount: number;
  unlockConversionRatePercent: number;
  liteModeUsagePercent: number;
  liteModeUsers: number;
  medianTtiProxyMs: number;
  ttiSampleCount: number;
  creditsSpentTotal: number;
  creditsSpentPerImprovementUnit: number;
  unlockCount: number;
  attemptsTotal: number;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toLocaleString();
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function AdminImpactPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiBase}/admin/impact/summary?range=${range}`, {
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as { summary?: ImpactSummary } | null;
        if (!response.ok) {
          throw new Error("Unable to load impact summary.");
        }
        if (!cancelled) {
          setSummary(payload?.summary ?? null);
          setNotice(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null);
          setNotice(getApiErrorMessage(error, "Unable to load impact summary."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, range]);

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Impact scorecard</h1>
      <p className="subtitle">SDG-aligned usage, progression, and inclusion indicators for MVP operations.</p>
      <AdminQuickLinks />
      <div className="outline-actions">
        <button
          type="button"
          className="button"
          onClick={() => setRange("7d")}
          disabled={range === "7d" || loading}
        >
          7d
        </button>
        <button
          type="button"
          className="button"
          onClick={() => setRange("30d")}
          disabled={range === "30d" || loading}
        >
          30d
        </button>
      </div>
      {notice ? <div className="badge">{notice}</div> : null}
      {loading ? (
        <p className="subtitle">Loading impact summary...</p>
      ) : !summary ? (
        <p className="subtitle">No impact summary data available.</p>
      ) : (
        <>
          <div className="badge">Range: last {summary.rangeDays} days</div>
          <div className="badge">Generated: {formatDateTime(summary.generatedAt)}</div>
          <h3>Core metrics</h3>
          <div className="grid">
            <div className="list-item">
              <strong>DAU</strong>
              <p className="subtitle">{summary.dau}</p>
            </div>
            <div className="list-item">
              <strong>WAU</strong>
              <p className="subtitle">{summary.wau}</p>
            </div>
            <div className="list-item">
              <strong>Attempts submitted</strong>
              <p className="subtitle">{summary.attemptsTotal}</p>
            </div>
            <div className="list-item">
              <strong>Avg score improvement (A1-A2)</strong>
              <p className="subtitle">{summary.avgScoreImprovementAttempt1To2.toFixed(2)} pts</p>
            </div>
            <div className="list-item">
              <strong>Unlock conversion rate</strong>
              <p className="subtitle">{formatPercent(summary.unlockConversionRatePercent)}</p>
            </div>
            <div className="list-item">
              <strong>Lite-mode usage</strong>
              <p className="subtitle">
                {formatPercent(summary.liteModeUsagePercent)} ({summary.liteModeUsers} users)
              </p>
            </div>
            <div className="list-item">
              <strong>Median TTI proxy</strong>
              <p className="subtitle">
                {summary.medianTtiProxyMs.toFixed(0)} ms ({summary.ttiSampleCount} samples)
              </p>
            </div>
            <div className="list-item">
              <strong>Credits spent / improvement unit</strong>
              <p className="subtitle">{summary.creditsSpentPerImprovementUnit.toFixed(2)}</p>
            </div>
          </div>

          <div className="spacer" />
          <h3>Attempts per day</h3>
          {summary.attemptsSubmittedPerDay.length === 0 ? (
            <p className="subtitle">No attempt data in this range.</p>
          ) : (
            <div className="grid">
              {summary.attemptsSubmittedPerDay.map((row) => (
                <div className="list-item" key={row.day}>
                  <strong>{row.day}</strong>
                  <p className="subtitle">{row.attempts} attempts</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {!session ? <p className="badge">Sign in as admin to access impact analytics.</p> : null}
    </div>
  );
}

