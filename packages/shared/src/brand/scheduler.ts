import {
  type Platform,
  type Pillar,
  type PillarWeights,
  DEFAULT_PILLAR_WEIGHTS,
  PLATFORM_TIMING,
} from "./types.js";

export function getPlatformsForPillar(pillar: Pillar): Platform[] {
  const map: Record<Pillar, Platform[]> = {
    trading: ["x", "linkedin", "instagram"],
    school: ["x", "linkedin", "youtube", "instagram"],
    aura: ["x", "instagram", "youtube"],
    builder: ["x", "linkedin", "youtube"],
  };
  return map[pillar];
}

export function getNextPostTime(platform: Platform, after: Date = new Date()): Date {
  const windows = PLATFORM_TIMING[platform];
  const sast = new Date(after.getTime() + 2 * 60 * 60 * 1000);

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(sast);
    candidate.setDate(candidate.getDate() + daysAhead);

    for (const window of windows) {
      if (window.days.includes(candidate.getDay())) {
        const postTime = new Date(candidate);
        postTime.setHours(window.hour, 0, 0, 0);
        if (postTime > sast) {
          return new Date(postTime.getTime() - 2 * 60 * 60 * 1000);
        }
      }
    }
  }

  return new Date(after.getTime() + 24 * 60 * 60 * 1000);
}

export function isPillarAllowed(
  weeklyPostCounts: Record<Pillar, number>,
  pillar: Pillar,
  weights: PillarWeights = DEFAULT_PILLAR_WEIGHTS
): boolean {
  const total = Object.values(weeklyPostCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return true;
  const currentRatio = weeklyPostCounts[pillar] / total;
  return currentRatio <= weights[pillar];
}

export function generateFingerprint(content: string): string {
  const normalized = content
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .slice(0, 200);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
