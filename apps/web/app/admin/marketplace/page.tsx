"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type SkuRow = {
  sku: string;
  units: number;
  rev: number;
  ret: number;
  net_units: number;
  ret_rate: number;
  cum_pct: number;
  decision: string;
};

type AnalyticsResult = {
  skus: SkuRow[];
  total_revenue: number;
  total_units: number;
  pareto_pct: number;
  n_top: number;
  cap_n: number;
  keeps: number;
  watch: number;
  culls: number;
  stretch_signal: string[];
  source: string;
};

type KpiRow = {
  kpi: string;
  value: number;
  op: string;
  target: number;
  pass: boolean;
};

type PilotResult = {
  landed_cost_pct: number;
  landed_cost: number;
  source_cost: number;
  ddp_cost: number;
  gross_margin: number;
  gross_margin_pct: number;
  monthly_units: number;
  monthly_revenue: number;
  monthly_margin: number;
  breakeven_units: number | null;
  scorecard: KpiRow[];
  source: string;
};

type OrderMargin = {
  orderId: string;
  status: string;
  payment_status: string | null;
  items: number;
  retail: number;
  margin: number;
  margin_pct: number;
  gateway_fee: number;
  courier: number;
};

type MarginsResult = {
  per_order: OrderMargin[];
  totals: {
    orders_resolved: number;
    total_retail: number;
    total_margin: number;
    margin_pct: number;
  };
  source: string;
};

const DEMO_CSV = `sku,units_sold,revenue,returns
exercise-book,320,11200,2
calculator,41,13940,1
planner,12,1548,3
stationery-kit,150,26850,5`;

const KPI_LABELS: Record<string, string> = {
  lead_time_days: "Lead time (days)",
  damage_rate: "Damage rate",
  customs_hrs: "Customs (hours)",
  landed_cost_pct: "Landed cost %",
  return_rate: "Return rate",
  nonpay_rate: "Non-payment rate",
};

function formatCurrency(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

function formatPercent(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1)}%`;
}

function parseCsv(raw: string): Array<{ sku: string; units_sold: number; revenue: number; returns: number }> {
  const rows: Array<{ sku: string; units_sold: number; revenue: number; returns: number }> = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [sku, units_sold, revenue, returns = "0"] = trimmed.split(",").map((cell) => cell.trim());
    if (!sku || /^sku$/i.test(sku)) continue;
    const units = Number(units_sold);
    const rev = Number(revenue);
    if (!Number.isFinite(units) || !Number.isFinite(rev)) continue;
    rows.push({ sku, units_sold: units, revenue: rev, returns: Number.isFinite(Number(returns)) ? Number(returns) : 0 });
  }
  return rows;
}

export default function AdminMarketplacePage() {
  const { session } = useSession();
  const apiBase = API_BASE;

  const [csv, setCsv] = useState(DEMO_CSV);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);

  const [kpiForm, setKpiForm] = useState({
    lead_time_days: "9",
    damage_rate: "0.01",
    customs_hrs: "40",
    return_rate: "0.04",
    nonpay_rate: "0.02",
  });
  const [pilot, setPilot] = useState<PilotResult | null>(null);
  const [kpiBusy, setKpiBusy] = useState(false);

  const [margins, setMargins] = useState<MarginsResult | null>(null);
  const [marginsBusy, setMarginsBusy] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  const canMutate = Boolean(session?.csrfToken);

  const runAnalytics = useCallback(async () => {
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      setNotice("CSV has no valid rows. Expected: sku,units_sold,revenue,returns");
      return;
    }
    setAnalyticsBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/marketplace/analytics/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.csrfToken ? { "x-csrf-token": session.csrfToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ rows }),
      });
      const payload = (await response.json().catch(() => null)) as AnalyticsResult | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Unable to run SKU cull."
        );
      }
      setAnalytics(payload);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to run SKU cull."));
    } finally {
      setAnalyticsBusy(false);
    }
  }, [apiBase, csv, session?.csrfToken]);

  const loadPilot = useCallback(async () => {
    setKpiBusy(true);
    try {
      const response = await fetch(`${apiBase}/admin/marketplace/pilot`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as PilotResult | null;
      if (response.ok && payload) setPilot(payload);
    } catch {
      // Pilot economics are informational; a failure is not fatal.
    } finally {
      setKpiBusy(false);
    }
  }, [apiBase]);

  const runKpi = useCallback(async () => {
    setKpiBusy(true);
    setNotice(null);
    try {
      const body = {
        lead_time_days: Number(kpiForm.lead_time_days),
        damage_rate: Number(kpiForm.damage_rate),
        customs_hrs: Number(kpiForm.customs_hrs),
        return_rate: Number(kpiForm.return_rate),
        nonpay_rate: Number(kpiForm.nonpay_rate),
      };
      const response = await fetch(`${apiBase}/admin/marketplace/analytics/kpi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.csrfToken ? { "x-csrf-token": session.csrfToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as PilotResult | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Unable to run KPI gate."
        );
      }
      setPilot(payload);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to run KPI gate."));
    } finally {
      setKpiBusy(false);
    }
  }, [apiBase, kpiForm, session?.csrfToken]);

  const loadMargins = useCallback(async () => {
    setMarginsBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/marketplace/orders/margins`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as MarginsResult | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Unable to load order margins."
        );
      }
      setMargins(payload);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to load order margins."));
    } finally {
      setMarginsBusy(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void runAnalytics();
    void loadPilot();
  }, [runAnalytics, loadPilot]);

  const decisionTone = useMemo(() => {
    return (decision: string) => {
      if (decision.startsWith("KEEP")) return { color: "var(--green, #2E8B57)", fontWeight: 600 };
      if (decision.startsWith("CULL")) return { color: "var(--red, #C0392B)", fontWeight: 600 };
      return { color: "var(--amber-dark, #C98A00)", fontWeight: 600 };
    };
  }, []);

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Marketplace curation</h1>
      <p className="subtitle">
        Weekly Pareto SKU cull, delivery-KPI gate, and real dropship margins — all wired to the
        verified school_*.py calculators via the calc-bridge.
      </p>
      <AdminQuickLinks />
      {notice ? <div className="badge">{notice}</div> : null}

      <div className="spacer" />
      <h3>1 · SKU cull (school_analytics.py)</h3>
      <p className="subtitle">
        Paste weekly sales as CSV: <code>sku,units_sold,revenue,returns</code>. Output is the
        KEEP / WATCH / CULL table plus the stretch signal. Demo data is pre-loaded.
      </p>
      <textarea
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        rows={7}
        spellCheck={false}
        style={{ width: "100%", fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" }}
      />
      <div className="outline-actions">
        <button
          type="button"
          className="button"
          onClick={() => void runAnalytics()}
          disabled={analyticsBusy || !canMutate}
        >
          {analyticsBusy ? "Running..." : "Run cull"}
        </button>
        <button type="button" className="button" onClick={() => setCsv(DEMO_CSV)}>
          Reset demo
        </button>
      </div>

      {analytics ? (
        <>
          <div className="grid">
            <div className="list-item">
              <strong>Pareto coverage</strong>
              <p className="subtitle">{formatPercent(analytics.pareto_pct)} in top {analytics.n_top} SKU(s)</p>
            </div>
            <div className="list-item">
              <strong>Decision counts</strong>
              <p className="subtitle">
                {analytics.keeps} KEEP · {analytics.watch} WATCH · {analytics.culls} CULL
              </p>
            </div>
            <div className="list-item">
              <strong>Total revenue</strong>
              <p className="subtitle">{formatCurrency(analytics.total_revenue)}</p>
            </div>
            <div className="list-item">
              <strong>Total units</strong>
              <p className="subtitle">{analytics.total_units}</p>
            </div>
          </div>
          <div className="list">
            {analytics.skus.map((row) => (
              <div key={row.sku} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong style={decisionTone(row.decision)}>{row.sku}</strong>
                  <span style={{ opacity: 0.8 }}>
                    {formatCurrency(row.rev)} · {row.units} units · {formatPercent(row.ret_rate)} returns ·{" "}
                    {formatPercent(row.cum_pct)} cumulative
                  </span>
                </div>
                <p className="subtitle">{row.decision}</p>
              </div>
            ))}
          </div>
          {analytics.stretch_signal.length > 0 ? (
            <p className="subtitle">
              <strong>Stretch signal:</strong> WATCH items with ≥ half of core median units —{" "}
              {analytics.stretch_signal.join(", ")}. Consider promoting on evidence.
            </p>
          ) : (
            <p className="subtitle">No stretch candidates this run.</p>
          )}
          <p className="subtitle">Source: {analytics.source} (live execution via calc-bridge)</p>
        </>
      ) : null}

      <div className="spacer" />
      <h3>2 · Delivery-KPI gate (school_pilot.py)</h3>
      <p className="subtitle">
        Inputs gate against the pilot targets: lead time &lt; 10 days, damage &lt; 2%, customs &lt; 48h,
        landed &lt; 35%, returns &lt; 5%, non-payment &lt; 3%.
      </p>
      <div className="grid">
        <label className="list-item">
          <strong>Lead time (days)</strong>
          <input
            type="number"
            step="0.1"
            value={kpiForm.lead_time_days}
            onChange={(event) => setKpiForm((prev) => ({ ...prev, lead_time_days: event.target.value }))}
          />
        </label>
        <label className="list-item">
          <strong>Damage rate (0–1)</strong>
          <input
            type="number"
            step="0.005"
            value={kpiForm.damage_rate}
            onChange={(event) => setKpiForm((prev) => ({ ...prev, damage_rate: event.target.value }))}
          />
        </label>
        <label className="list-item">
          <strong>Customs (hours)</strong>
          <input
            type="number"
            step="1"
            value={kpiForm.customs_hrs}
            onChange={(event) => setKpiForm((prev) => ({ ...prev, customs_hrs: event.target.value }))}
          />
        </label>
        <label className="list-item">
          <strong>Return rate (0–1)</strong>
          <input
            type="number"
            step="0.005"
            value={kpiForm.return_rate}
            onChange={(event) => setKpiForm((prev) => ({ ...prev, return_rate: event.target.value }))}
          />
        </label>
        <label className="list-item">
          <strong>Non-payment rate (0–1)</strong>
          <input
            type="number"
            step="0.005"
            value={kpiForm.nonpay_rate}
            onChange={(event) => setKpiForm((prev) => ({ ...prev, nonpay_rate: event.target.value }))}
          />
        </label>
      </div>
      <div className="outline-actions">
        <button type="button" className="button" onClick={() => void runKpi()} disabled={kpiBusy || !canMutate}>
          {kpiBusy ? "Running..." : "Run KPI gate"}
        </button>
        <button type="button" className="button" onClick={() => void loadPilot()} disabled={kpiBusy}>
          Baseline pilot
        </button>
      </div>

      {pilot ? (
        <>
          <div className="grid">
            <div className="list-item">
              <strong>Landed cost</strong>
              <p className="subtitle">{formatCurrency(pilot.landed_cost)} ({formatPercent(pilot.landed_cost_pct)})</p>
            </div>
            <div className="list-item">
              <strong>Gross margin</strong>
              <p className="subtitle">{formatCurrency(pilot.gross_margin)} ({formatPercent(pilot.gross_margin_pct)})</p>
            </div>
            <div className="list-item">
              <strong>Monthly margin (all markets)</strong>
              <p className="subtitle">{formatCurrency(pilot.monthly_margin)}</p>
            </div>
          </div>
          <div className="list">
            {pilot.scorecard.map((row) => (
              <div key={row.kpi} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong>{KPI_LABELS[row.kpi] ?? row.kpi}</strong>
                  <span style={{ color: row.pass ? "var(--green, #2E8B57)" : "var(--red, #C0392B)", fontWeight: 600 }}>
                    {row.pass ? "PASS" : "FAIL"}
                  </span>
                </div>
                <p className="subtitle">
                  {row.kpi === "landed_cost_pct"
                    ? formatPercent(row.value * 100)
                    : row.value}{" "}
                  target {row.op} {row.target}
                </p>
              </div>
            ))}
          </div>
          <p className="subtitle">Source: {pilot.source} (live execution via calc-bridge)</p>
        </>
      ) : null}

      <div className="spacer" />
      <h3>3 · Real order margins (school_dropship.py)</h3>
      <p className="subtitle">
        Live store orders resolved against wholesale + courier cost per product — the R0 loop margin math.
      </p>
      <div className="outline-actions">
        <button type="button" className="button" onClick={() => void loadMargins()} disabled={marginsBusy}>
          {marginsBusy ? "Loading..." : "Load order margins"}
        </button>
      </div>

      {margins ? (
        <>
          <div className="grid">
            <div className="list-item">
              <strong>Orders resolved</strong>
              <p className="subtitle">{margins.totals.orders_resolved}</p>
            </div>
            <div className="list-item">
              <strong>Total retail</strong>
              <p className="subtitle">{formatCurrency(margins.totals.total_retail)}</p>
            </div>
            <div className="list-item">
              <strong>Total margin</strong>
              <p className="subtitle">{formatCurrency(margins.totals.total_margin)}</p>
            </div>
            <div className="list-item">
              <strong>Blended margin</strong>
              <p className="subtitle">{formatPercent(margins.totals.margin_pct)}</p>
            </div>
          </div>
          <div className="list">
            {margins.per_order.map((row) => (
              <div key={row.orderId} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong>{row.orderId}</strong>
                  <span style={{ opacity: 0.8 }}>
                    {row.status} · {row.payment_status ?? "n/a"} · {row.items} item(s)
                  </span>
                </div>
                <p className="subtitle">
                  Retail {formatCurrency(row.retail)} → margin {formatCurrency(row.margin)} (
                  {formatPercent(row.margin_pct)}) · gateway {formatCurrency(row.gateway_fee)} · courier{" "}
                  {formatCurrency(row.courier)}
                </p>
              </div>
            ))}
            {margins.per_order.length === 0 ? (
              <p className="subtitle">No resolvable store orders yet.</p>
            ) : null}
          </div>
          <p className="subtitle">Source: {margins.source} (live execution via calc-bridge)</p>
        </>
      ) : null}
    </div>
  );
}
