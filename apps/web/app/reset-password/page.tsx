"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "@/lib/apiBase";

type State = "idle" | "submitting" | "success" | "error";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<State>(token ? "idle" : "error");
  const [errorMsg, setErrorMsg] = useState<string | null>(
    token ? null : "No reset token found. Please use the link from your email."
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;

    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setState("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setState("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setState("error");
        setErrorMsg(data.error ?? "Reset failed. The link may have expired.");
      }
    } catch {
      setState("idle");
      setErrorMsg("Network error. Please check your connection and try again.");
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
        {state === "success" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✓</div>
            <h1 className="title">Password updated</h1>
            <p className="subtitle">
              Your password has been changed. All existing sessions have been signed out.
            </p>
            <Link className="button" href="/auth" style={{ marginTop: "1.25rem", display: "inline-block" }}>
              Sign in
            </Link>
          </div>
        ) : state === "error" && !token ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✗</div>
            <h1 className="title">Invalid link</h1>
            <p className="subtitle">{errorMsg}</p>
            <Link className="button" href="/forgot-password" style={{ marginTop: "1.25rem", display: "inline-block" }}>
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            <span className="eyebrow">Password reset</span>
            <h1 className="title">Set a new password</h1>
            <p className="subtitle" style={{ marginBottom: "1.25rem" }}>
              Choose a strong password with at least 8 characters.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <label style={{ display: "grid", gap: "0.5rem" }}>
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoFocus
                  autoComplete="new-password"
                />
              </label>

              <label style={{ display: "grid", gap: "0.5rem" }}>
                Confirm new password
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>

              {errorMsg && <div className="assistant-error">{errorMsg}</div>}

              <button
                className="button"
                type="submit"
                disabled={state === "submitting" || !password || !confirm}
              >
                {state === "submitting" ? "Updating…" : "Update password"}
              </button>
            </form>

            <p className="subtitle" style={{ marginTop: "1rem", textAlign: "center" }}>
              <Link href="/forgot-password">Request a new link</Link>
              {" · "}
              <Link href="/auth">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
