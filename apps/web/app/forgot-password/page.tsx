"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/apiBase";

type State = "idle" | "submitting" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setError(null);

    try {
      await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show "sent" regardless of response — the API never reveals
      // whether the address exists (anti-enumeration).
      setState("sent");
    } catch {
      setState("idle");
      setError("Network error. Please check your connection and try again.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px 56px",
      }}
    >
      <div className="glass card" style={{ width: "min(480px, 100%)" }}>
        {state !== "sent" ? (
          <>
            <span className="eyebrow">Password reset</span>
            <h1 className="title">Forgot your password?</h1>
            <p className="subtitle" style={{ marginBottom: "1.25rem" }}>
              Enter your email and we&rsquo;ll send you a reset link if an account exists.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <label style={{ display: "grid", gap: "0.5rem" }}>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@example.com"
                />
              </label>

              {error && <div className="assistant-error">{error}</div>}

              <button className="button" type="submit" disabled={state === "submitting"}>
                {state === "submitting" ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="subtitle" style={{ marginTop: "1rem", textAlign: "center" }}>
              <Link href="/auth">Back to sign in</Link>
            </p>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✉</div>
            <h1 className="title">Check your email</h1>
            <p className="subtitle">
              If an account exists for <strong>{email}</strong>, a password reset link has been sent.
              Check your inbox (and spam folder).
            </p>
            <p className="subtitle" style={{ marginTop: "0.75rem" }}>
              The link expires in <strong>1 hour</strong>.
            </p>
            <Link className="button" href="/auth" style={{ marginTop: "1.25rem", display: "inline-block" }}>
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
