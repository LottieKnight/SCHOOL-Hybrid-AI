"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";
import { getStoredLiteMode } from "@/lib/liteMode";
import { formatZar } from "@/lib/formatZar";

type WalletBalance = {
  userId: string;
  balanceCredits: number;
  currency: "ZAR" | string;
  createdAt: string | null;
};

type WalletPricingBundle = {
  id: string;
  name: string;
  description: string;
  amountZar: number;
  bonusPercent: number;
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
};

type WalletPricing = {
  currency: "ZAR" | string;
  creditsPerZar: number;
  minTopupZar: number;
  maxTopupZar: number;
  detailedReportCredits?: number;
  featurePrices?: {
    detailedReportCredits?: number;
  };
  bundles?: WalletPricingBundle[];
};

type WalletLedgerEntry = {
  id: string;
  type: "CREDIT" | "DEBIT";
  amountCredits: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
};

type WalletTopupCreateResponse = {
  selection?: {
    amountZar?: number;
    baseCredits?: number;
    bonusCredits?: number;
    totalCredits?: number;
    bundle?: {
      id?: string;
      name?: string;
      description?: string;
      bonusPercent?: number;
    } | null;
  };
  checkout?: {
    provider?: string;
    checkoutUrl?: string | null;
    note?: string;
  };
};

const DEFAULT_CREDITS_PER_ZAR = 100;

const TOPUP_BUNDLE_FALLBACK = [
  {
    id: "starter",
    name: "Starter",
    description: "Entry bundle for one or two detailed report unlocks.",
    amountZar: 10,
    bonusPercent: 0,
  },
  {
    id: "growth",
    name: "Growth",
    description: "Most popular bundle with bonus credits.",
    amountZar: 25,
    bonusPercent: 10,
  },
  {
    id: "mastery",
    name: "Mastery",
    description: "Best value bundle for frequent unlocks.",
    amountZar: 50,
    bonusPercent: 20,
  },
] as const;

function formatCurrency(amount: number) {
  return formatZar(amount);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toLocaleString();
}

export function WalletPageClient({ detailedReportCredits }: { detailedReportCredits: number }) {
  const { session } = useSession();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [pricing, setPricing] = useState<WalletPricing | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [topupPendingKey, setTopupPendingKey] = useState<string | null>(null);
  const [liteMode, setLiteMode] = useState(false);

  const apiBase = API_BASE;

  useEffect(() => {
    setLiteMode(getStoredLiteMode() === true);
  }, []);

  const loadWallet = useCallback(async () => {
    if (!session) {
      setWallet(null);
      setPricing(null);
      setLedger([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [balanceResponse, ledgerResponse] = await Promise.all([
        fetch(`${apiBase}/wallet/balance`, { credentials: "include" }),
        fetch(`${apiBase}/wallet/ledger?limit=20`, { credentials: "include" }),
      ]);

      if (!balanceResponse.ok) {
        throw new Error("Unable to load wallet balance.");
      }
      if (!ledgerResponse.ok) {
        throw new Error("Unable to load wallet ledger.");
      }

      const balancePayload = (await balanceResponse.json()) as {
        wallet?: WalletBalance;
        pricing?: WalletPricing;
      };
      const ledgerPayload = (await ledgerResponse.json()) as { entries?: WalletLedgerEntry[] };

      setWallet(balancePayload.wallet ?? null);
      setPricing(balancePayload.pricing ?? null);
      setLedger(Array.isArray(ledgerPayload.entries) ? ledgerPayload.entries : []);
      setNotice(null);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to load wallet."));
    } finally {
      setLoading(false);
    }
  }, [apiBase, session]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const effectiveDetailedReportCredits = useMemo(() => {
    const direct = Number(pricing?.detailedReportCredits);
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

    const nested = Number(pricing?.featurePrices?.detailedReportCredits);
    if (Number.isFinite(nested) && nested > 0) return Math.round(nested);

    return detailedReportCredits;
  }, [detailedReportCredits, pricing?.detailedReportCredits, pricing?.featurePrices?.detailedReportCredits]);

  const detailedReportApproxZar = useMemo(() => {
    if (!pricing?.creditsPerZar || pricing.creditsPerZar <= 0) return null;
    return effectiveDetailedReportCredits / pricing.creditsPerZar;
  }, [effectiveDetailedReportCredits, pricing]);

  const bundleOptions = useMemo(() => {
    const creditsPerZar =
      Number.isFinite(pricing?.creditsPerZar) && Number(pricing?.creditsPerZar) > 0
        ? Number(pricing?.creditsPerZar)
        : DEFAULT_CREDITS_PER_ZAR;

    const apiBundles = Array.isArray(pricing?.bundles) ? pricing.bundles : [];
    if (apiBundles.length > 0) {
      return apiBundles
        .filter((bundle) => Number.isFinite(bundle.amountZar) && bundle.amountZar > 0)
        .map((bundle) => ({
          ...bundle,
          amountZar: Number(bundle.amountZar.toFixed(2)),
          baseCredits: Math.max(1, Math.round(bundle.baseCredits)),
          bonusCredits: Math.max(0, Math.round(bundle.bonusCredits)),
          totalCredits: Math.max(1, Math.round(bundle.totalCredits)),
          bonusPercent: Math.max(0, Math.round(bundle.bonusPercent)),
        }));
    }

    return TOPUP_BUNDLE_FALLBACK.map((bundle) => {
      const baseCredits = Math.max(1, Math.round(bundle.amountZar * creditsPerZar));
      const bonusCredits = Math.max(0, Math.round(baseCredits * (bundle.bonusPercent / 100)));
      return {
        ...bundle,
        baseCredits,
        bonusCredits,
        totalCredits: baseCredits + bonusCredits,
      };
    });
  }, [pricing]);

  const visibleLedger = liteMode ? ledger.slice(0, 8) : ledger;

  const handleTopup = async (bundle: { id: string; amountZar: number }) => {
    if (!session?.csrfToken) {
      setNotice("Sign in to create wallet top-ups.");
      return;
    }

    setTopupPendingKey(bundle.id);
    try {
      const response = await fetch(`${apiBase}/wallet/topup/create`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ bundleId: bundle.id, amountZar: bundle.amountZar }),
      });

      const payload = (await response.json().catch(() => null)) as WalletTopupCreateResponse | null;
      if (!response.ok) {
        throw new Error("Unable to create wallet top-up.");
      }

      const checkoutUrl = payload?.checkout?.checkoutUrl;
      if (checkoutUrl && typeof checkoutUrl === "string") {
        window.location.assign(checkoutUrl);
        return;
      }

      setNotice(payload?.checkout?.note || "Top-up session created. Complete payment to receive credits.");
      await loadWallet();
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to create top-up."));
    } finally {
      setTopupPendingKey(null);
    }
  };

  if (!session) {
    return <StateCard title="Sign in required" description="Sign in to view your wallet balance, ledger, and top-up options." />;
  }

  return (
    <div className="list">
      <div className="list-item">
        <strong>Current balance</strong>
        <p className="title">{wallet ? `${wallet.balanceCredits} credits` : "--"}</p>
        <p className="subtitle">
          {pricing ? `1 ZAR = ${pricing.creditsPerZar} credits` : "Pricing unavailable right now."}
        </p>
      </div>

      <div className="list-item">
        <strong>Pricing anchors</strong>
        <div className="badge">
          Detailed report unlock = {effectiveDetailedReportCredits} credits
          {detailedReportApproxZar !== null ? ` (~${formatCurrency(detailedReportApproxZar)})` : ""}
        </div>
        <div className="badge">
          Suggested bundles:{" "}
          {bundleOptions.map((bundle) => `${bundle.name} (${formatCurrency(bundle.amountZar)})`).join(" | ")}
        </div>
      </div>

      <div className="list-item">
        <strong>Top up wallet bundles</strong>
        <p className="subtitle">
          Bonus credits apply on higher tiers. You will be redirected to the payment provider when configured.
        </p>
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Bundle</th>
                <th>Price</th>
                <th>Base credits</th>
                <th>Bonus</th>
                <th>Total credits</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bundleOptions.map((bundle) => (
                <tr key={bundle.id}>
                  <td>
                    <strong>{bundle.name}</strong>
                    <p className="subtitle">{bundle.description}</p>
                  </td>
                  <td>{formatCurrency(bundle.amountZar)}</td>
                  <td>{bundle.baseCredits}</td>
                  <td>
                    +{bundle.bonusCredits} ({bundle.bonusPercent}%)
                  </td>
                  <td>
                    <strong>{bundle.totalCredits}</strong>
                  </td>
                  <td>
                    <button
                      className="button"
                      type="button"
                      onClick={() => void handleTopup(bundle)}
                      disabled={topupPendingKey !== null}
                    >
                      {topupPendingKey === bundle.id ? "Creating..." : `Top up ${formatCurrency(bundle.amountZar)}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="list-item">
        <strong>Recent ledger entries</strong>
        {loading ? (
          <p className="subtitle">Loading wallet activity...</p>
        ) : visibleLedger.length === 0 ? (
          <p className="subtitle">No wallet activity yet.</p>
        ) : (
          <div className="list">
            {visibleLedger.map((entry) => (
              <div className="list-item" key={entry.id}>
                <strong>
                  {entry.type === "DEBIT" ? "-" : "+"}
                  {entry.amountCredits} credits
                </strong>
                <p className="subtitle">{entry.reason}</p>
                <p className="badge">{formatDateTime(entry.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {notice ? (
        <div className="list-item">
          <p className="badge">{notice}</p>
        </div>
      ) : null}
    </div>
  );
}
