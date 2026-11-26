"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";

type WalletSummary = {
  total_wallet_accounts: number;
  total_credits_issued: number;
  total_credits_debited: number;
  net_outstanding_credits: number;
};

type WalletReconcileMismatch = {
  user_id: string;
  account_balance_credits: number | null;
  ledger_computed_balance_credits: number | null;
  difference_credits: number;
  has_account: boolean;
  has_ledger: boolean;
};

type WalletReconcile = {
  checked_wallet_accounts: number;
  checked_ledger_users: number;
  account_balance_total_credits: number;
  ledger_net_total_credits: number;
  mismatch_count: number;
  mismatches: WalletReconcileMismatch[];
};

function formatCredits(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${Math.trunc(value)} credits`;
}

export default function AdminWalletHealthPage() {
  const apiBase = API_BASE;
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [reconcile, setReconcile] = useState<WalletReconcile | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [runningReconcile, setRunningReconcile] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const hasMismatch = useMemo(() => (reconcile?.mismatch_count ?? 0) > 0, [reconcile]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch(`${apiBase}/admin/wallet/summary`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as WalletSummary | { error?: string } | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load wallet summary."
        );
      }
      setSummary((payload as WalletSummary) ?? null);
      setNotice(null);
    } catch (error) {
      setSummary(null);
      setNotice(getApiErrorMessage(error, "Unable to load wallet summary."));
    } finally {
      setLoadingSummary(false);
    }
  }, [apiBase]);

  const runReconcile = useCallback(async () => {
    setRunningReconcile(true);
    try {
      const response = await fetch(`${apiBase}/admin/wallet/reconcile`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as WalletReconcile | { error?: string } | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to reconcile wallet balances."
        );
      }
      setReconcile((payload as WalletReconcile) ?? null);
      setNotice(null);
    } catch (error) {
      setReconcile(null);
      setNotice(getApiErrorMessage(error, "Unable to reconcile wallet balances."));
    } finally {
      setRunningReconcile(false);
    }
  }, [apiBase]);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadSummary(), runReconcile()]);
      } catch {
        return;
      }
    })();
  }, [loadSummary, runReconcile]);

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Wallet health</h1>
      <p className="subtitle">
        Operational wallet diagnostics for issued/debited credits and ledger reconciliation checks.
      </p>
      <AdminQuickLinks />
      <div className="outline-actions">
        <button type="button" className="button" onClick={() => void loadSummary()} disabled={loadingSummary}>
          {loadingSummary ? "Loading summary..." : "Refresh summary"}
        </button>
        <button type="button" className="button" onClick={() => void runReconcile()} disabled={runningReconcile}>
          {runningReconcile ? "Reconciling..." : "Run reconcile"}
        </button>
      </div>
      {notice ? <div className="badge">{notice}</div> : null}

      <h3>Summary</h3>
      {loadingSummary ? (
        <p className="subtitle">Loading wallet summary...</p>
      ) : !summary ? (
        <p className="subtitle">No wallet summary available.</p>
      ) : (
        <div className="grid">
          <div className="list-item">
            <strong>Total wallet accounts</strong>
            <p className="subtitle">{summary.total_wallet_accounts}</p>
          </div>
          <div className="list-item">
            <strong>Total credits issued</strong>
            <p className="subtitle">{formatCredits(summary.total_credits_issued)}</p>
          </div>
          <div className="list-item">
            <strong>Total credits debited</strong>
            <p className="subtitle">{formatCredits(summary.total_credits_debited)}</p>
          </div>
          <div className="list-item">
            <strong>Net outstanding credits</strong>
            <p className="subtitle">{formatCredits(summary.net_outstanding_credits)}</p>
          </div>
        </div>
      )}

      <div className="spacer" />
      <h3>Reconciliation</h3>
      {runningReconcile ? (
        <p className="subtitle">Running wallet reconciliation...</p>
      ) : !reconcile ? (
        <p className="subtitle">No reconciliation data available.</p>
      ) : (
        <>
          <div className="grid">
            <div className="list-item">
              <strong>Checked wallet accounts</strong>
              <p className="subtitle">{reconcile.checked_wallet_accounts}</p>
            </div>
            <div className="list-item">
              <strong>Checked ledger users</strong>
              <p className="subtitle">{reconcile.checked_ledger_users}</p>
            </div>
            <div className="list-item">
              <strong>Account balance total</strong>
              <p className="subtitle">{formatCredits(reconcile.account_balance_total_credits)}</p>
            </div>
            <div className="list-item">
              <strong>Ledger net total</strong>
              <p className="subtitle">{formatCredits(reconcile.ledger_net_total_credits)}</p>
            </div>
            <div className="list-item">
              <strong>Mismatch count</strong>
              <p className="subtitle">{reconcile.mismatch_count}</p>
            </div>
          </div>
          <p className="subtitle">
            {hasMismatch
              ? "Reconciliation found mismatches. Investigate before any manual correction."
              : "No wallet mismatches detected."}
          </p>
          {reconcile.mismatch_count > 0 ? (
            <div className="list">
              {reconcile.mismatches.map((mismatch) => (
                <article className="list-item" key={mismatch.user_id}>
                  <strong>{mismatch.user_id}</strong>
                  <p className="subtitle">
                    Account: {formatCredits(mismatch.account_balance_credits)} | Ledger:{" "}
                    {formatCredits(mismatch.ledger_computed_balance_credits)}
                  </p>
                  <p className="subtitle">Difference: {formatCredits(mismatch.difference_credits)}</p>
                  <p className="subtitle">
                    Sources: account={mismatch.has_account ? "yes" : "no"} | ledger={mismatch.has_ledger ? "yes" : "no"}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
