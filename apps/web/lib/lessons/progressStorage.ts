import {
  createProgressWriteQueue,
  emptyProgressStore,
  mergeProgressStores,
  parseProgressStore,
  type ProgressStore,
} from "./progress";

export const LEARN_PROGRESS_STORAGE_KEY = "school.learn.progress.v1";
export const LEARN_AUDIENCE_STORAGE_KEY = "school.learn.audience";

export type LearnAudience = "student" | "teacher";

export function readStoredProgress(): ProgressStore {
  if (typeof window === "undefined") return emptyProgressStore();
  try {
    const raw = window.localStorage.getItem(LEARN_PROGRESS_STORAGE_KEY);
    if (!raw) return emptyProgressStore();
    return parseProgressStore(JSON.parse(raw));
  } catch {
    return emptyProgressStore();
  }
}

export function writeStoredProgress(store: ProgressStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEARN_PROGRESS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // A full or private-mode store should not block the lesson.
  }
}

export function readStoredAudience(): LearnAudience {
  if (typeof window === "undefined") return "student";
  try {
    return window.localStorage.getItem(LEARN_AUDIENCE_STORAGE_KEY) === "teacher" ? "teacher" : "student";
  } catch {
    return "student";
  }
}

export function writeStoredAudience(audience: LearnAudience) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEARN_AUDIENCE_STORAGE_KEY, audience);
  } catch {
    // Ignore storage failures.
  }
}

export async function pullRemoteProgress(): Promise<ProgressStore | null> {
  try {
    const response = await fetch("/api/learn/progress", { credentials: "include" });
    if (!response.ok) return null;
    const payload = (await response.json()) as { store?: unknown };
    return parseProgressStore(payload.store);
  } catch {
    return null;
  }
}

async function sendProgressSnapshot(store: ProgressStore): Promise<boolean> {
  try {
    const response = await fetch("/api/learn/progress", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const enqueueRemoteProgress = createProgressWriteQueue(sendProgressSnapshot);

export function pushRemoteProgress(store: ProgressStore): Promise<boolean> {
  return enqueueRemoteProgress(store);
}

export async function syncProgress(local: ProgressStore): Promise<ProgressStore> {
  const remote = await pullRemoteProgress();
  if (!remote) return local;
  const merged = mergeProgressStores(local, remote);
  writeStoredProgress(merged);
  if (JSON.stringify(merged) !== JSON.stringify(remote)) {
    await pushRemoteProgress(merged);
  }
  return merged;
}
