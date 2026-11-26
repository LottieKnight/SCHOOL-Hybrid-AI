"use client";

import { FormEvent, useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length < 8) return 0;
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setNotice({ type: "error", msg: "New passwords do not match." }); return; }
    if (next.length < 8) { setNotice({ type: "error", msg: "Password must be at least 8 characters." }); return; }
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        setNotice({ type: "success", msg: "Password updated." });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        const data = await res.json().catch(() => ({}));
        setNotice({ type: "error", msg: data.error ?? "Failed to update password." });
      }
    } catch {
      setNotice({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const score = scorePassword(next);

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "380px" }}>
      <label style={{ display: "grid", gap: "0.35rem", fontSize: "13px" }}>
        Current password
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required
          style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
      </label>
      <label style={{ display: "grid", gap: "0.35rem", fontSize: "13px" }}>
        New password
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required
          style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
        {next.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: "3px", marginBottom: "3px" }}>
              {[1, 2, 3, 4].map((bar) => (
                <div key={bar} style={{ flex: 1, height: "3px", borderRadius: "2px", background: score >= bar ? STRENGTH_COLORS[score] : "var(--border)", transition: "background 0.2s" }} />
              ))}
            </div>
            <span style={{ fontSize: "11px", color: STRENGTH_COLORS[score] }}>{STRENGTH_LABELS[score]}</span>
          </div>
        )}
      </label>
      <label style={{ display: "grid", gap: "0.35rem", fontSize: "13px" }}>
        Confirm new password
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required
          style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
      </label>
      {notice && (
        <p style={{ margin: 0, fontSize: "13px", color: notice.type === "success" ? "#22c55e" : "#ef4444" }}>{notice.msg}</p>
      )}
      <button type="submit" disabled={saving}
        style={{ padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--inst-primary, #e8c15a)", color: "#0a0a0a", cursor: "pointer", fontSize: "13px", justifySelf: "start" }}>
        {saving ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

function ResendVerificationButton() {
  const { session } = useSession();
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (!session || session.user.isEmailVerified) return null;

  async function resend() {
    setSending(true); setError(null); setSentMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, { method: "POST", credentials: "include" });
      if (res.ok) {
        setSentMessage("Sent — check your inbox.");
        setCooldown(60);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed. Try again later.");
      }
    } catch { setError("Network error."); }
    finally { setSending(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-3)" }}>
        Email not verified: <strong>{session.user.email}</strong>
      </p>
      <button onClick={resend} disabled={sending || cooldown > 0}
        style={{ padding: "5px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--bg-2)", cursor: cooldown > 0 ? "default" : "pointer", fontSize: "12px", color: "var(--text-2)", opacity: cooldown > 0 ? 0.6 : 1 }}>
        {sending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
      </button>
      {sentMessage && <span style={{ fontSize: "12px", color: "#22c55e" }}>{sentMessage}</span>}
      {error && <span style={{ fontSize: "12px", color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

function EmailChangeForm() {
  const { session } = useSession();
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || newEmail === session?.user.email) return;
    setSaving(true); setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/change-email`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      if (res.ok) {
        setNotice({ type: "success", msg: `Verification link sent to ${newEmail}. Click it to confirm the change.` });
        setNewEmail("");
      } else {
        const d = await res.json().catch(() => ({}));
        setNotice({ type: "error", msg: d.error ?? "Failed to initiate email change." });
      }
    } catch { setNotice({ type: "error", msg: "Network error." }); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "380px" }}>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-3)" }}>
        Current email: <strong>{session?.user.email}</strong>
      </p>
      <label style={{ display: "grid", gap: "0.35rem", fontSize: "13px" }}>
        New email address
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required placeholder="new@example.com"
          style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
      </label>
      {notice && (
        <p style={{ margin: 0, fontSize: "13px", color: notice.type === "success" ? "#22c55e" : "#ef4444" }}>{notice.msg}</p>
      )}
      <button type="submit" disabled={saving || !newEmail.trim()}
        style={{ padding: "8px 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--inst-primary, #e8c15a)", color: "#0a0a0a", cursor: "pointer", fontSize: "13px", justifySelf: "start" }}>
        {saving ? "Sending…" : "Send verification link"}
      </button>
    </form>
  );
}

export function AccountSecurityPanel() {
  return (
    <div style={{ marginTop: "40px", borderTop: "1px solid var(--border)", paddingTop: "32px", display: "grid", gap: "32px" }}>
      <section>
        <h2 style={{ fontSize: "18px", margin: "0 0 4px" }}>Email address</h2>
        <p style={{ color: "var(--text-3)", fontSize: "13px", margin: "0 0 16px" }}>
          A verification link will be sent to the new address before the change takes effect.
        </p>
        <ResendVerificationButton />
        <div style={{ marginTop: "16px" }}>
          <EmailChangeForm />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "18px", margin: "0 0 4px" }}>Change password</h2>
        <p style={{ color: "var(--text-3)", fontSize: "13px", margin: "0 0 16px" }}>
          After a successful change you will remain signed in on this device.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
