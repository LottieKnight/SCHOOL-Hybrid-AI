"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, sendSubscriptionToServer, unsubscribeFromPush } from "@/lib/pushNotifications";

type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

export function PushNotificationsPanel() {
  const [state, setState] = useState<PushState>("unsubscribed");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "unsubscribed"))
      .catch(() => setState("unsubscribed"));
  }, []);

  const enable = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const sub = await subscribeToPush();
      if (!sub) {
        setState(Notification.permission === "denied" ? "denied" : "unsubscribed");
        setNotice("Notifications permission was not granted.");
        return;
      }
      const ok = await sendSubscriptionToServer(sub);
      if (ok) {
        setState("subscribed");
        setNotice("Push notifications enabled.");
      } else {
        setNotice("Unable to save subscription. Please try again.");
      }
    } catch {
      setNotice("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    setNotice(null);
    try {
      await unsubscribeFromPush();
      setState("unsubscribed");
      setNotice("Push notifications disabled.");
    } catch {
      setNotice("Unable to unsubscribe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <h3 style={{ fontSize: "15px", fontWeight: 600 }}>Push Notifications</h3>
      {state === "unsupported" && (
        <p style={{ fontSize: "14px", color: "var(--text-3)" }}>
          Push notifications are not supported in this browser.
        </p>
      )}
      {state === "denied" && (
        <p style={{ fontSize: "14px", color: "var(--text-3)" }}>
          Notifications are blocked by your browser. Please update your browser permissions to enable them.
        </p>
      )}
      {(state === "subscribed" || state === "unsubscribed") && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-2)", flex: 1 }}>
            {state === "subscribed"
              ? "You are receiving push notifications for assignments, reminders, and updates."
              : "Enable push notifications to get alerts for assignments, reminders, and updates."}
          </p>
          <button
            onClick={state === "subscribed" ? disable : enable}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--r-md, 10px)",
              border: "1px solid var(--border-2)",
              background: state === "subscribed" ? "var(--surface-2)" : "var(--gold)",
              color: state === "subscribed" ? "var(--text-1)" : "var(--text-inv)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 500,
              opacity: loading ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "..." : state === "subscribed" ? "Disable" : "Enable"}
          </button>
        </div>
      )}
      {notice && <p style={{ fontSize: "13px", color: "var(--text-3)" }}>{notice}</p>}
    </section>
  );
}
