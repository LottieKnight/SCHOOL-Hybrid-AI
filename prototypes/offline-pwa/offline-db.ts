const OFFLINE_DB_NAME = 'school-offline-db';
const OFFLINE_DB_VERSION = 1;
const STORES = {
  QUEUE: 'sync-queue',
  CONTENT: 'cached-content',
  USER_DATA: 'user-data',
  CREDITS: 'credits-ledger',
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
        const queueStore = db.createObjectStore(STORES.QUEUE, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('type', 'type', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CONTENT)) {
        const contentStore = db.createObjectStore(STORES.CONTENT, { keyPath: 'url' });
        contentStore.createIndex('timestamp', 'timestamp', { unique: false });
        contentStore.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
        db.createObjectStore(STORES.USER_DATA, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.CREDITS)) {
        const creditsStore = db.createObjectStore(STORES.CREDITS, { keyPath: 'id', autoIncrement: true });
        creditsStore.createIndex('userId', 'userId', { unique: false });
        creditsStore.createIndex('venture', 'venture', { unique: false });
        creditsStore.createIndex('timestamp', 'timestamp', { unique: false });
        creditsStore.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

export async function dbAdd(storeName: OfflineStoreName, data: unknown): Promise<number> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGet(storeName: OfflineStoreName, key: IDBValidKey): Promise<unknown> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGetAll(storeName: OfflineStoreName, indexName?: string, query?: IDBValidKey | IDBKeyRange | null): Promise<unknown[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
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
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbDelete(storeName: OfflineStoreName, key: IDBValidKey): Promise<void> {
  const db = await initOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbClear(storeName: OfflineStoreName): Promise<void> {
  const db = await initOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
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
  status: 'pending' | 'failed';
}

export async function queueForSync(item: Omit<SyncQueueItem, 'id' | 'status'>): Promise<number> {
  return dbAdd(STORES.QUEUE, {
    ...item,
    status: 'pending',
    timestamp: item.timestamp || Date.now(),
    retries: item.retries || 0,
  });
}

export async function processSyncQueue(): Promise<Array<{ id: number; success: boolean; error?: string }>> {
  const pending = (await dbGetAll(STORES.QUEUE, 'status', IDBKeyRange.only('pending'))) as SyncQueueItem[];

  const results = await Promise.allSettled(pending.map(async (item) => {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok) {
        await dbDelete(STORES.QUEUE, String(item.id));
        return { id: item.id!, success: true };
      } else {
        const updated: SyncQueueItem = { ...item, retries: item.retries + 1, status: item.retries >= 3 ? 'failed' : 'pending' };
        await dbPut(STORES.QUEUE, updated);
        return { id: item.id!, success: false, error: `HTTP ${response.status}` };
      }
    } catch (e) {
      const updated: SyncQueueItem = { ...item, retries: item.retries + 1, status: item.retries >= 3 ? 'failed' : 'pending' };
      await dbPut(STORES.QUEUE, updated);
      return { id: item.id!, success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }));

  return results
    .filter((r): r is PromiseFulfilledResult<{ id: number; success: boolean; error?: string }> => r.status === 'fulfilled')
    .map(r => r.value);
}

export interface SyncStatus {
  pending: number;
  failed: number;
  items: SyncQueueItem[];
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const [pending, failed] = await Promise.all([
    dbGetAll(STORES.QUEUE, 'status', IDBKeyRange.only('pending')),
    dbGetAll(STORES.QUEUE, 'status', IDBKeyRange.only('failed')),
  ]);
  return { pending: pending.length, failed: failed.length, items: [...(pending as SyncQueueItem[]), ...(failed as SyncQueueItem[])] };
}

export interface CachedContentEntry {
  url: string;
  timestamp: number;
  type: string;
}

export interface CreditsLedgerEntry {
  id?: number;
  userId?: number;
  venture: string;
  type: string;
  amount: number;
  source: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
}

export async function cacheAPIResponse(url: string, response: Response, type = 'api'): Promise<void> {
  const cache = await caches.open('school-offline-v1');
  await cache.put(url, response.clone());
  await dbAdd(STORES.CONTENT, { url, timestamp: Date.now(), type } as CachedContentEntry);
}

export async function getCachedAPIResponse(url: string): Promise<unknown | null> {
  const cached = (await dbGet(STORES.CONTENT, url)) as CachedContentEntry | undefined;
  if (!cached) return null;

  const cache = await caches.open('school-offline-v1');
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

export async function storeCreditsOffline(entry: Omit<CreditsLedgerEntry, 'id' | 'synced'>): Promise<number> {
  return dbAdd(STORES.CREDITS, {
    ...entry,
    synced: false,
    timestamp: entry.timestamp || Date.now(),
  });
}

export async function getUnsyncedCredits(): Promise<CreditsLedgerEntry[]> {
  return (await dbGetAll(STORES.CREDITS, 'synced', IDBKeyRange.only(false))) as CreditsLedgerEntry[];
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

export async function syncCreditsLedger(apiEndpoint = '/api/credits/sync'): Promise<CreditsSyncResult[]> {
  const unsynced = await getUnsyncedCredits();
  const results: CreditsSyncResult[] = [];

  for (const entry of unsynced) {
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (response.ok) {
        await markCreditsSynced(entry.id!);
        results.push({ id: entry.id!, success: true });
      } else {
        results.push({ id: entry.id!, success: false, error: `HTTP ${response.status}` });
      }
    } catch (e) {
      results.push({ id: entry.id!, success: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return results;
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available');
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      });
      return registration;
    }).catch((error) => {
      console.error('[SW] Registration failed:', error);
      return null;
    });
  }
  return Promise.resolve(null);
}

export function requestBackgroundSync(tag = 'background-sync'): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    return navigator.serviceWorker.ready.then((registration) => {
      const swRegistration = registration as ServiceWorkerRegistration & { sync: { register: (t: string) => Promise<void> } };
      return swRegistration.sync.register(tag);
    });
  }
  return Promise.reject(new Error('Background sync not supported'));
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}