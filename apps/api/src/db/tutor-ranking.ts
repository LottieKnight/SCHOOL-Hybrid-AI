import { pool } from "./pool.js";
import { config } from "../config.js";
import {
  computeTutorRankingScore,
  getReliabilityLabel,
  haversineDistanceKm,
  toNumber,
  type TutorRankingMetrics,
} from "../lib/tutor-ranking.js";

type SnapshotRow = {
  tutor_id: string;
  ranking_score: number;
  reliability_score: number;
  computed_at: string;
};

export async function getTutorRankingSnapshots(tutorIds: string[]) {
  if (!tutorIds.length) return new Map<string, SnapshotRow>();
  const result = await pool.query(
    `
      SELECT tutor_id, ranking_score, reliability_score, computed_at
      FROM tutor_ranking_snapshots
      WHERE tutor_id = ANY($1)
    `,
    [tutorIds]
  );

  const map = new Map<string, SnapshotRow>();
  for (const row of result.rows) {
    map.set(row.tutor_id, row);
  }
  return map;
}

export async function getTutorRankingMetrics(tutorIds: string[]) {
  if (!tutorIds.length) return new Map<string, TutorRankingMetrics>();

  const result = await pool.query(
    `
      SELECT
        t.id AS tutor_id,
        t.rating_avg,
        t.rating_count,
        t.created_at,
        t.delivery_mode,
        t.location_lat,
        t.location_lng,
        COALESCE(completed.completed_sessions, 0) AS completed_sessions,
        COALESCE(late_cancels.late_cancels, 0) AS late_cancels,
        COALESCE(no_shows.no_show_count, 0) AS no_show_count,
        COALESCE(disputes_lost.disputes_lost, 0) AS disputes_lost,
        COALESCE(off_platform.low_count, 0) AS off_platform_low,
        COALESCE(off_platform.high_count, 0) AS off_platform_high,
        COALESCE(fraud_strikes.fraud_count, 0) AS fraud_count,
        COALESCE(unresolved.disputes_open, 0) AS disputes_open,
        COALESCE(verified.teacher_count, 0) AS verified_teacher,
        COALESCE(verified.student_count, 0) AS verified_student,
        COALESCE(verified.graduate_count, 0) AS verified_graduate
      FROM tutors t
      LEFT JOIN (
        SELECT tutor_id, COUNT(*) AS completed_sessions
        FROM tutor_sessions
        WHERE status = 'completed'
        GROUP BY tutor_id
      ) completed ON completed.tutor_id = t.id
      LEFT JOIN (
        SELECT tutor_id, COUNT(*) AS late_cancels
        FROM tutor_sessions
        WHERE status = 'cancelled_by_tutor'
          AND cancelled_at IS NOT NULL
          AND scheduled_start_at IS NOT NULL
          AND (scheduled_start_at - cancelled_at) < ($2 || ' hours')::interval
        GROUP BY tutor_id
      ) late_cancels ON late_cancels.tutor_id = t.id
      LEFT JOIN (
        SELECT tutor_id, COUNT(*) AS no_show_count
        FROM tutor_sessions
        WHERE status = 'no_show_tutor'
        GROUP BY tutor_id
      ) no_shows ON no_shows.tutor_id = t.id
      LEFT JOIN (
        SELECT tutor_id, COUNT(*) AS disputes_lost
        FROM tutor_sessions
        WHERE resolution_outcome = 'tutor_fault'
        GROUP BY tutor_id
      ) disputes_lost ON disputes_lost.tutor_id = t.id
      LEFT JOIN (
        SELECT t2.id AS tutor_id,
          COUNT(*) FILTER (WHERE te.severity IN ('low', 'medium')) AS low_count,
          COUNT(*) FILTER (WHERE te.severity = 'high') AS high_count
        FROM trust_events te
        JOIN tutors t2 ON t2.user_id = te.actor_id
        WHERE te.type = 'off_platform_attempt'
        GROUP BY t2.id
      ) off_platform ON off_platform.tutor_id = t.id
      LEFT JOIN (
        SELECT tutor_id, COUNT(*) AS fraud_count
        FROM tutor_strikes
        WHERE reason = 'fraud'
        GROUP BY tutor_id
      ) fraud_strikes ON fraud_strikes.tutor_id = t.id
      LEFT JOIN (
        SELECT s.tutor_id, COUNT(*) AS disputes_open
        FROM disputes d
        JOIN tutor_sessions s ON s.id = d.session_id
        WHERE d.status IN ('open', 'under_review')
        GROUP BY s.tutor_id
      ) unresolved ON unresolved.tutor_id = t.id
      LEFT JOIN (
        SELECT tutor_id,
          COUNT(*) FILTER (WHERE badge_type = 'verified_teacher') AS teacher_count,
          COUNT(*) FILTER (WHERE badge_type = 'verified_student') AS student_count,
          COUNT(*) FILTER (WHERE badge_type = 'verified_graduate') AS graduate_count
        FROM tutor_verifications
        WHERE status = 'approved'
        GROUP BY tutor_id
      ) verified ON verified.tutor_id = t.id
      WHERE t.id = ANY($1)
    `,
    [tutorIds, config.cancellationWindowHours]
  );

  const map = new Map<string, TutorRankingMetrics>();
  for (const row of result.rows) {
    map.set(row.tutor_id, {
      avgRating: row.rating_avg !== null ? Number(row.rating_avg) : null,
      ratingCount: toNumber(row.rating_count, 0),
      completedSessionsCount: toNumber(row.completed_sessions, 0),
      cancellationCountLate: toNumber(row.late_cancels, 0),
      noShowCount: toNumber(row.no_show_count, 0),
      disputesLostCount: toNumber(row.disputes_lost, 0),
      offPlatformAttemptsLow: toNumber(row.off_platform_low, 0),
      offPlatformAttemptsHigh: toNumber(row.off_platform_high, 0),
      fraudStrikesCount: toNumber(row.fraud_count, 0),
      unresolvedDisputesCount: toNumber(row.disputes_open, 0),
      createdAt: new Date(row.created_at),
      deliveryMode: row.delivery_mode,
      hasVerifiedTeacher: toNumber(row.verified_teacher, 0) > 0,
      hasVerifiedStudent: toNumber(row.verified_student, 0) > 0,
      hasVerifiedGraduate: toNumber(row.verified_graduate, 0) > 0,
      supportsOnline: ["online", "hybrid"].includes(row.delivery_mode),
      distanceKm: null,
    });
  }
  return map;
}

export function computeDistanceKm(
  _metrics: TutorRankingMetrics,
  learnerLat?: number | null,
  learnerLng?: number | null,
  tutorLat?: number | null,
  tutorLng?: number | null
) {
  if (
    learnerLat === null ||
    learnerLng === null ||
    tutorLat === null ||
    tutorLng === null ||
    learnerLat === undefined ||
    learnerLng === undefined ||
    tutorLat === undefined ||
    tutorLng === undefined
  ) {
    return null;
  }
  const distance = haversineDistanceKm(learnerLat, learnerLng, tutorLat, tutorLng);
  return Number.isFinite(distance) ? Number(distance.toFixed(2)) : null;
}

export async function upsertTutorRankingSnapshot(input: {
  tutorId: string;
  rankingScore: number;
  reliabilityScore: number;
  computedAt?: string;
}) {
  await pool.query(
    `
      INSERT INTO tutor_ranking_snapshots (tutor_id, ranking_score, reliability_score, computed_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tutor_id)
      DO UPDATE SET
        ranking_score = EXCLUDED.ranking_score,
        reliability_score = EXCLUDED.reliability_score,
        computed_at = EXCLUDED.computed_at
    `,
    [input.tutorId, input.rankingScore, input.reliabilityScore, input.computedAt ?? new Date().toISOString()]
  );
}

export async function recomputeTutorRankingSnapshot(tutorId: string) {
  const metricsMap = await getTutorRankingMetrics([tutorId]);
  const metrics = metricsMap.get(tutorId);
  if (!metrics) return null;
  const score = computeTutorRankingScore(metrics);
  await upsertTutorRankingSnapshot({
    tutorId,
    rankingScore: score.finalScore,
    reliabilityScore: score.reliabilityScore,
  });
  return score;
}

export function getReliabilityLabelFromScore(score: number) {
  return getReliabilityLabel(score);
}
