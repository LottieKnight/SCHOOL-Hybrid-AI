"use client";

import { useCallback } from "react";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";
import { useCachedData, useOfflineStatus } from "../hooks/useOffline";
import { cacheAPIResponse } from "@/lib/offline/offline-db";
import {
  CREDITS_BALANCE_URL,
  CreditsBalance,
  VENTURE_ORDER,
  fetchCreditsBalance,
  getSourceDisplayName,
  getVentureDisplayName,
} from "@/lib/credits/creditClient";

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toLocaleString();
}

function ScholarCreditsData() {
  const { online, syncStatus, forceSync } = useOfflineStatus();

  const loadBalance = useCallback(async () => {
    const balance = await fetchCreditsBalance();
    try {
      await cacheAPIResponse(
        CREDITS_BALANCE_URL(),
        new Response(JSON.stringify(balance), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    } catch {
      // Caching is best-effort — offline fallback still works via previous writes.
    }
    return balance;
  }, []);

  const { data, loading, error, fromCache, refresh } = useCachedData<CreditsBalance>(
    CREDITS_BALANCE_URL(),
    loadBalance
  );

  const handleSyncNow = useCallback(async () => {
    await forceSync();
    await refresh();
  }, [forceSync, refresh]);

  const wallets = data
    ? [...data.wallets].sort(
        (a, b) =>
          VENTURE_ORDER.indexOf(a.venture as (typeof VENTURE_ORDER)[number]) -
          VENTURE_ORDER.indexOf(b.venture as (typeof VENTURE_ORDER)[number])
      )
    : [];

  return (
    <div className="list">
      <div className="list-item">
        <div className="badge" style={{ marginBottom: "var(--space-2)" }}>
          {online ? "Online" : "Offline"}
          {fromCache ? " · showing saved copy" : ""}
          {syncStatus.pending > 0 ? ` · ${syncStatus.pending} queued change(s) awaiting sync` : ""}
        </div>
        {syncStatus.pending > 0 || syncStatus.failed > 0 ? (
          <button className="button" type="button" onClick={() => void handleSyncNow()}>
            Sync now
          </button>
        ) : null}
      </div>

      <div className="list-item">
        <strong>Scholar Credits balance</strong>
        <p className="title">{data ? `${data.balance.toLocaleString()} credits` : loading ? "Loading..." : "--"}</p>
        <p className="subtitle">
          {data
            ? `Lifetime earned ${data.lifetimeEarned.toLocaleString()} · spent ${data.lifetimeSpent.toLocaleString()}`
            : "Earned across every Ditshego venture — SCHOOL, AURA, SPHERE, NPC, ROCKIT, SCENE, LOGISTICS, V4NTAG3."}
        </p>
      </div>

      <div className="list-item">
        <strong>Current streak</strong>
        <p className="title">{data ? `${data.currentStreak} day${data.currentStreak === 1 ? "" : "s"}` : "--"}</p>
        <p className="subtitle">{data ? `Longest streak: ${data.longestStreak} days` : "Log in daily to grow your streak."}</p>
      </div>

      <div className="list-item">
        <strong>Balances per venture</strong>
        {loading ? (
          <p className="subtitle">Loading balances...</p>
        ) : wallets.length === 0 ? (
          <p className="subtitle">
            No credit activity yet. Complete quizzes, upload past papers, and take part across the ventures to earn your
            first credits.
          </p>
        ) : (
          <div className="app-data-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Venture</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((wallet) => (
                  <tr key={wallet.id}>
                    <td>{getVentureDisplayName(wallet.venture)}</td>
                    <td>{wallet.balance.toLocaleString()} credits</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="list-item">
        <strong>Recent activity</strong>
        {loading ? (
          <p className="subtitle">Loading activity...</p>
        ) : !data || data.recentTransactions.length === 0 ? (
          <p className="subtitle">No activity yet.</p>
        ) : (
          <div className="list">
            {data.recentTransactions.map((transaction) => (
              <div className="list-item" key={transaction.id}>
                <strong>
                  {transaction.amount >= 0 ? "+" : ""}
                  {transaction.amount.toLocaleString()} credits
                  <span className="badge">{getVentureDisplayName(transaction.venture)}</span>
                </strong>
                <p className="subtitle">{transaction.description}</p>
                <p className="badge">
                  {getSourceDisplayName(transaction.source)} · {formatDateTime(transaction.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="list-item">
          <p className="badge">{error.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export function ScholarCreditsClient() {
  const { session, loading } = useSession();

  if (loading) {
    return <StateCard title="Loading..." description="Checking your Scholar Credits..." />;
  }

  if (!session) {
    return (
      <StateCard
        title="Sign in required"
        description="Sign in to view your Scholar Credits balance, streaks, and activity."
      />
    );
  }

  return <ScholarCreditsData />;
}
