export const TOPIC_CACHE_KEY = "school.tutor.topic.v1";
export const LESSON_MEMORY_KEY = "school.tutor.openedLessons.v1";
export const SKILL_MAP_KEY = "school.tutor.skillMap.v1";
export const STATS_KEY = "school.tutor.stats.v1";

export type CachedTopic = {
  topic: string;
  subject: string;
  hints: string[];
  solution: string | null;
  lessonHrefs: string[];
  savedAt: number;
};

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function cacheTopic(store: KeyValueStore, topic: CachedTopic) {
  store.setItem(TOPIC_CACHE_KEY, JSON.stringify(topic));
}

export function readCachedTopic(store: KeyValueStore): CachedTopic | null {
  const raw = store.getItem(TOPIC_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedTopic;
    if (!parsed || typeof parsed.topic !== "string" || !Array.isArray(parsed.hints)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function rememberOpenedLesson(store: KeyValueStore, href: string) {
  const current = readOpenedLessons(store).filter((item) => item !== href);
  current.unshift(href);
  store.setItem(LESSON_MEMORY_KEY, JSON.stringify(current.slice(0, 12)));
}

export function readOpenedLessons(store: KeyValueStore): string[] {
  const raw = store.getItem(LESSON_MEMORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export type OfflinePlan = {
  mode: "on_device" | "cached_topic" | "opened_lessons" | "offline_page";
  message: string;
};

export function planOfflineHelp(input: {
  offline: boolean;
  onDeviceReady: boolean;
  hasCachedTopic: boolean;
  hasOpenedLessons: boolean;
  task: "hint" | "mark" | "plan";
}): OfflinePlan {
  if (!input.offline) {
    return { mode: "on_device", message: "You are online. Hints still prefer this device." };
  }
  if (input.task === "hint" && input.onDeviceReady) {
    return {
      mode: "on_device",
      message: "The signal is weak. This hint stays on the phone and does not use mobile data.",
    };
  }
  if (input.hasCachedTopic) {
    return {
      mode: "cached_topic",
      message: "The network dropped. Showing the topic you already opened, with its hints saved on this phone.",
    };
  }
  if (input.hasOpenedLessons) {
    return {
      mode: "opened_lessons",
      message: "The network dropped. Open a lesson you already loaded, or the offline page.",
    };
  }
  return {
    mode: "offline_page",
    message: "The network dropped before a topic was saved. The offline page is the fallback.",
  };
}
