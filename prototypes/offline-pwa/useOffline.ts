'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  registerServiceWorker,
  requestBackgroundSync,
  isOnline,
  onOnline,
  onOffline,
  getSyncStatus,
  processSyncQueue,
  storeCreditsOffline,
  syncCreditsLedger,
  queueForSync,
  getCachedAPIResponse,
  SyncQueueItem,
  CreditsLedgerEntry,
} from './offline-db';

export function useOfflineStatus() {
  const [online, setOnline] = useState(() => isOnline());
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0 });
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  useEffect(() => {
    const unsubscribeOnline = onOnline(() => {
      setOnline(true);
      requestBackgroundSync();
      refreshSyncStatus();
    });

    const unsubscribeOffline = onOffline(() => {
      setOnline(false);
      refreshSyncStatus();
    });

    const handleSWUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener('sw-update-available', handleSWUpdate);

    registerServiceWorker();
    refreshSyncStatus();

    const interval = setInterval(refreshSyncStatus, 10000);

    return () => {
      unsubscribeOnline();
      unsubscribeOffline();
      window.removeEventListener('sw-update-available', handleSWUpdate);
      clearInterval(interval);
    };
  }, []);

  const refreshSyncStatus = useCallback(async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  }, []);

  const forceSync = useCallback(async () => {
    if (online) {
      await processSyncQueue();
      await syncCreditsLedger();
      refreshSyncStatus();
    }
  }, [online, refreshSyncStatus]);

  const applySWUpdate = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
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
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url?: string;
}

export function useOfflineMutation<TArgs extends unknown[]>(mutationFn: (...args: TArgs) => Promise<unknown>, options: MutationOptions = {}) {
  const { online } = useOfflineStatus();
  const [pending, setPending] = useState(false);

  const mutate = useCallback(async (...args: TArgs) => {
    if (online) {
      setPending(true);
      try {
        return await mutationFn(...args);
      } finally {
        setPending(false);
      }
    } else {
      const mutationData: Omit<SyncQueueItem, 'id' | 'status'> = {
        type: 'api-mutation',
        method: options.method || 'POST',
        url: options.url || '/api/mutation',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args[0]),
        timestamp: Date.now(),
        retries: 0,
      };
      await queueForSync(mutationData);
      return { queued: true, offline: true };
    }
  }, [online, mutationFn, options]);

  return { mutate, pending };
}

export interface CreditsMetadata {
  userId?: number;
  venture?: string;
  [key: string]: unknown;
}

export function useOfflineCredits() {
  const { online, forceSync } = useOfflineStatus();
  const [localBalance, setLocalBalance] = useState(0);

  const earnCredits = useCallback(async (amount: number, source: string, metadata: CreditsMetadata = {}) => {
    const entry: Omit<CreditsLedgerEntry, 'id' | 'synced'> = {
      userId: metadata.userId,
      venture: metadata.venture || 'SCHOOL',
      type: 'earn',
      amount,
      source,
      metadata,
      timestamp: Date.now(),
    };

    if (online) {
      try {
        const response = await fetch('/api/credits/earn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          const data = await response.json();
          setLocalBalance(prev => prev + amount);
          return data;
        }
      } catch (e) {
        console.log('Online earn failed, storing offline');
      }
    }

    await storeCreditsOffline(entry);
    setLocalBalance(prev => prev + amount);
    return { offline: true, ...entry };
  }, [online]);

  const spendCredits = useCallback(async (amount: number, destination: string, metadata: CreditsMetadata = {}) => {
    if (localBalance < amount) {
      throw new Error('Insufficient credits');
    }

    const entry: Omit<CreditsLedgerEntry, 'id' | 'synced'> = {
      userId: metadata.userId,
      venture: metadata.venture || 'SCHOOL',
      type: 'spend',
      amount: -amount,
      source: destination,
      metadata,
      timestamp: Date.now(),
    };

    if (online) {
      try {
        const response = await fetch('/api/credits/spend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          const data = await response.json();
          setLocalBalance(prev => prev - amount);
          return data;
        }
      } catch (e) {
        console.log('Online spend failed, storing offline');
      }
    }

    await storeCreditsOffline(entry);
    setLocalBalance(prev => prev - amount);
    return { offline: true, ...entry };
  }, [online, localBalance]);

  const syncNow = useCallback(async () => {
    await forceSync();
    const unsynced = await syncCreditsLedger();
    return unsynced;
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
        throw new Error('Offline');
      }
    } catch {
      const cached = await getCachedAPIResponse(key);
      if (cached) {
        setData(cached as T);
        setFromCache(true);
      } else {
        setError(new Error('No cached data available'));
      }
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, online]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!online) return;
    const freshData = await fetcher();
    setData(freshData);
    setFromCache(false);
  }, [fetcher, online]);

  return { data, loading, error, fromCache, refresh };
}