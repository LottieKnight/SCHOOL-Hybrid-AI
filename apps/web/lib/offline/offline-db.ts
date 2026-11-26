// Offline-first storage for the SCHOOL PWA.
//
// IndexedDB holds four stores:
//   sync-queue     — generic API mutations queued while offline (replayed on
//                    reconnect / background sync)
//   cached-content — metadata of responses parked in the Cache API
//   user-data      — small key/value user preferences
//   credits-ledger — offline Scholar Credits entries replayed to the Fastify
//                    /api/credits/sync endpoint (each carries an idempotency
//                    key so a retry can never double-earn or double-spend).
//
// Ported from prototypes/offline-pwa/offline-db.ts to the live app. The
// credits sync payload matches apps/api/src/routes/credits.ts (POST /credits/sync).

import { API_BASE } from "@/lib/apiBase";

const OFFLINE_DB_NAME = "school-offline-db";
const OFFLINE_DB_VERSION = 1;
const STORES = {
  QUEUE: "sync-queue",
  CONTENT: "cached-content",
  USER_DATA: "user-data",
  CREDITS: "credits-ledger",
} as const;

export type OfflineStoreName = (typeof STORES)[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;

export async function initOfflineDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        const queueStore = db.createObjectStore(STORES.QUEUE, { keyPath: "id", autoIncrement: true });
        queueStore.createIndex("timestamp", "timestamp", { unique: false });
        queueStore.createIndex("type", "type", { unique: false });
        queueStore.createIndex("status", "status", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CONTENT)) {
        const contentStore = db.createObjectStore(STORES.CONTENT, { keyPath: "url" });
        contentStore.createIndex("timestamp", "timestamp", { unique: false });
        contentStore.createIndex("type", "type", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
        db.createObjectStore(STORES.USER_DATA, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORES.CREDITS)) {
        const creditsStore = db.createObjectStore(STORES.CREDITS, { keyPath: "id", autoIncrement: true });
        creditsStore.createIndex("userId", "userId", { unique: false });
        creditsStore.createIndex("venture", "venture", { unique: false });
        creditsStore.createIndex("timestamp", "timestamp", { unique: false });
        creditsStore.createIndex("synced", "synced", { unique: false });
      }
    };
  });
}

export async function dbAdd(storeName: OfflineStoreName, data: unknown): Promise<number> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGet(storeName: OfflineStoreName, key: IDBValidKey): Promise<unknown> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGetAll(
  storeName: OfflineStoreName,
  indexName?: string,
  query?: IDBValidKey | IDBKeyRange | null
): Promise<unknown[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const index = indexName ? store.index(indexName) : store;
    const request = query ? index.getAll(query) : index.getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
  });
}

export async function dbPut(storeName: OfflineStoreName, data: unknown): Promise<void> {
  const db = await initOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbDelete(storeName: OfflineStoreName, key: IDBValidKey): Promise<void> {
  const db = await initOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbClear(storeName: OfflineStoreName): Promise<void> {
  const db = await initOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export interface SyncQueueItem {
  id?: number;
  type: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retries: number;
  status: "pending" | "failed";
}

export async function queueForSync(item: Omit<SyncQueueItem, "id" | "status">): Promise<number> {
  return dbAdd(STORES.QUEUE, {
    ...item,
    status: "pending",
    timestamp: item.timestamp || Date.now(),
    retries: item.retries || 0,
  });
}

export async function processSyncQueue(): Promise<Array<{ id: number; success: boolean; error?: string }>> {
  const pending = (await dbGetAll(STORES.QUEUE, "status", IDBKeyRange.only("pending"))) as SyncQueueItem[];

  const results = await Promise.allSettled(
    pending.map(async (item) => {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });

        if (response.ok) {
          await dbDelete(STORES.QUEUE, item.id as number);
          return { id: item.id!, success: true };
        }
        const updated: SyncQueueItem = {
          ...item,
          retries: item.retries + 1,
          status: item.retries >= 3 ? "failed" : "pending",
        };
        await dbPut(STORES.QUEUE, updated);
        return { id: item.id!, success: false, error: `HTTP ${response.status}` };
      } catch (e) {
        const updated: SyncQueueItem = {
          ...item,
          retries: item.retries + 1,
          status: item.retries >= 3 ? "failed" : "pending",
        };
        await dbPut(STORES.QUEUE, updated);
        return { id: item.id!, success: false, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ id: number; success: boolean; error?: string }> => r.status === "fulfilled")
    .map((r) => r.value);
}

export interface SyncStatus {
  pending: number;
  failed: number;
  items: SyncQueueItem[];
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const [pending, failed] = await Promise.all([
    dbGetAll(STORES.QUEUE, "status", IDBKeyRange.only("pending")),
    dbGetAll(STORES.QUEUE, "status", IDBKeyRange.only("failed")),
  ]);
  return {
    pending: pending.length,
    failed: failed.length,
    items: [...(pending as SyncQueueItem[]), ...(failed as SyncQueueItem[])],
  };
}

export interface CachedContentEntry {
  url: string;
  timestamp: number;
  type: string;
}

export interface CreditsLedgerEntry {
  id?: number;
  userId?: string;
  venture: string;
  type: "earn" | "spend";
  amount: number;
  source: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  referenceId?: string;
  referenceType?: string;
  timestamp: number;
  synced: boolean;
}

export async function cacheAPIResponse(url: string, response: Response, type = "api"): Promise<void> {
  const cache = await caches.open("school-offline-v1");
  await cache.put(url, response.clone());
  await dbAdd(STORES.CONTENT, { url, timestamp: Date.now(), type } as CachedContentEntry);
}

export async function getCachedAPIResponse(url: string): Promise<unknown | null> {
  const cached = (await dbGet(STORES.CONTENT, url)) as CachedContentEntry | undefined;
  if (!cached) return null;

  const cache = await caches.open("school-offline-v1");
  const response = await cache.match(url);
  if (!response) return null;

  return response.json();
}

export async function storeUserData(key: string, data: unknown): Promise<void> {
  return dbPut(STORES.USER_DATA, { key, data, timestamp: Date.now() });
}

export async function getUserData<T = unknown>(key: string): Promise<T | undefined> {
  const result = (await dbGet(STORES.USER_DATA, key)) as { data: T } | undefined;
  return result?.data;
}

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)saedu_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function storeCreditsOffline(
  entry: Omit<CreditsLedgerEntry, "id" | "synced">
): Promise<number> {
  return dbAdd(STORES.CREDITS, {
    ...entry,
    idempotencyKey: entry.idempotencyKey ?? `offline-${crypto.randomUUID()}`,
    synced: false,
    timestamp: entry.timestamp || Date.now(),
  });
}

export async function getUnsyncedCredits(): Promise<CreditsLedgerEntry[]> {
  return (await dbGetAll(STORES.CREDITS, "synced", IDBKeyRange.only(false))) as CreditsLedgerEntry[];
}

export async function markCreditsSynced(id: number): Promise<void> {
  const entry = (await dbGet(STORES.CREDITS, id)) as CreditsLedgerEntry | undefined;
  if (entry) {
    return dbPut(STORES.CREDITS, { ...entry, synced: true });
  }
}

export interface CreditsSyncResult {
  id: IDBValidKey;
  success: boolean;
  error?: string;
}

// The Fastify /credits/sync endpoint accepts a batched { entries: [...] } payload
// (see apps/api/src/routes/credits.ts). Each entry carries its idempotency key so
// replays — including background-sync retries — are safe. Only entries the server
// reports as processed are acknowledged; a per-entry failure leaves that entry
// unsynced for the next replay instead of being skipped.
export async function syncCreditsLedger(apiEndpoint = `${API_BASE}/credits/sync`): Promise<CreditsSyncResult[]> {
  const unsynced = await getUnsyncedCredits();
  if (unsynced.length === 0) return [];

  const entries = unsynced.map((entry) => ({
    op: entry.type,
    venture: entry.venture,
    source: entry.source,
    amount: Math.abs(Math.trunc(entry.amount)),
    description: entry.metadata?.description as string | undefined,
    metadata: entry.metadata,
    idempotencyKey: entry.idempotencyKey,
    referenceId: entry.referenceId,
    referenceType: entry.referenceType,
  }));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrfToken = getCsrfToken();
  if (csrfToken) headers["x-csrf-token"] = csrfToken;

  const results: CreditsSyncResult[] = [];
  let response: Response;
  try {
    response = await fetch(apiEndpoint, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ entries }),
    });
  } catch (e) {
    return unsynced.map((entry) => ({
      id: entry.id!,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }

  const payload = (await response.json().catch(() => null)) as { results?: Array<{ success: boolean; idempotencyKey?: string | null; error?: string }> } | null;

  for (const entry of unsynced) {
    const match = payload?.results?.find(
      (result) => result.idempotencyKey && result.idempotencyKey === entry.idempotencyKey
    );
    const succeeded = response.ok && match?.success === true;

    if (succeeded) {
      await markCreditsSynced(entry.id!);
    }
    results.push({
      id: entry.id!,
      success: succeeded,
      error: succeeded ? undefined : (match?.error ?? `HTTP ${response.status}`),
    });
  }

  // Keep the ledger from growing without bound once entries have been synced.
  if (results.some((result) => result.success)) {
    await pruneSyncedCredits();
  }

  return results;
}

// Deletes synced ledger entries older than a week, so the IndexedDB credits
// ledger never accumulates the full history of a user's earn/spend activity.
export async function pruneSyncedCredits(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const all = (await dbGetAll(STORES.CREDITS)) as CreditsLedgerEntry[];
  const cutoff = Date.now() - maxAgeMs;
  const stale = all.filter((entry) => entry.synced === true && entry.timestamp < cutoff);
  for (const entry of stale) {
    await dbDelete(STORES.CREDITS, entry.id as number);
  }
}

export function requestBackgroundSync(tag = "background-sync"): Promise<void> {
  if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
    return navigator.serviceWorker.ready.then((registration) => {
      const swRegistration = registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      };
      return swRegistration.sync.register(tag);
    });
  }
  return Promise.reject(new Error("Background sync not supported"));
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  return () => window.removeEventListener("online", callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener("offline", callback);
  return () => window.removeEventListener("offline", callback);
}
