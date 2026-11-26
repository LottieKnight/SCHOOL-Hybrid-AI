const STORAGE_KEY = "school:offline_unlock_queue";

export type QueuedUnlock = {
  id: string;
  endpoint: string;
  body: Record<string, unknown>;
  queuedAt: number;
};

export function getQueue(): QueuedUnlock[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as QueuedUnlock[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedUnlock[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueUnlock(endpoint: string, body: Record<string, unknown>): void {
  const queue = getQueue();
  queue.push({ id: crypto.randomUUID(), endpoint, body, queuedAt: Date.now() });
  saveQueue(queue);
}

function removeFromQueue(id: string): void {
  saveQueue(getQueue().filter((item) => item.id !== id));
}

export async function flushQueue(onFlushed?: (count: number) => void): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  let flushed = 0;
  for (const item of queue) {
    try {
      const res = await fetch(item.endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (res.ok) {
        removeFromQueue(item.id);
        flushed++;
      }
    } catch {
      // Still offline — leave in queue
      break;
    }
  }

  if (flushed > 0) onFlushed?.(flushed);
}

export function subscribeToOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  return () => window.removeEventListener("online", callback);
}
