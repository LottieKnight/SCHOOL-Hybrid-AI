"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import {
  CreditsLedgerEntry,
  SyncQueueItem,
  getCachedAPIResponse,
  getSyncStatus,
  isOnline,
  onOffline,
  onOnline,
  processSyncQueue,
  queueForSync,
  requestBackgroundSync,
  storeCreditsOffline,
  syncCreditsLedger,
} from "@/lib/offline/offline-db";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)saedu_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function useOfflineStatus() {
  const [online, setOnline] = useState(() => isOnline());
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0 });
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  const refreshSyncStatus = useCallback(async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  }, []);

  useEffect(() => {
    const unsubscribeOnline = onOnline(() => {
      setOnline(true);
      void requestBackgroundSync().catch(() => undefined);
      void refreshSyncStatus();
    });

    const unsubscribeOffline = onOffline(() => {
      setOnline(false);
      void refreshSyncStatus();
    });

    const handleSWUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener("sw-update-available", handleSWUpdate);

    void refreshSyncStatus();

    const interval = setInterval(() => void refreshSyncStatus(), 10000);

    return () => {
      unsubscribeOnline();
      unsubscribeOffline();
      window.removeEventListener("sw-update-available", handleSWUpdate);
      clearInterval(interval);
    };
  }, [refreshSyncStatus]);

  const forceSync = useCallback(async () => {
    if (online) {
      await processSyncQueue();
      await syncCreditsLedger();
      await refreshSyncStatus();
    }
  }, [online, refreshSyncStatus]);

  const applySWUpdate = useCallback(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }
      });
    }
  }, []);

  return {
    online,
    syncStatus,
    swUpdateAvailable,
    refreshSyncStatus,
    forceSync,
    applySWUpdate,
  };
}

export interface MutationOptions {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  url?: string;
}

export function useOfflineMutation<TArgs extends unknown[]>(
  mutationFn: (...args: TArgs) => Promise<unknown>,
  options: MutationOptions = {}
) {
  const { online } = useOfflineStatus();
  const [pending, setPending] = useState(false);

  const mutate = useCallback(
    async (...args: TArgs) => {
      if (online) {
        setPending(true);
        try {
          return await mutationFn(...args);
        } finally {
          setPending(false);
        }
      }
      const mutationData: Omit<SyncQueueItem, "id" | "status"> = {
        type: "api-mutation",
        method: options.method || "POST",
        url: options.url || "/api/mutation",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args[0]),
        timestamp: Date.now(),
        retries: 0,
      };
      await queueForSync(mutationData);
      return { queued: true, offline: true };
    },
    [online, mutationFn, options]
  );

  return { mutate, pending };
}

export interface CreditsMetadata {
  userId?: string;
  venture?: string;
  description?: string;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export function useOfflineCredits() {
  const { online, forceSync } = useOfflineStatus();
  const [localBalance, setLocalBalance] = useState(0);

  const earnCredits = useCallback(
    async (amount: number, source: string, metadata: CreditsMetadata = {}) => {
      const entry: Omit<CreditsLedgerEntry, "id" | "synced"> = {
        userId: metadata.userId,
        venture: metadata.venture || "SCHOOL",
        type: "earn",
        amount,
        source,
        metadata,
        timestamp: Date.now(),
      };
      if (typeof metadata.idempotencyKey === "string" && metadata.idempotencyKey.trim().length > 0) {
        entry.idempotencyKey = metadata.idempotencyKey;
      }

      if (online) {
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          const csrfToken = getCsrfToken();
          if (csrfToken) headers["x-csrf-token"] = csrfToken;
          const response = await fetch(`${API_BASE}/credits/earn`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify(entry),
          });
          if (response.ok) {
            // The API returns the authoritative wallet balance (rule amount,
            // not the client-claimed amount), so prefer it over local math.
            const data = (await response.json()) as { account?: { balance?: number } };
            if (typeof data.account?.balance === "number") {
              setLocalBalance(data.account.balance);
            } else {
              setLocalBalance((prev) => prev + amount);
            }
            return data;
          }
        } catch {
          // Fall through to the offline ledger.
        }
      }

      await storeCreditsOffline(entry);
      setLocalBalance((prev) => prev + amount);
      return { offline: true, ...entry };
    },
    [online]
  );

  const spendCredits = useCallback(
    async (amount: number, source: string, metadata: CreditsMetadata = {}) => {
      if (localBalance < amount) {
        throw new Error("Insufficient credits");
      }

      const entry: Omit<CreditsLedgerEntry, "id" | "synced"> = {
        userId: metadata.userId,
        venture: metadata.venture || "SCHOOL",
        type: "spend",
        amount: -amount,
        source,
        metadata,
        timestamp: Date.now(),
      };
      if (typeof metadata.idempotencyKey === "string" && metadata.idempotencyKey.trim().length > 0) {
        entry.idempotencyKey = metadata.idempotencyKey;
      }

      if (online) {
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          const csrfToken = getCsrfToken();
          if (csrfToken) headers["x-csrf-token"] = csrfToken;
          const response = await fetch(`${API_BASE}/credits/spend`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify(entry),
          });
          if (response.ok) {
            const data = (await response.json()) as { account?: { balance?: number } };
            if (typeof data.account?.balance === "number") {
              setLocalBalance(data.account.balance);
            } else {
              setLocalBalance((prev) => prev - amount);
            }
            return data;
          }
        } catch {
          // Fall through to the offline ledger.
        }
      }

      await storeCreditsOffline(entry);
      setLocalBalance((prev) => prev - amount);
      return { offline: true, ...entry };
    },
    [online, localBalance]
  );

  const syncNow = useCallback(async () => {
    await forceSync();
    return syncCreditsLedger();
  }, [forceSync]);

  return {
    localBalance,
    setLocalBalance,
    earnCredits,
    spendCredits,
    syncNow,
  };
}

export function useCachedData<T>(key: string, fetcher: () => Promise<T>) {
  const { online } = useOfflineStatus();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (online) {
        const freshData = await fetcher();
        setData(freshData);
        setFromCache(false);
      } else {
        throw new Error("Offline");
      }
    } catch {
      const cached = await getCachedAPIResponse(key);
      if (cached) {
        setData(cached as T);
        setFromCache(true);
      } else {
        setError(new Error("No cached data available"));
      }
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, online]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!online) return;
    const freshData = await fetcher();
    setData(freshData);
    setFromCache(false);
  }, [fetcher, online]);

  return { data, loading, error, fromCache, refresh };
}
