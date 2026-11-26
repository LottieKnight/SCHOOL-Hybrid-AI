"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type MonetisationRange = "7d" | "30d";

type MonetisationSummary = {
  range: MonetisationRange;
  range_days: number;
  generated_at: string;
  scope: "range" | "experiment";
  experiment_id: string | null;
  experiment_start_date: string | null;
  experiment_end_date: string | null;
  total_attempts: number;
  total_unlocks: number;
  unlock_conversion_rate: number;
  total_credits_spent: number;
  spending_learners: number;
  average_credits_spent_per_learner: number;
  weekly_topup_count: number;
  total_topup_revenue_zar: number;
  active_learners: number;
  arpu_proxy_zar: number;
};

type MonetisationExperimentMetrics = {
  total_attempts: number;
  total_unlocks: number;
  unlock_conversion_rate: number;
  total_credits_spent: number;
  spending_learners: number;
  average_credits_spent_per_learner: number;
  total_topup_revenue_zar: number;
  topup_count: number;
  active_learners: number;
  arpu_proxy_zar: number;
};

type MonetisationExperiment = {
  id: string;
  start_date: string;
  end_date: string | null;
  detailed_report_price_credits: number;
  weekly_free_unlocks: number;
  bundle_structure_json: unknown;
  created_by_admin: string;
  created_at: string;
  duration_seconds: number;
  duration_days: number;
  is_active: boolean;
  metrics: MonetisationExperimentMetrics;
};

type MonetisationExperimentsResponse = {
  active_experiment_id: string | null;
  experiments: MonetisationExperiment[];
};

function formatPercent(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1)}%`;
}

function formatCurrency(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

function formatDateTime(value: string | null) {
  if (!value) return "Active";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function AdminMonetisationPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [range, setRange] = useState<MonetisationRange>("7d");
  const [selectedExperimentId, setSelectedExperimentId] = useState("");
  const [summary, setSummary] = useState<MonetisationSummary | null>(null);
  const [experiments, setExperiments] = useState<MonetisationExperiment[]>([]);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [experimentBusy, setExperimentBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailedPriceCredits, setDetailedPriceCredits] = useState("15");
  const [weeklyFreeUnlocks, setWeeklyFreeUnlocks] = useState("1");
  const [bundleStructureJson, setBundleStructureJson] = useState(
    JSON.stringify(
      [
        { id: "starter", amountZar: 10, bonusPercent: 0 },
        { id: "growth", amountZar: 25, bonusPercent: 10 },
        { id: "mastery", amountZar: 50, bonusPercent: 20 },
      ],
      null,
      2
    )
  );

  const canMutate = Boolean(session?.csrfToken);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summaryParams = new URLSearchParams({ range });
      if (selectedExperimentId.trim().length > 0) {
        summaryParams.set("experiment_id", selectedExperimentId.trim());
      }

      const [summaryResponse, experimentsResponse] = await Promise.all([
        fetch(`${apiBase}/admin/monetisation?${summaryParams.toString()}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${apiBase}/admin/monetisation/experiments?limit=12`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const [summaryPayload, experimentsPayload] = await Promise.all([
        summaryResponse.json().catch(() => null),
        experimentsResponse.json().catch(() => null),
      ]);

      if (!summaryResponse.ok) {
        throw new Error(
          summaryPayload &&
            typeof summaryPayload === "object" &&
            "error" in summaryPayload &&
            typeof summaryPayload.error === "string"
            ? summaryPayload.error
            : "Unable to load monetisation metrics."
        );
      }
      if (!experimentsResponse.ok) {
        throw new Error(
          experimentsPayload &&
            typeof experimentsPayload === "object" &&
            "error" in experimentsPayload &&
            typeof experimentsPayload.error === "string"
            ? experimentsPayload.error
            : "Unable to load monetisation experiments."
        );
      }

      const experimentsData = (experimentsPayload as MonetisationExperimentsResponse) ?? {
        active_experiment_id: null,
        experiments: [],
      };

      setSummary((summaryPayload as MonetisationSummary) ?? null);
      const nextExperiments = Array.isArray(experimentsData.experiments) ? experimentsData.experiments : [];
      setExperiments(nextExperiments);
      setActiveExperimentId(experimentsData.active_experiment_id ?? null);
      if (
        selectedExperimentId.trim().length > 0 &&
        !nextExperiments.some((experiment) => experiment.id === selectedExperimentId)
      ) {
        setSelectedExperimentId("");
      }
      setNotice(null);
    } catch (error) {
      setSummary(null);
      setExperiments([]);
      setActiveExperimentId(null);
      setNotice(getApiErrorMessage(error, "Unable to load monetisation metrics."));
    } finally {
      setLoading(false);
    }
  }, [apiBase, range, selectedExperimentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlockRatePercent = useMemo(
    () => (summary?.unlock_conversion_rate ?? 0) * 100,
    [summary?.unlock_conversion_rate]
  );

  const activeExperiment = useMemo(
    () =>
      experiments.find((experiment) => experiment.id === activeExperimentId) ??
      experiments.find((experiment) => experiment.is_active) ??
      null,
    [activeExperimentId, experiments]
  );

  const previousExperiments = useMemo(
    () => experiments.filter((experiment) => !experiment.is_active),
    [experiments]
  );

  const activeExperimentCount = useMemo(
    () => experiments.filter((experiment) => experiment.is_active).length,
    [experiments]
  );

  const canStartExperiment = canMutate && !experimentBusy && !loading && activeExperimentCount <= 1;

  const startExperiment = async () => {
    if (!session?.csrfToken) {
      setNotice("Sign in as admin with CSRF token available to start a pricing experiment.");
      return;
    }

    const detailedCredits = Math.floor(Number(detailedPriceCredits));
    const weeklyFree = Math.floor(Number(weeklyFreeUnlocks));
    if (!Number.isFinite(detailedCredits) || detailedCredits <= 0) {
      setNotice("Detailed report price credits must be greater than 0.");
      return;
    }
    if (!Number.isFinite(weeklyFree) || weeklyFree < 0 || weeklyFree > 14) {
      setNotice("Weekly free unlocks must be between 0 and 14.");
      return;
    }

    let parsedBundleStructure: unknown = null;
    try {
      parsedBundleStructure = JSON.parse(bundleStructureJson);
    } catch {
      setNotice("Bundle structure JSON is invalid.");
      return;
    }

    setExperimentBusy(true);
    try {
      const response = await fetch(`${apiBase}/admin/monetisation/experiments`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          detailedReportPriceCredits: detailedCredits,
          weeklyFreeUnlocks: weeklyFree,
          bundleStructureJson: parsedBundleStructure,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to start pricing experiment."
        );
      }

      setNotice("Pricing experiment started. Previous active experiment (if any) was closed.");
      await load();
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to start pricing experiment."));
    } finally {
      setExperimentBusy(false);
    }
  };

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Monetisation</h1>
      <p className="subtitle">
        Monitor unlock conversion, learner spend, weekly top-up throughput, and ARPU proxy.
      </p>
      <AdminQuickLinks />
      <div className="outline-actions">
        <button type="button" className="button" onClick={() => setRange("7d")} disabled={loading || range === "7d"}>
          Last 7 days
        </button>
        <button
          type="button"
          className="button"
          onClick={() => setRange("30d")}
          disabled={loading || range === "30d"}
        >
          Last 30 days
        </button>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <label className="list-item" style={{ marginTop: "0.75rem" }}>
        <strong>Summary scope</strong>
        <select
          value={selectedExperimentId}
          onChange={(event) => setSelectedExperimentId(event.target.value)}
          disabled={loading}
        >
          <option value="">Rolling range ({range})</option>
          {experiments.map((experiment) => (
            <option key={experiment.id} value={experiment.id}>
              {experiment.is_active ? "Active" : "Closed"} | {experiment.id.slice(0, 8)} |{" "}
              {experiment.detailed_report_price_credits} cr
            </option>
          ))}
        </select>
      </label>
      {notice ? <div className="badge">{notice}</div> : null}

      {loading ? (
        <p className="subtitle">Loading monetisation summary...</p>
      ) : !summary ? (
        <p className="subtitle">No monetisation summary available.</p>
      ) : (
        <>
          <div className="grid">
            <div className="list-item">
              <strong>Unlock conversion rate</strong>
              <p className="subtitle">{formatPercent(unlockRatePercent)}</p>
            </div>
            <div className="list-item">
              <strong>Average credits spent per learner</strong>
              <p className="subtitle">{summary.average_credits_spent_per_learner.toFixed(2)}</p>
            </div>
            <div className="list-item">
              <strong>Weekly top-up count</strong>
              <p className="subtitle">{summary.weekly_topup_count}</p>
            </div>
            <div className="list-item">
              <strong>ARPU proxy</strong>
              <p className="subtitle">{formatCurrency(summary.arpu_proxy_zar)}</p>
            </div>
          </div>
          <p className="subtitle">
            Scope: {summary.scope === "experiment" ? "experiment window" : "rolling range"} | Range: last{" "}
            {summary.range_days} days
          </p>
          {summary.scope === "experiment" && summary.experiment_id ? (
            <p className="subtitle">
              Experiment {summary.experiment_id} | {formatDateTime(summary.experiment_start_date)} to{" "}
              {formatDateTime(summary.experiment_end_date)}
            </p>
          ) : null}

          <div className="spacer" />
          <h3>Supporting totals</h3>
          <div className="grid">
            <div className="list-item">
              <strong>Total attempts</strong>
              <p className="subtitle">{summary.total_attempts}</p>
            </div>
            <div className="list-item">
              <strong>Total unlocks</strong>
              <p className="subtitle">{summary.total_unlocks}</p>
            </div>
            <div className="list-item">
              <strong>Total credits spent</strong>
              <p className="subtitle">{summary.total_credits_spent}</p>
            </div>
            <div className="list-item">
              <strong>Spending learners</strong>
              <p className="subtitle">{summary.spending_learners}</p>
            </div>
            <div className="list-item">
              <strong>Total top-up revenue</strong>
              <p className="subtitle">{formatCurrency(summary.total_topup_revenue_zar)}</p>
            </div>
            <div className="list-item">
              <strong>Active learners</strong>
              <p className="subtitle">{summary.active_learners}</p>
            </div>
          </div>
        </>
      )}

      <div className="spacer" />
      <h3>Pricing experiment log</h3>
      <p className="subtitle">
        Starting a new experiment closes any currently active experiment and creates the next sequential row.
      </p>
      {activeExperimentCount > 1 ? (
        <div className="badge">
          Multiple active experiments detected. New experiment creation is disabled until overlap is resolved.
        </div>
      ) : null}
      <div className="grid">
        <label className="list-item">
          <strong>Detailed report price (credits)</strong>
          <input
            type="number"
            min={1}
            value={detailedPriceCredits}
            onChange={(event) => setDetailedPriceCredits(event.target.value)}
          />
        </label>
        <label className="list-item">
          <strong>Weekly free unlocks</strong>
          <input
            type="number"
            min={0}
            max={14}
            value={weeklyFreeUnlocks}
            onChange={(event) => setWeeklyFreeUnlocks(event.target.value)}
          />
        </label>
        <label className="list-item" style={{ gridColumn: "1 / -1" }}>
          <strong>Bundle structure JSON</strong>
          <textarea
            rows={6}
            value={bundleStructureJson}
            onChange={(event) => setBundleStructureJson(event.target.value)}
          />
        </label>
      </div>
      <div className="outline-actions">
        <button
          type="button"
          className="button"
          onClick={() => void startExperiment()}
          disabled={!canStartExperiment}
        >
          {experimentBusy ? "Starting..." : "Start new pricing experiment"}
        </button>
      </div>

      {activeExperiment ? (
        <>
          <h3>Active experiment</h3>
          <div className="list-item">
            <strong>{activeExperiment.id}</strong>
            <p className="subtitle">
              Started {formatDateTime(activeExperiment.start_date)} | Detailed report:{" "}
              {activeExperiment.detailed_report_price_credits} credits | Weekly free unlocks:{" "}
              {activeExperiment.weekly_free_unlocks}
            </p>
          </div>
        </>
      ) : (
        <p className="subtitle">No active pricing experiment.</p>
      )}

      <h3>Previous experiments</h3>
      {!previousExperiments.length ? (
        <p className="subtitle">No previous experiments recorded yet.</p>
      ) : (
        <div className="list">
          {previousExperiments.map((experiment) => (
            <div className="list-item" key={experiment.id}>
              <strong>
                {experiment.is_active ? "Active" : "Closed"} | {experiment.id}
              </strong>
              <p className="subtitle">
                {formatDateTime(experiment.start_date)} to {formatDateTime(experiment.end_date)} | Duration:{" "}
                {experiment.duration_days.toFixed(2)} days
              </p>
              <p className="subtitle">
                Detailed report: {experiment.detailed_report_price_credits} credits | Weekly free unlocks:{" "}
                {experiment.weekly_free_unlocks}
              </p>
              <p className="subtitle">
                Unlock conversion: {formatPercent(experiment.metrics.unlock_conversion_rate * 100)} | Revenue:{" "}
                {formatCurrency(experiment.metrics.total_topup_revenue_zar)} | Top-ups:{" "}
                {experiment.metrics.topup_count}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
