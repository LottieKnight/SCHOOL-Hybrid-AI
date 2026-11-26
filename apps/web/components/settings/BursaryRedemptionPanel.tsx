"use client";

import { useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

/**
 * Lets a learner redeem a sponsor bursary code (Bursary tier = full Scholar-equivalent
 * access at R0 to the learner). Sponsors issue codes via the admin endpoint
 * POST /billing/codes. See docs/engineering/UPGRADE_PLAN_50.md #50 + OUTREACH_PRICING_STRATEGY.md.
 */
export function BursaryRedemptionPanel() {
  const { authState } = useSession();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isBursary = authState.isBursary;

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!code.trim()) {
      setError("Enter the code from your sponsor.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/billing/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not redeem this code.");
        return;
      }
      setSuccess(true);
      setCode("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Network error — try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass card" style={{ display: "grid", gap: "12px", padding: "18px" }}>
      <div>
        <strong>Scholar sponsorship / bursary code</strong>
        <p style={{ margin: "6px 0 0", color: "var(--text-3)", lineHeight: 1.5 }}>
          Received a sponsorship code from a school, NPO, or bursary fund? Redeem it here for
          full access at no cost to you.
        </p>
      </div>

      {isBursary ? (
        <p className="badge" style={{ color: "var(--success, #3ecf8e)" }}>
          ✓ Your account currently has sponsored (Bursary) access. Thank your sponsor.
        </p>
      ) : (
        <form onSubmit={redeem} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            aria-label="Bursary code"
            style={{ flex: "1 1 220px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, #333)" }}
          />
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Redeeming…" : "Redeem code"}
          </button>
        </form>
      )}

      {error ? (
        <p style={{ color: "var(--danger, #ff6b6b)", margin: 0 }}>{error}</p>
      ) : null}
      {success ? (
        <p style={{ color: "var(--success, #3ecf8e)", margin: 0 }}>
          ✓ Sponsorship activated! You now have full access at no cost.
        </p>
      ) : null}
    </section>
  );
}
