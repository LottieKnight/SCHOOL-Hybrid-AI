"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/apiBase";

type SetupData = { secret: string; uri: string };

export default function AdminTotpSetupPage() {
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  const startSetup = async () => {
    setStatus("loading");
    setMessage(null);
    const res = await fetch(`${API_BASE}/auth/totp/setup`, { credentials: "include" });
    if (!res.ok) {
      setMessage("Failed to start TOTP setup. Make sure you are signed in as an admin.");
      setStatus("error");
      return;
    }
    const data = (await res.json()) as SetupData;
    setSetup(data);
    setStatus("idle");
  };

  const confirmSetup = async () => {
    if (!confirmCode || confirmCode.length !== 6) {
      setMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    const res = await fetch(`${API_BASE}/auth/totp/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: confirmCode }),
    });
    if (res.ok) {
      setStatus("done");
      setMessage("TOTP enabled successfully. Your admin account now requires a 6-digit code at login.");
      setSetup(null);
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(body.error ?? "Verification failed. Try again.");
      setStatus("error");
    }
  };

  const disableTotp = async () => {
    setDisabling(true);
    setMessage(null);
    const res = await fetch(`${API_BASE}/auth/totp`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      setMessage("TOTP has been disabled for your account.");
      setSetup(null);
    } else {
      setMessage("Failed to disable TOTP. Please try again.");
    }
    setDisabling(false);
  };

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px", display: "grid", gap: "24px" }}>
      <div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>Admin TOTP Setup</h1>
        <p style={{ fontSize: "14px", color: "var(--text-2)" }}>
          Add two-factor authentication to your admin account using any TOTP app (Google Authenticator, Authy, 1Password, etc.).
        </p>
      </div>

      {!setup && status !== "done" && (
        <button
          onClick={startSetup}
          disabled={status === "loading"}
          style={{
            padding: "10px 20px",
            background: "var(--gold)",
            color: "var(--text-inv)",
            border: "none",
            borderRadius: "var(--r-md, 10px)",
            cursor: status === "loading" ? "wait" : "pointer",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {status === "loading" ? "Setting up..." : "Set up TOTP"}
        </button>
      )}

      {setup && (
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "var(--r-md, 10px)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "8px" }}>
              Scan this URI with your authenticator app, or enter the secret manually:
            </p>
            <code style={{ fontSize: "12px", wordBreak: "break-all", color: "var(--text-1)" }}>{setup.uri}</code>
            <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "8px" }}>
              Secret key: <strong style={{ color: "var(--text-1)", letterSpacing: "0.1em" }}>{setup.secret}</strong>
            </p>
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500 }}>
              Enter the 6-digit code to confirm
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              style={{
                padding: "10px 14px",
                borderRadius: "var(--r-md, 10px)",
                border: "1px solid var(--border-2)",
                background: "var(--surface)",
                color: "var(--text-1)",
                fontSize: "18px",
                letterSpacing: "0.25em",
                width: "140px",
              }}
            />
            <button
              onClick={confirmSetup}
              disabled={status === "loading" || confirmCode.length !== 6}
              style={{
                padding: "10px 20px",
                background: "var(--gold)",
                color: "var(--text-inv)",
                border: "none",
                borderRadius: "var(--r-md, 10px)",
                cursor: status === "loading" || confirmCode.length !== 6 ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "14px",
                opacity: confirmCode.length !== 6 ? 0.5 : 1,
                width: "fit-content",
              }}
            >
              {status === "loading" ? "Verifying..." : "Activate TOTP"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p style={{ fontSize: "14px", color: status === "done" ? "var(--green)" : status === "error" ? "var(--red)" : "var(--text-2)" }}>
          {message}
        </p>
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "8px" }}>Disable TOTP</h2>
        <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "12px" }}>
          Remove two-factor authentication from your admin account.
        </p>
        <button
          onClick={disableTotp}
          disabled={disabling}
          style={{
            padding: "8px 16px",
            background: "var(--surface-2)",
            color: "var(--red)",
            border: "1px solid var(--red-dim)",
            borderRadius: "var(--r-md, 10px)",
            cursor: disabling ? "wait" : "pointer",
            fontSize: "13px",
          }}
        >
          {disabling ? "Disabling..." : "Disable TOTP"}
        </button>
      </div>
    </div>
  );
}
