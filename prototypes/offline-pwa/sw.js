const CACHE_NAME = 'school-offline-v1';
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const CACHE_STRATEGIES = {
  STATIC: 'cache-first',
  API: 'network-first',
  IMAGES: 'cache-first',
  FONTS: 'cache-first',
};

const OFFLINE_DB_NAME = 'school-offline-db';
const OFFLINE_DB_VERSION = 1;
const STORES = {
  QUEUE: 'sync-queue',
  CONTENT: 'cached-content',
  USER_DATA: 'user-data',
  CREDITS: 'credits-ledger',
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

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

  return dbPromise;
}

async function dbAdd(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName, indexName, query) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = indexName ? store.index(indexName) : store;
    const request = query ? index.getAll(query) : index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

async function handleAPIRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const cached = await caches.match(request);
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      }
      return cached || new Response(JSON.stringify({ error: 'Offline' }), { status: 503 });
    } catch {
      return cached || new Response(JSON.stringify({ error: 'Offline' }), { status: 503 });
    }
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    try {
      const networkResponse = await fetch(request);
      return networkResponse;
    } catch {
      const clone = request.clone();
      const body = await clone.text();
      await queueForSync({
        type: 'api-mutation',
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        body,
        timestamp: Date.now(),
        retries: 0,
      });
      return new Response(JSON.stringify({ queued: true, offline: true }), { status: 202 });
    }
  }

  return fetch(request);
}

async function queueForSync(item) {
  await dbAdd(STORES.QUEUE, { ...item, status: 'pending' });
  await triggerSync();
}

async function triggerSync() {
  if (!navigator.onLine) return;

  const registration = await self.registration.ready;
  if ('sync' in registration) {
    try {
      await registration.sync.register('background-sync');
    } catch (e) {
      console.log('Background sync registration failed:', e);
    }
  } else {
    await processSyncQueue();
  }
}

async function processSyncQueue() {
  const queue = await dbGetAll(STORES.QUEUE, 'status', IDBKeyRange.only('pending'));

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok) {
        await dbDelete(STORES.QUEUE, item.id);
      } else {
        await dbPut(STORES.QUEUE, { ...item, retries: item.retries + 1, status: item.retries >= 3 ? 'failed' : 'pending' });
      }
    } catch (e) {
      await dbPut(STORES.QUEUE, { ...item, retries: item.retries + 1, status: item.retries >= 3 ? 'failed' : 'pending' });
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(processSyncQueue());
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }

  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.startsWith(asset))) {
    event.respondWith(
      caches.match(event.request).then((response) =>
        response || fetch(event.request).then((fetchResponse) => {
          const cache = caches.open(CACHE_NAME);
          cache.then(c => c.put(event.request, fetchResponse.clone()));
          return fetchResponse;
        }).catch(() => caches.match('/offline'))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) =>
      response || fetch(event.request).catch(() => caches.match('/offline'))
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_CONTENT') {
    event.waitUntil(cacheContent(event.data.url, event.data.response));
  }

  if (event.data?.type === 'GET_CACHED_CONTENT') {
    event.waitUntil(getCachedContent(event.data.url).then(content => {
      event.ports[0].postMessage({ content });
    }));
  }

  if (event.data?.type === 'GET_SYNC_STATUS') {
    event.waitUntil(getSyncStatus().then(status => {
      event.ports[0].postMessage({ status });
    }));
  }
});

async function cacheContent(url, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, response);
  await dbAdd(STORES.CONTENT, { url, timestamp: Date.now(), type: 'api' });
}

async function getCachedContent(url) {
  const cached = await dbGet(STORES.CONTENT, url);
  if (cached) {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    if (response) return await response.json();
  }
  return null;
}

async function getSyncStatus() {
  const pending = await dbGetAll(STORES.QUEUE, 'status', IDBKeyRange.only('pending'));
  const failed = await dbGetAll(STORES.QUEUE, 'status', IDBKeyRange.only('failed'));
  return { pending: pending.length, failed: failed.length };
}

async function storeCreditsOffline(creditsEntry) {
  await dbAdd(STORES.CREDITS, { ...creditsEntry, synced: false, timestamp: Date.now() });
}

async function syncCreditsLedger() {
  const unsynced = await dbGetAll(STORES.CREDITS, 'synced', IDBKeyRange.only(false));

  for (const entry of unsynced) {
    try {
      const response = await fetch('/api/credits/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (response.ok) {
        await dbPut(STORES.CREDITS, { ...entry, synced: true });
      }
    } catch (e) {
      console.log('Credits sync failed:', e);
    }
  }
}

setInterval(() => {
  if (navigator.onLine) {
    syncCreditsLedger();
    processSyncQueue();
  }
}, 30000);

console.log('[SW] School Offline Service Worker loaded');