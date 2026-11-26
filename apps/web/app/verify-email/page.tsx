"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "@/lib/apiBase";

type State = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("No verification token found. Please use the link from your email.");
      return;
    }

    let cancelled = false;
    fetch(`${API_BASE}/auth/verify-email/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setState("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setState("error");
          setErrorMsg(data.error ?? "Verification failed. The link may have expired.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
          setErrorMsg("Network error. Please try again.");
        }
      });

    return () => { cancelled = true; };
  }, [token]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px 56px",
      }}
    >
      <div className="glass card" style={{ width: "min(480px, 100%)", textAlign: "center" }}>
        {state === "loading" && (
          <>
            <h1 className="title">Verifying your email…</h1>
            <p className="subtitle">Please wait a moment.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✓</div>
            <h1 className="title">Email verified</h1>
            <p className="subtitle">Your email address has been confirmed.</p>
            <Link className="button" href="/dashboard" style={{ marginTop: "1rem", display: "inline-block" }}>
              Go to dashboard
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✗</div>
            <h1 className="title">Verification failed</h1>
            <p className="subtitle">{errorMsg}</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1rem", flexWrap: "wrap" }}>
              <Link className="button" href="/settings">
                Resend verification email
              </Link>
              <Link className="button" href="/dashboard">
                Go to dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
