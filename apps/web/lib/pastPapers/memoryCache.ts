import "server-only";

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

const MAX_ENTRIES = 500;

/**
 * Process/isolate-local TTL cache.
 *
 * The OpenNext adapter is configured with a `dummy` incremental cache, so
 * `unstable_cache` does not persist and every request re-runs the query. That
 * made the past-papers catalogue and the homepage activity strip re-scan the
 * whole PastPaper table on each request, exhausting the D1 free-tier row-read
 * allowance. This keeps hot reads in the Worker isolate between requests.
 */
export async function memoryCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      if (store.size > MAX_ENTRIES) {
        for (const [k, entry] of store) {
          if (entry.expiresAt <= Date.now()) store.delete(k);
        }
      }
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
