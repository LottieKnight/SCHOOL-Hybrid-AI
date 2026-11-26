const CACHE_NAME = "saedu-runtime-v4";
const LESSON_CACHE = "saedu-lessons-v4";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.add(OFFLINE_URL);
      await cache.add("/tutor").catch(() => undefined);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== LESSON_CACHE) {
            return caches.delete(name);
          }
          return undefined;
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/lesson-json") || url.pathname.startsWith("/api/flashcards")) {
    event.respondWith(
      caches.open(LESSON_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(event.request);
          const path = url.pathname;
          const keep =
            response.ok &&
            (path === "/tutor" ||
              path === "/offline" ||
              path === "/past-papers" ||
              path.startsWith("/past-papers/") ||
              path.startsWith("/learn") ||
              path.startsWith("/phase"));
          if (keep) cache.put(event.request, response.clone());
          return response;
        } catch {
          return (
            (await cache.match(event.request)) ||
            (await cache.match(OFFLINE_URL)) ||
            Response.error()
          );
        }
      })()
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SCHOOL", body: event.data.text() };
  }
  const title = payload.title ?? "SCHOOL";
  const options = {
    body: payload.body ?? "",
    icon: "/images/icon-192.png",
    badge: "/images/icon-72.png",
    data: { url: payload.url ?? "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

function safeNotificationPath(url) {
  if (typeof url !== "string") return "/";
  const value = url.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return "/";
  }
  return value;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeNotificationPath(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// --- Offline mutation sync (background sync) --------------------------------
// Replays queued POST/PUT/PATCH/DELETE requests from the IndexedDB "sync-queue"
// store (see apps/web/lib/offline/offline-db.ts) when connectivity returns.

const OFFLINE_DB_NAME = "school-offline-db";
const QUEUE_STORE = "sync-queue";
const MAX_RETRIES = 3;

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("status", "status", { unique: false });
      }
    };
  });
}

function getPendingQueueItems() {
  return openOfflineDb().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const index = tx.objectStore(QUEUE_STORE).index("status");
      const request = index.getAll(IDBKeyRange.only("pending"));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    })
  );
}

function deleteQueueItem(id) {
  return openOfflineDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, "readwrite");
        const request = tx.objectStore(QUEUE_STORE).delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      })
  );
}

function bumpQueueItem(item) {
  const updated = {
    ...item,
    retries: (item.retries || 0) + 1,
    status: (item.retries || 0) >= MAX_RETRIES ? "failed" : "pending",
  };
  return openOfflineDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, "readwrite");
        const request = tx.objectStore(QUEUE_STORE).put(updated);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      })
  );
}

async function replaySyncQueue() {
  const items = await getPendingQueueItems();
  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method || "POST",
        headers: item.headers || {},
        body: item.body,
      });
      if (response.ok) {
        await deleteQueueItem(item.id);
      } else {
        await bumpQueueItem(item);
      }
    } catch {
      await bumpQueueItem(item);
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag !== "background-sync") return;
  event.waitUntil(replaySyncQueue());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
