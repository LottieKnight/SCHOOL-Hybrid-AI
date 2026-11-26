"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";

type MultistreamResult = {
  mode: "multistream";
  rate: number;
  bagasse: boolean;
  cap_zar: number;
  power_day: number;
  btc_day: number;
  raw_net: number;
  streams: Record<string, number>;
  streams_pct: Record<string, number>;
  total_gross: number;
  net_after_power: number;
  source: string;
};

type StressSite = {
  site: string;
  uptime: number;
  base: { net: number; mo: number; payback_mo: number | null; cap_zar: number; five_yr: number };
  mild: { net: number; mo: number; payback_mo: number | null; cap_zar: number; five_yr: number };
  severe: { net: number; mo: number; payback_mo: number | null; cap_zar: number; five_yr: number };
};

type StressResult = {
  mode: "stress";
  btc_base: number;
  btc_mild: number;
  btc_severe: number;
  fx_base: number;
  fx_crisis: number;
  sites: StressSite[];
  source: string;
};

const RATE_PRESETS = [
  { label: "R0.75 bagasse (baseline)", rate: 0.75 },
  { label: "R1.10 grid", rate: 1.1 },
  { label: "R1.50 grid", rate: 1.5 },
];

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

export default function AdminComputePage() {
  const apiBase = API_BASE;

  const [rate, setRate] = useState(0.75);
  const [heatPrice, setHeatPrice] = useState("0.30");
  const [gridRate, setGridRate] = useState("6");
  const [green, setGreen] = useState(true);

  const [multistream, setMultistream] = useState<MultistreamResult | null>(null);
  const [stress, setStress] = useState<StressResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMultistream = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const params = new URLSearchParams({
        rate: String(rate),
        heat_price: heatPrice,
        grid_rate: gridRate,
        green: green ? "1" : "0",
      });
      const response = await fetch(`${apiBase}/admin/compute/multistream?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as MultistreamResult | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Unable to run multi-stream calculator."
        );
      }
      setMultistream(payload);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to run multi-stream calculator."));
    } finally {
      setBusy(false);
    }
  }, [apiBase, rate, heatPrice, gridRate, green]);

  const loadStress = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/compute/stress`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as StressResult | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Unable to run crisis stress-test."
        );
      }
      setStress(payload);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to run crisis stress-test."));
    } finally {
      setBusy(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadMultistream();
    void loadStress();
  }, [loadMultistream, loadStress]);

  const streamLabels: Record<string, string> = {
    "1_raw_BTC": "Raw BTC (base)",
    "2_heat": "Heat by-product",
    "3_flex_load": "Flexible grid load",
    "4_green_premium": "Green-hashrate premium",
    "5_opt_IP": "Optimisation IP",
    "6_hw_residual": "Hardware residual",
  };

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Compute channel — by-product economics</h1>
      <p className="subtitle">
        Read-only reporting on the verified btc_*.py calculators. This is the economics surface only —
        no mining is built or operated from this dashboard.
      </p>
      <AdminQuickLinks />
      {notice ? <div className="badge">{notice}</div> : null}

      <div className="spacer" />
      <h3>Multi-stream (btc_multistream.py)</h3>
      <p className="subtitle">
        The cane: one rig produces raw BTC plus heat, flexible load, green-hashrate premium,
        optimisation IP and hardware residual. Configure and re-run to see the margin shift.
      </p>
      <div className="outline-actions">
        {RATE_PRESETS.map((preset) => (
          <button
            key={preset.rate}
            type="button"
            className="button"
            onClick={() => setRate(preset.rate)}
            disabled={busy || rate === preset.rate}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid">
        <label className="list-item">
          <strong>Heat price (R/kWh)</strong>
          <input
            type="number"
            step="0.05"
            value={heatPrice}
            onChange={(event) => setHeatPrice(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="list-item">
          <strong>Grid rate (R/kWh)</strong>
          <input
            type="number"
            step="0.5"
            value={gridRate}
            onChange={(event) => setGridRate(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="list-item">
          <strong>Green-hashrate premium</strong>
          <select value={green ? "1" : "0"} onChange={(event) => setGreen(event.target.value === "1")} disabled={busy}>
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
        </label>
      </div>
      <div className="outline-actions">
        <button type="button" className="button" onClick={() => void loadMultistream()} disabled={busy}>
          {busy ? "Running..." : "Re-run multi-stream"}
        </button>
      </div>

      {multistream ? (
        <>
          <div className="grid">
            <div className="list-item">
              <strong>Net after power</strong>
              <p className="subtitle">{formatCurrency(multistream.net_after_power)}/day</p>
            </div>
            <div className="list-item">
              <strong>Total gross streams</strong>
              <p className="subtitle">{formatCurrency(multistream.total_gross)}/day</p>
            </div>
            <div className="list-item">
              <strong>Raw BTC stream only</strong>
              <p className="subtitle">{formatCurrency(multistream.raw_net)}/day</p>
            </div>
            <div className="list-item">
              <strong>Cap cost</strong>
              <p className="subtitle">{formatCurrency(multistream.cap_zar)}</p>
            </div>
            <div className="list-item">
              <strong>Power draw</strong>
              <p className="subtitle">{multistream.power_day} kWh/day</p>
            </div>
          </div>
          <div className="list">
            {Object.entries(multistream.streams).map(([key, value]) => (
              <div key={key} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong>{streamLabels[key] ?? key}</strong>
                  <span style={{ opacity: 0.8 }}>
                    {formatCurrency(value)}/day · {formatPercent(multistream.streams_pct[key] ?? 0)} of raw BTC
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="subtitle">Source: {multistream.source} (live execution via calc-bridge)</p>
        </>
      ) : null}

      <div className="spacer" />
      <h3>Crisis stress-test (btc_sa_stress.py)</h3>
      <p className="subtitle">
        Base vs mild (-40% BTC, crisis FX) vs severe (-70% BTC, crisis FX) across candidate power
        sites. The only site that survives severe is the one with cheap, independent power.
      </p>
      {stress ? (
        <>
          <p className="subtitle">
            BTC: ${stress.btc_base.toLocaleString()} → mild ${stress.btc_mild.toLocaleString()} → severe $
            {stress.btc_severe.toLocaleString()} · FX {stress.fx_base} → {stress.fx_crisis}
          </p>
          <div className="list">
            {stress.sites.map((site) => (
              <div key={site.site} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong>{site.site}</strong>
                  <span style={{ opacity: 0.8 }}>uptime {formatPercent(site.uptime * 100)}</span>
                </div>
                <div className="grid" style={{ marginTop: "0.5rem" }}>
                  <div className="list-item">
                    <strong>Base net</strong>
                    <p className="subtitle">{formatCurrency(site.base.net)}/day</p>
                  </div>
                  <div className="list-item">
                    <strong>Mild crisis</strong>
                    <p className="subtitle">{formatCurrency(site.mild.net)}/day</p>
                  </div>
                  <div className="list-item">
                    <strong>Severe crisis</strong>
                    <p className="subtitle" style={{ color: site.severe.net > 0 ? "var(--green, #2E8B57)" : "var(--red, #C0392B)" }}>
                      {formatCurrency(site.severe.net)}/day
                    </p>
                  </div>
                  <div className="list-item">
                    <strong>Payback (severe)</strong>
                    <p className="subtitle">{site.severe.payback_mo == null ? "never" : `${site.severe.payback_mo} mo`}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="subtitle">Source: {stress.source} (live execution via calc-bridge)</p>
        </>
      ) : null}
    </div>
  );
}
