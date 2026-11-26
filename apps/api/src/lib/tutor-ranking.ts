const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type TutorRankingMetrics = {
  avgRating: number | null;
  ratingCount: number;
  completedSessionsCount: number;
  cancellationCountLate: number;
  noShowCount: number;
  disputesLostCount: number;
  offPlatformAttemptsLow: number;
  offPlatformAttemptsHigh: number;
  fraudStrikesCount: number;
  unresolvedDisputesCount: number;
  createdAt: Date;
  deliveryMode: "online" | "in_person" | "hybrid";
  hasVerifiedTeacher: boolean;
  hasVerifiedStudent: boolean;
  hasVerifiedGraduate: boolean;
  supportsOnline: boolean;
  distanceKm?: number | null;
};

export type TutorRankingScore = {
  finalScore: number;
  qualityScore: number;
  reliabilityScore: number;
  verificationScore: number;
  experienceScore: number;
  integrityPenalty: number;
  fairnessBoost: number;
  geoBoost: number;
  onlineBoost: number;
};

const NEUTRAL_RATING = 4.4;
const UNRESOLVED_DISPUTE_THRESHOLD = 2;

export function computeTutorRankingScore(metrics: TutorRankingMetrics, now = new Date()): TutorRankingScore {
  const ratingForScore =
    metrics.ratingCount < 3 ? NEUTRAL_RATING : metrics.avgRating ?? NEUTRAL_RATING;
  const qualityScore = clamp(((ratingForScore - 1) / 4) * 40, 0, 40);

  const reliabilityScore = clamp(
    30 -
      metrics.cancellationCountLate * 3 -
      metrics.noShowCount * 8 -
      metrics.disputesLostCount * 6,
    0,
    30
  );

  const verificationScore = metrics.hasVerifiedTeacher
    ? 15
    : metrics.hasVerifiedStudent
      ? 10
      : metrics.hasVerifiedGraduate
        ? 8
        : 0;

  const completed = metrics.completedSessionsCount;
  const experienceScore =
    completed <= 2
      ? 2
      : completed <= 10
        ? 5
        : completed <= 25
          ? 7
          : completed <= 50
            ? 9
            : 10;

  const integrityPenaltyRaw =
    metrics.offPlatformAttemptsLow * -5 +
    metrics.offPlatformAttemptsHigh * -10 +
    metrics.fraudStrikesCount * -15 +
    (metrics.unresolvedDisputesCount > UNRESOLVED_DISPUTE_THRESHOLD ? -8 : 0);
  const integrityPenalty = clamp(integrityPenaltyRaw, -30, 0);

  const accountAgeDays = (now.getTime() - metrics.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const fairnessBoost =
    completed < 5 && accountAgeDays < 30 ? 8 * (1 - accountAgeDays / 30) : 0;

  const distanceKm = metrics.distanceKm ?? null;
  const geoBoost =
    metrics.deliveryMode !== "online" && distanceKm !== null
      ? distanceKm <= 2
        ? 6
        : distanceKm <= 5
          ? 4
          : distanceKm <= 10
            ? 2
            : 0
      : 0;

  const onlineBoost = metrics.supportsOnline ? 2 : 0;

  const finalScore = clamp(
    qualityScore +
      reliabilityScore +
      verificationScore +
      experienceScore +
      integrityPenalty +
      fairnessBoost +
      geoBoost +
      onlineBoost,
    0,
    100
  );

  return {
    finalScore,
    qualityScore,
    reliabilityScore,
    verificationScore,
    experienceScore,
    integrityPenalty,
    fairnessBoost,
    geoBoost,
    onlineBoost,
  };
}

export function getReliabilityLabel(reliabilityScore: number) {
  if (reliabilityScore >= 25) return "Very reliable";
  if (reliabilityScore >= 18) return "Reliable";
  if (reliabilityScore >= 10) return "Inconsistent";
  return "High risk";
}

export function toBoolean(value: any) {
  return Boolean(value);
}

export function toNumber(value: any, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}
