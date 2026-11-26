"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/apiBase";

const CHECK_TIMEOUT_MS = 4000;
const CHECK_INTERVAL_MS = 30000;

type BannerState = {
  visible: boolean;
  message: string;
};

export function ApiConnectivityBanner() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const [state, setState] = useState<BannerState>({ visible: false, message: "" });
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  const endpoint = useMemo(() => `${API_BASE}/auth/session`, []);
  const healthEndpoint = useMemo(() => `${API_BASE}/health`, []);

  const checkConnectivity = useCallback(async () => {
    if (!isDevelopment) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });

      // 401/403 are expected when logged out; they still prove API connectivity.
      if (response.status >= 500) {
        if (response.status === 503) {
          try {
            const healthResponse = await fetch(healthEndpoint, {
              method: "GET",
              cache: "no-store",
              signal: controller.signal,
            });
            if (healthResponse.ok) {
              const health = (await healthResponse.json()) as { db?: string };
              if (health.db && health.db !== "ok") {
                setState({
                  visible: true,
                  message:
                    "Auth API is reachable but database is unavailable. Start local services (Postgres/Redis), then click Retry.",
                });
                return;
              }
            }
          } catch {
            // Fall through to generic 503 message.
          }
          setState({
            visible: true,
            message:
              "Auth API is reachable but temporarily unavailable (503). Verify backend dependencies and click Retry.",
          });
          return;
        }
        setState({
          visible: true,
          message: `Auth API returned ${response.status} at ${endpoint}. Start backend with "npm run dev" or "npm run dev:api".`,
        });
        return;
      }

      setState({ visible: false, message: "" });
    } catch {
      setState({
        visible: true,
        message: `Cannot reach ${endpoint}. Start backend with "npm run dev" or "npm run dev:api".`,
      });
    } finally {
      clearTimeout(timeout);
    }
  }, [endpoint, healthEndpoint, isDevelopment]);

  useEffect(() => {
    if (!isDevelopment) return;

    checkConnectivity();
    const id = setInterval(checkConnectivity, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkConnectivity, isDevelopment]);

  useEffect(() => {
    if (!state.visible) {
      setDismissedMessage(null);
    }
  }, [state.visible]);

  const isDismissed = dismissedMessage === state.message;

  if (!isDevelopment || !state.visible || isDismissed) return null;

  return (
    <div className="api-connectivity-banner" role="status" aria-live="polite">
      <span>{state.message}</span>
      <div className="api-connectivity-banner-actions">
        <button className="button" type="button" onClick={checkConnectivity}>
          Retry
        </button>
        <button
          className="button api-connectivity-banner-dismiss"
          type="button"
          onClick={() => setDismissedMessage(state.message)}
          aria-label="Dismiss connectivity banner"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
