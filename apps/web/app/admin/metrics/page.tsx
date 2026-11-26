"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";

type UnlockFunnelSummary = {
  total_attempts: number;
  total_unlocks: number;
  unlock_conversion_rate: number;
};

type QuoteFunnelSummary = {
  total_quotes: number;
  answered_rate: number;
  closed_rate: number;
};

type WalletSummary = {
  total_wallet_accounts: number;
  total_credits_issued: number;
  total_credits_debited: number;
  net_outstanding_credits: number;
};

function formatPercent(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1)}%`;
}

export default function AdminMetricsPage() {
  const apiBase = API_BASE;
  const [unlock, setUnlock] = useState<UnlockFunnelSummary | null>(null);
  const [quotes, setQuotes] = useState<QuoteFunnelSummary | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [unlockRes, quotesRes, walletRes] = await Promise.all([
        fetch(`${apiBase}/admin/funnels/unlock`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${apiBase}/admin/funnels/quotes`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${apiBase}/admin/wallet/summary`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const [unlockPayload, quotesPayload, walletPayload] = await Promise.all([
        unlockRes.json().catch(() => null),
        quotesRes.json().catch(() => null),
        walletRes.json().catch(() => null),
      ]);

      if (!unlockRes.ok || !quotesRes.ok || !walletRes.ok) {
        throw new Error("Unable to load admin metrics.");
      }

      setUnlock((unlockPayload as UnlockFunnelSummary) ?? null);
      setQuotes((quotesPayload as QuoteFunnelSummary) ?? null);
      setWallet((walletPayload as WalletSummary) ?? null);
      setNotice(null);
    } catch (error) {
      setUnlock(null);
      setQuotes(null);
      setWallet(null);
      setNotice(getApiErrorMessage(error, "Unable to load admin metrics."));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlockRatePercent = useMemo(
    () => (unlock?.unlock_conversion_rate ?? 0) * 100,
    [unlock?.unlock_conversion_rate]
  );
  const quoteAnsweredRatePercent = useMemo(
    () => (quotes?.answered_rate ?? 0) * 100,
    [quotes?.answered_rate]
  );
  const quoteClosedRatePercent = useMemo(
    () => (quotes?.closed_rate ?? 0) * 100,
    [quotes?.closed_rate]
  );

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Admin metrics</h1>
      <p className="subtitle">Aggregated unlock funnel, quote funnel, and wallet health indicators.</p>
      <AdminQuickLinks />
      <div className="outline-actions">
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {notice ? <div className="badge">{notice}</div> : null}

      <h3>Unlock funnel</h3>
      {loading ? (
        <p className="subtitle">Loading unlock metrics...</p>
      ) : !unlock ? (
        <p className="subtitle">Unlock funnel data unavailable.</p>
      ) : (
        <div className="grid">
          <div className="list-item">
            <strong>Total attempts</strong>
            <p className="subtitle">{unlock.total_attempts}</p>
          </div>
          <div className="list-item">
            <strong>Total unlocks</strong>
            <p className="subtitle">{unlock.total_unlocks}</p>
          </div>
          <div className="list-item">
            <strong>Conversion rate</strong>
            <p className="subtitle">{formatPercent(unlockRatePercent)}</p>
          </div>
        </div>
      )}

      <div className="spacer" />
      <h3>Quote funnel</h3>
      {loading ? (
        <p className="subtitle">Loading quote funnel...</p>
      ) : !quotes ? (
        <p className="subtitle">Quote funnel data unavailable.</p>
      ) : (
        <div className="grid">
          <div className="list-item">
            <strong>Total quotes</strong>
            <p className="subtitle">{quotes.total_quotes}</p>
          </div>
          <div className="list-item">
            <strong>Answered rate</strong>
            <p className="subtitle">{formatPercent(quoteAnsweredRatePercent)}</p>
          </div>
          <div className="list-item">
            <strong>Closed rate</strong>
            <p className="subtitle">{formatPercent(quoteClosedRatePercent)}</p>
          </div>
        </div>
      )}

      <div className="spacer" />
      <h3>Wallet summary</h3>
      {loading ? (
        <p className="subtitle">Loading wallet summary...</p>
      ) : !wallet ? (
        <p className="subtitle">Wallet summary unavailable.</p>
      ) : (
        <div className="grid">
          <div className="list-item">
            <strong>Wallet accounts</strong>
            <p className="subtitle">{wallet.total_wallet_accounts}</p>
          </div>
          <div className="list-item">
            <strong>Credits issued</strong>
            <p className="subtitle">{wallet.total_credits_issued}</p>
          </div>
          <div className="list-item">
            <strong>Credits debited</strong>
            <p className="subtitle">{wallet.total_credits_debited}</p>
          </div>
          <div className="list-item">
            <strong>Outstanding credits</strong>
            <p className="subtitle">{wallet.net_outstanding_credits}</p>
          </div>
        </div>
      )}
    </div>
  );
}
