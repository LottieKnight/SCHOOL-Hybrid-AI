"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type Tier = "scholar" | "family" | "school";
type Cadence = "monthly" | "annual";

// Mirror of apps/api/src/services/pricing.ts. Keep in step with PLANS there.
const TIERS: { id: Tier; name: string; monthly: number; blurb: string }[] = [
  { id: "scholar", name: "Scholar", monthly: 29, blurb: "Full access + AI tutor" },
  { id: "family", name: "Family", monthly: 59, blurb: "Up to 4 learners" },
  { id: "school", name: "School", monthly: 199, blurb: "Class management + teacher dashboard" },
];

/**
 * Starts a PayFast subscription via POST /billing/subscribe. The API returns a
 * hosted checkout URL which we redirect to; the plan is only upgraded once PayFast
 * posts a verified ITN to /api/billing/itn, so a cancelled payment changes nothing.
 */
export function UpgradePanel() {
  const { authState } = useSession();
  const router = useRouter();
  const [tier, setTier] = useState<Tier>("scholar");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = TIERS.find((t) => t.id === tier) || TIERS[0];
  const totalZar = cadence === "annual" ? selected.monthly * 10 : selected.monthly;
  // Annual is 10x monthly, so the effective rate is 10/12 of the monthly price.
  // Showing it is what moves people onto the lower-fee cadence.
  const effectiveMonthlyZar = cadence === "annual" ? (selected.monthly * 10) / 12 : selected.monthly;

  async function subscribe() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/billing/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier, cadence }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start checkout.");
        return;
      }
      if (!data.checkoutUrl) {
        setError("Payments are not available yet. Please try again later.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(getApiErrorMessage(err, "Network error — try again."));
      setLoading(false);
    }
  }

  if (authState.isPaidUser) {
    return (
      <section className="glass card" style={{ display: "grid", gap: "12px", padding: "18px" }}>
        <div>
          <strong>Your plan</strong>
          <p style={{ margin: "6px 0 0", color: "var(--text-3)", lineHeight: 1.5 }}>
            Your account is on the {authState.planTier} plan. Manage or change it below.
          </p>
        </div>
        <button className="button" type="button" onClick={() => router.refresh()}>
          Refresh plan status
        </button>
      </section>
    );
  }

  return (
    <section className="glass card" style={{ display: "grid", gap: "14px", padding: "18px" }}>
      <div>
        <strong>Upgrade your plan</strong>
        <p style={{ margin: "6px 0 0", color: "var(--text-3)", lineHeight: 1.5 }}>
          Pay securely with card or EFT. Your access is applied as soon as payment clears.
        </p>
      </div>

      <div style={{ display: "grid", gap: "8px" }}>
        {TIERS.map((t) => (
          <label
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid var(--border, #333)",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="upgrade-tier"
              value={t.id}
              checked={tier === t.id}
              onChange={() => setTier(t.id)}
            />
            <span style={{ flex: 1 }}>
              <strong>{t.name}</strong> <span style={{ color: "var(--text-3)" }}>— {t.blurb}</span>
            </span>
            <span>R{t.monthly}/mo</span>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="radio"
            name="upgrade-cadence"
            checked={cadence === "monthly"}
            onChange={() => setCadence("monthly")}
          />
          Monthly
        </label>
        <label style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="radio"
            name="upgrade-cadence"
            checked={cadence === "annual"}
            onChange={() => setCadence("annual")}
          />
          Annual (2 months free)
        </label>
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <button className="button" type="button" onClick={subscribe} disabled={loading}>
          {loading ? "Redirecting to PayFast…" : `Pay R${totalZar} for ${selected.name}`}
        </button>
        <span style={{ color: "var(--text-3)", fontSize: "13px" }}>
          {cadence === "annual"
            ? `R${totalZar}/year · R${effectiveMonthlyZar.toFixed(2)}/month · VAT inclusive`
            : `R${totalZar}/month · VAT inclusive`}
        </span>
      </div>

      {error ? (
        <p style={{ color: "var(--danger, #ff6b6b)", margin: 0 }}>{error}</p>
      ) : null}
    </section>
  );
}
