"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { PasswordInput } from "@/components/PasswordInput";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token || !email) {
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
          <section className="glass card" style={{ display: "grid", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>Invalid link</h2>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--muted, #a3a3a3)" }}>
              This reset link is missing required information.
            </p>
            <a href="/auth/forgot-password" style={{ fontSize: "13px", color: "var(--muted, #a3a3a3)" }}>
              Request a new reset link
            </a>
          </section>
        </div>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data?.code === "RESET_INVALID") {
          setError("This link has expired or has already been used. Request a new one.");
        } else {
          throw new Error(data?.error || "Reset failed.");
        }
        return;
      }

      setDone(true);
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
          <h1 style={{ margin: 0 }}>Set a new password</h1>
        </div>

        {done ? (
          <section className="glass card" style={{ display: "grid", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>Password updated</h2>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--muted, #a3a3a3)" }}>
              Your password has been reset. All previous sessions have been signed out.
            </p>
            <button className="button" onClick={() => router.push("/auth")}>
              Sign in
            </button>
          </section>
        ) : (
          <section className="glass card" style={{ display: "grid", gap: "16px" }}>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
              <label style={{ display: "grid", gap: "8px" }}>
                New password
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                />
              </label>
              <label style={{ display: "grid", gap: "8px" }}>
                Confirm new password
                <PasswordInput
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              {error ? (
                <div className="assistant-error">
                  {error}{" "}
                  {error.includes("expired") || error.includes("used") ? (
                    <a href="/auth/forgot-password" style={{ color: "inherit", textDecoration: "underline" }}>
                      Request a new link
                    </a>
                  ) : null}
                </div>
              ) : null}
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Update password"}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
