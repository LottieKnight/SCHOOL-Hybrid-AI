"use client";

import { useState } from "react";

type DiagnosticCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

type DiagnosticResult = {
  ok: boolean;
  checks: DiagnosticCheck[];
  fromEmail: string;
  fromDomain: string;
};

type TestSendResult =
  | { ok: true; messageId: string | null; sentTo: string }
  | { ok: false; error: string; resendError?: string | null; status?: number };

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

export default function EmailDiagnosticsPage() {
  const [diagResult, setDiagResult] = useState<DiagnosticResult | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const [testTo, setTestTo] = useState("");
  const [sendResult, setSendResult] = useState<TestSendResult | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function runDiagnostic() {
    setDiagLoading(true);
    setDiagError(null);
    setDiagResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/email/diagnostic`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setDiagResult(await res.json() as DiagnosticResult);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagLoading(false);
    }
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setSendLoading(true);
    setSendError(null);
    setSendResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/email/test-send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const body = await res.json() as TestSendResult;
      setSendResult(body);
      if (!res.ok && !body.ok) {
        setSendError((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 24, padding: "24px 16px" }}>
      <div>
        <h1 style={{ margin: "0 0 6px" }}>Email / Resend Diagnostics</h1>
        <p style={{ margin: 0, color: "var(--text-dim, #888)", lineHeight: 1.6 }}>
          Checks whether <code>RESEND_API_KEY</code> is set, the API is reachable, and the sending domain is verified. Also lets you fire a real test email.
        </p>
      </div>

      {/* Config check */}
      <section className="glass card" style={{ padding: 20, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Configuration check</h2>
          <button
            className="button skeu-btn"
            onClick={runDiagnostic}
            disabled={diagLoading}
          >
            {diagLoading ? "Checking…" : "Run check"}
          </button>
        </div>

        {diagError && (
          <div style={{ background: "#2a0a0a", border: "1px solid #7f1d1d", borderRadius: 10, padding: 14, color: "#fca5a5", fontSize: 14 }}>
            {diagError}
          </div>
        )}

        {diagResult && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{
              padding: "10px 16px",
              borderRadius: 10,
              fontWeight: 700,
              background: diagResult.ok ? "#0a2a0a" : "#2a0a0a",
              border: `1px solid ${diagResult.ok ? "#166534" : "#7f1d1d"}`,
              color: diagResult.ok ? "#86efac" : "#fca5a5",
            }}>
              {diagResult.ok ? "All checks passed" : "One or more checks failed — see details below"}
            </div>

            {diagResult.checks.map((check) => (
              <div
                key={check.name}
                className="glass"
                style={{ borderRadius: 12, padding: "12px 16px", display: "grid", gap: 4 }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 16 }}>{check.ok ? "✅" : "❌"}</span>
                  <strong style={{ fontSize: 14 }}>{check.name}</strong>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim, #888)", lineHeight: 1.5, paddingLeft: 26 }}>
                  {check.detail}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Test send */}
      <section className="glass card" style={{ padding: 20, display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Send a test email</h2>
          <p style={{ margin: 0, color: "var(--text-dim, #888)", fontSize: 14, lineHeight: 1.6 }}>
            Fires a real email through Resend. Use your own address to confirm delivery end-to-end.
          </p>
        </div>

        <form onSubmit={sendTest} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "grid", gap: 6, flex: "1 1 240px" }}>
            <label htmlFor="test-email" style={{ fontSize: 13, fontWeight: 600 }}>Recipient email</label>
            <input
              id="test-email"
              type="email"
              required
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border, #2a2a2a)",
                background: "var(--bg-input, #1a1a1a)",
                color: "inherit",
                fontSize: 14,
              }}
            />
          </div>
          <button
            type="submit"
            className="button skeu-btn"
            disabled={sendLoading || !testTo}
            style={{ height: 40 }}
          >
            {sendLoading ? "Sending…" : "Send test email"}
          </button>
        </form>

        {sendError && (
          <div style={{ background: "#2a0a0a", border: "1px solid #7f1d1d", borderRadius: 10, padding: 14, display: "grid", gap: 4 }}>
            <strong style={{ color: "#fca5a5", fontSize: 14 }}>Send failed</strong>
            <p style={{ margin: 0, color: "#fca5a5", fontSize: 13, lineHeight: 1.5 }}>{sendError}</p>
            {sendResult && !sendResult.ok && (sendResult as { resendError?: string | null }).resendError && (
              <p style={{ margin: 0, color: "#f87171", fontSize: 12 }}>
                Resend error: {(sendResult as { resendError: string }).resendError}
              </p>
            )}
          </div>
        )}

        {sendResult?.ok && (
          <div style={{ background: "#0a2a0a", border: "1px solid #166534", borderRadius: 10, padding: 14, display: "grid", gap: 4 }}>
            <strong style={{ color: "#86efac", fontSize: 14 }}>Email sent successfully</strong>
            <p style={{ margin: 0, color: "#86efac", fontSize: 13 }}>
              Delivered to <strong>{sendResult.sentTo}</strong>
              {sendResult.messageId ? ` · Message ID: ${sendResult.messageId}` : ""}
            </p>
            <p style={{ margin: 0, color: "#4ade80", fontSize: 12 }}>
              Check your inbox (and spam folder). If it doesn&apos;t arrive within 60 seconds, the domain may still be propagating DNS records.
            </p>
          </div>
        )}
      </section>

      {/* Fix guidance */}
      <section className="glass card" style={{ padding: 20, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Common fixes</h2>
        <div style={{ display: "grid", gap: 8, fontSize: 14, lineHeight: 1.7 }}>
          <div className="glass" style={{ borderRadius: 10, padding: 14 }}>
            <strong>RESEND_API_KEY missing</strong>
            <p style={{ margin: "4px 0 0", color: "var(--text-dim, #888)" }}>
              Go to Railway → <code>@saedu/api</code> service → Variables → add <code>RESEND_API_KEY</code> with the key from your Resend dashboard (API Keys section).
            </p>
          </div>
          <div className="glass" style={{ borderRadius: 10, padding: 14 }}>
            <strong>Domain not verified</strong>
            <p style={{ margin: "4px 0 0", color: "var(--text-dim, #888)" }}>
              Go to Resend → Domains → Add domain → enter <code>school.ditshego-ventures.co.za</code> → add the DNS TXT and MX records shown to your DNS provider. Verification usually takes 5–30 minutes.
            </p>
          </div>
          <div className="glass" style={{ borderRadius: 10, padding: 14 }}>
            <strong>API key exists but emails still silently fail</strong>
            <p style={{ margin: "4px 0 0", color: "var(--text-dim, #888)" }}>
              Use the test send above — it returns the exact Resend error message. The most common cause after domain verification is a rate limit (100/day on the free plan) or a typo in <code>EMAIL_FROM</code>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
