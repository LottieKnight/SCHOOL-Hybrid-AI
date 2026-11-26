"use client";

import { FormEvent, Suspense, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";

function ForgotPasswordInner() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ width: "min(480px, 100%)", display: "grid", gap: "24px" }}>
        <div className="glass card" style={{ display: "grid", gap: "12px" }}>
          <span className="eyebrow">Password Reset</span>
          <h1 style={{ margin: 0 }}>Forgot your password?</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <section className="glass card" style={{ display: "grid", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>Check your email</h2>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--muted, #a3a3a3)" }}>
              If an account with that address exists, a reset link is on its way. It expires in 1 hour.
            </p>
            <a href="/auth" style={{ fontSize: "13px", color: "var(--muted, #a3a3a3)" }}>
              Back to sign in
            </a>
          </section>
        ) : (
          <section className="glass card" style={{ display: "grid", gap: "16px" }}>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
              <label style={{ display: "grid", gap: "8px" }}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                />
              </label>
              {error ? <div className="assistant-error">{error}</div> : null}
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
            <a href="/auth" style={{ fontSize: "13px", color: "var(--muted, #a3a3a3)" }}>
              Back to sign in
            </a>
          </section>
        )}
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
