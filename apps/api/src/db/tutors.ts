import { pool } from "./pool.js";
import { config } from "../config.js";
import { computeTutorRankingScore } from "../lib/tutor-ranking.js";
import {
  computeDistanceKm,
  getReliabilityLabelFromScore,
  getTutorRankingMetrics,
  getTutorRankingSnapshots,
  upsertTutorRankingSnapshot,
} from "./tutor-ranking.js";

export type TutorBadgeType =
  | "verified_graduate"
  | "verified_student"
  | "verified_teacher"
  | "top_tutor";

export type TutorVerificationStatus = "pending" | "approved" | "rejected" | "revoked";

export type TutorSubjectInput = {
  subject: string;
  achievedPercent?: number | null;
  currentlyStudying?: boolean;
  professionallyQualified?: boolean;
};

export type TutorAvailabilityInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type TutorQualificationInput = {
  qualificationType: string;
  title: string;
  institution?: string | null;
  yearCompleted?: number | null;
  isPrimary?: boolean;
};

export type TutorOnboardingInput = {
  fullName: string;
  highestQualification: string;
  qualificationType: string;
  proofOfQualificationUrl: string;
  proofOfQualificationName?: string | null;
  deliveryMode: "online" | "in_person" | "hybrid";
  locationCountry: string;
  locationProvince: string;
  locationCity: string;
  locationAddress?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  radiusKm: number;
  hourlyRate: number;
  bio?: string | null;
  subjects: TutorSubjectInput[];
  availability: TutorAvailabilityInput[];
  qualifications?: TutorQualificationInput[];
};

export type TutorVerificationRecord = {
  id: string;
  tutorId: string;
  tutorUserId: string;
  tutorName: string;
  qualificationType: string;
  badgeType: TutorBadgeType;
  status: TutorVerificationStatus;
  documentUrl: string;
  documentName: string | null;
  reason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

const TOP_TUTOR_RULES = {
  minCompletedSessions: 12,
  minRatingAvg: 4.5,
  maxCancellationRate: 0.1,
};

const VERIFICATION_BADGE_TYPES: TutorBadgeType[] = [
  "verified_graduate",
  "verified_student",
  "verified_teacher",
];

const mapQualificationToBadge = (qualificationType: string): TutorBadgeType | null => {
  switch (qualificationType) {
    case "grade_12":
      return "verified_graduate";
    case "university_student":
      return "verified_student";
    case "qualified_teacher":
    case "retired_educator":
    case "subject_specialist":
      return "verified_teacher";
    default:
      return null;
  }
};

const toNumber = (value: any, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const isTopTutor = (metrics: { completed: number; cancellationRate: number }, ratingAvg: number | null) => {
  const avg = ratingAvg ?? 0;
  return (
    metrics.completed >= TOP_TUTOR_RULES.minCompletedSessions &&
    avg >= TOP_TUTOR_RULES.minRatingAvg &&
    metrics.cancellationRate <= TOP_TUTOR_RULES.maxCancellationRate
  );
};

const mapTutor = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  fullName: row.full_name,
  highestQualification: row.highest_qualification,
  qualificationType: row.qualification_type,
  proofOfQualificationUrl: row.proof_of_qualification_url,
  proofOfQualificationName: row.proof_of_qualification_name,
  deliveryMode: row.delivery_mode,
  location: {
    country: row.location_country,
    province: row.location_province,
    city: row.location_city,
    address: row.location_address,
    radiusKm: Number(row.radius_km),
  },
  hourlyRate: Number(row.hourly_rate),
  bio: row.bio,
  status: row.status,
  ratingAvg: row.rating_avg !== null ? Number(row.rating_avg) : null,
  ratingCount: Number(row.rating_count ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function upsertTutorVerificationRequest(options: {
  tutorId: string;
  userId: string;
  badgeType: TutorBadgeType;
  documentUrl: string;
  documentName?: string | null;
  client?: { query: (text: string, params?: any[]) => Promise<any> };
}) {
  const executor = options.client ?? pool;
  await executor.query(
    `
      INSERT INTO tutor_verifications (
        tutor_id,
        badge_type,
        status,
        document_url,
        document_name,
        submitted_by,
        reviewed_by,
        reviewed_at,
        reason,
        updated_at
      )
      VALUES ($1, $2, 'pending', $3, $4, $5, NULL, NULL, NULL, NOW())
      ON CONFLICT (tutor_id, badge_type)
      DO UPDATE SET
        status = 'pending',
        document_url = EXCLUDED.document_url,
        document_name = EXCLUDED.document_name,
        submitted_by = EXCLUDED.submitted_by,
        reviewed_by = NULL,
        reviewed_at = NULL,
        reason = NULL,
        updated_at = NOW()
    `,
    [
      options.tutorId,
      options.badgeType,
      options.documentUrl,
      options.documentName ?? null,
      options.userId,
    ]
  );
}

async function fetchTutorMetrics(tutorId: string) {
  const result = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_sessions,
        COUNT(*) FILTER (WHERE status = 'cancelled_by_tutor') AS tutor_cancelled,
        COUNT(*) FILTER (
          WHERE status IN (
            'completed',
            'confirmed',
            'requested',
            'cancelled_by_tutor',
            'cancelled_by_learner',
            'no_show_learner',
            'no_show_tutor',
            'disputed',
            'resolved'
          )
        ) AS total_sessions
      FROM tutor_sessions
      WHERE tutor_id = $1
    `,
    [tutorId]
  );
  const row = result.rows[0] ?? {};
  const completed = toNumber(row.completed_sessions, 0);
  const tutorCancelled = toNumber(row.tutor_cancelled, 0);
  const total = toNumber(row.total_sessions, 0);
  const cancellationRate = total > 0 ? tutorCancelled / total : 0;
  return { completed, cancellationRate };
}

export async function upsertTutorProfile(userId: string, input: TutorOnboardingInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO tutors (
          user_id,
          full_name,
          highest_qualification,
          qualification_type,
          proof_of_qualification_url,
          proof_of_qualification_name,
          delivery_mode,
          location_country,
          location_province,
          location_city,
          location_address,
          location_lat,
          location_lng,
          radius_km,
          hourly_rate,
          bio,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          full_name = EXCLUDED.full_name,
          highest_qualification = EXCLUDED.highest_qualification,
          qualification_type = EXCLUDED.qualification_type,
          proof_of_qualification_url = EXCLUDED.proof_of_qualification_url,
          proof_of_qualification_name = EXCLUDED.proof_of_qualification_name,
          delivery_mode = EXCLUDED.delivery_mode,
          location_country = EXCLUDED.location_country,
          location_province = EXCLUDED.location_province,
          location_city = EXCLUDED.location_city,
          location_address = EXCLUDED.location_address,
          location_lat = EXCLUDED.location_lat,
          location_lng = EXCLUDED.location_lng,
          radius_km = EXCLUDED.radius_km,
          hourly_rate = EXCLUDED.hourly_rate,
          bio = EXCLUDED.bio,
          updated_at = NOW()
        RETURNING *
      `,
      [
        userId,
        input.fullName,
        input.highestQualification,
        input.qualificationType,
        input.proofOfQualificationUrl,
        input.proofOfQualificationName ?? null,
        input.deliveryMode,
        input.locationCountry,
        input.locationProvince,
        input.locationCity,
        input.locationAddress ?? null,
        input.locationLat ?? null,
        input.locationLng ?? null,
        input.radiusKm,
        input.hourlyRate,
        input.bio ?? null,
      ]
    );

    const tutor = result.rows[0];

    await client.query("DELETE FROM tutor_subjects WHERE tutor_id = $1", [tutor.id]);
    for (const subject of input.subjects) {
      await client.query(
        `
          INSERT INTO tutor_subjects (
            tutor_id,
            subject_name,
            achieved_percent,
            currently_studying,
            professionally_qualified
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          tutor.id,
          subject.subject,
          subject.achievedPercent ?? null,
          subject.currentlyStudying ?? false,
          subject.professionallyQualified ?? false,
        ]
      );
    }

    await client.query("DELETE FROM tutor_availability WHERE tutor_id = $1", [tutor.id]);
    for (const slot of input.availability) {
      await client.query(
        `
          INSERT INTO tutor_availability (tutor_id, day_of_week, start_time, end_time)
          VALUES ($1, $2, $3, $4)
        `,
        [tutor.id, slot.dayOfWeek, slot.startTime, slot.endTime]
      );
    }

    await client.query("DELETE FROM tutor_qualifications WHERE tutor_id = $1", [tutor.id]);
    const qualifications = input.qualifications?.length
      ? input.qualifications
      : [
          {
            qualificationType: input.qualificationType,
            title: input.highestQualification,
            institution: null,
            yearCompleted: null,
            isPrimary: true,
          },
        ];

    for (const qualification of qualifications) {
      await client.query(
        `
          INSERT INTO tutor_qualifications (
            tutor_id,
            qualification_type,
            title,
            institution,
            year_completed,
            is_primary
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          tutor.id,
          qualification.qualificationType,
          qualification.title,
          qualification.institution ?? null,
          qualification.yearCompleted ?? null,
          qualification.isPrimary ?? false,
        ]
      );
    }

    const badgeType = mapQualificationToBadge(input.qualificationType);
    if (badgeType && VERIFICATION_BADGE_TYPES.includes(badgeType)) {
      await upsertTutorVerificationRequest({
        tutorId: tutor.id,
        userId,
        badgeType,
        documentUrl: input.proofOfQualificationUrl,
        documentName: input.proofOfQualificationName ?? null,
        client,
      });
    }

    await client.query("COMMIT");
    return mapTutor(tutor);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getTutorByUserId(userId: string) {
  const result = await pool.query("SELECT * FROM tutors WHERE user_id = $1", [userId]);
  const tutor = result.rows[0];
  if (!tutor) return null;
  return hydrateTutor(tutor);
}

export async function getTutorById(tutorId: string) {
  const result = await pool.query("SELECT * FROM tutors WHERE id = $1", [tutorId]);
  const tutor = result.rows[0];
  if (!tutor) return null;
  return hydrateTutor(tutor);
}

export async function hydrateTutor(tutorRow: any) {
  const tutor = mapTutor(tutorRow);
  const [subjects, availability, qualifications, verifications, metrics] = await Promise.all([
    pool.query(
      "SELECT subject_name, achieved_percent, currently_studying, professionally_qualified FROM tutor_subjects WHERE tutor_id = $1 ORDER BY subject_name",
      [tutor.id]
    ),
    pool.query(
      "SELECT day_of_week, start_time, end_time FROM tutor_availability WHERE tutor_id = $1 ORDER BY day_of_week, start_time",
      [tutor.id]
    ),
    pool.query(
      "SELECT qualification_type, title, institution, year_completed, is_primary FROM tutor_qualifications WHERE tutor_id = $1 ORDER BY is_primary DESC, created_at DESC",
      [tutor.id]
    ),
    pool.query(
      "SELECT id, badge_type, status, document_url, document_name, reason, reviewed_at, created_at FROM tutor_verifications WHERE tutor_id = $1",
      [tutor.id]
    ),
    fetchTutorMetrics(tutor.id),
  ]);

  const rankingMetricsMap = await getTutorRankingMetrics([tutor.id]);
  const rankingMetrics = rankingMetricsMap.get(tutor.id);
  const rankingScore = rankingMetrics ? computeTutorRankingScore(rankingMetrics) : null;
  const reliabilityLabel = rankingScore
    ? getReliabilityLabelFromScore(rankingScore.reliabilityScore)
    : "Reliable";

  const approvedBadges = verifications.rows
    .filter((row) => row.status === "approved")
    .map((row) => row.badge_type) as TutorBadgeType[];

  const badges = new Set<TutorBadgeType>(approvedBadges);
  if (isTopTutor(metrics, tutor.ratingAvg)) {
    badges.add("top_tutor");
  }

  return {
    ...tutor,
    subjects: subjects.rows.map((row) => ({
      name: row.subject_name,
      achievedPercent: row.achieved_percent !== null ? Number(row.achieved_percent) : null,
      currentlyStudying: row.currently_studying,
      professionallyQualified: row.professionally_qualified,
    })),
    availability: availability.rows.map((row) => ({
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
    })),
    qualifications: qualifications.rows.map((row) => ({
      qualificationType: row.qualification_type,
      title: row.title,
      institution: row.institution,
      yearCompleted: row.year_completed,
      isPrimary: row.is_primary,
    })),
    verifications: verifications.rows.map((row) => ({
      id: row.id,
      badgeType: row.badge_type,
      status: row.status,
      documentUrl: row.document_url,
      documentName: row.document_name,
      reason: row.reason,
      reviewedAt: row.reviewed_at,
      submittedAt: row.created_at,
    })),
    badges: Array.from(badges),
    completedSessionsCount: rankingMetrics?.completedSessionsCount ?? metrics.completed,
    reliabilityLabel,
  };
}

export async function listTutors(filters: {
  subject?: string;
  mode?: string;
  minRating?: number;
  learnerLat?: number;
  learnerLng?: number;
}) {
  const values: any[] = [];
  const clauses: string[] = ["t.status = 'active'", "NOT (t.delivery_mode IN ('in_person', 'hybrid') AND u.is_phone_verified = FALSE)"];

  if (filters.mode) {
    values.push(filters.mode);
    clauses.push(`t.delivery_mode = $${values.length}`);
  }
  if (filters.minRating !== undefined) {
    values.push(filters.minRating);
    clauses.push(`COALESCE(t.rating_avg, 0) >= $${values.length}`);
  }
  if (filters.subject) {
    values.push(filters.subject);
    clauses.push(
      `EXISTS (SELECT 1 FROM tutor_subjects ts WHERE ts.tutor_id = t.id AND LOWER(ts.subject_name) = LOWER($${values.length}))`
    );
  }

  values.push(config.minSessionPrice);
  clauses.push(`t.hourly_rate >= $${values.length}`);

  const query = `
    SELECT
      t.*,
      u.is_email_verified,
      u.is_phone_verified,
      u.verification_level,
      COALESCE(metrics.completed_sessions, 0) as completed_sessions,
      COALESCE(metrics.tutor_cancelled, 0) as tutor_cancelled,
      COALESCE(metrics.total_sessions, 0) as total_sessions,
      CASE
        WHEN COALESCE(metrics.total_sessions, 0) = 0 THEN 0
        ELSE COALESCE(metrics.tutor_cancelled, 0)::float / metrics.total_sessions
      END as cancellation_rate,
      EXISTS (
        SELECT 1 FROM tutor_verifications tv
        WHERE tv.tutor_id = t.id AND tv.status = 'approved'
      ) as has_verified
    FROM tutors t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN (
      SELECT
        tutor_id,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_sessions,
        COUNT(*) FILTER (WHERE status = 'cancelled_by_tutor') AS tutor_cancelled,
        COUNT(*) FILTER (
          WHERE status IN (
            'completed',
            'confirmed',
            'requested',
            'cancelled_by_tutor',
            'cancelled_by_learner',
            'no_show_learner',
            'no_show_tutor',
            'disputed',
            'resolved'
          )
        ) AS total_sessions
      FROM tutor_sessions
      GROUP BY tutor_id
    ) metrics ON metrics.tutor_id = t.id
    WHERE ${clauses.join(" AND ")}
    ORDER BY t.created_at DESC
    LIMIT 80
  `;

  const result = await pool.query(query, values);
  const tutors = result.rows;
  if (!tutors.length) return [];

  const tutorIds = tutors.map((row) => row.id);
  const [subjects, availability, badges] = await Promise.all([
    pool.query(
      "SELECT tutor_id, subject_name FROM tutor_subjects WHERE tutor_id = ANY($1) ORDER BY subject_name",
      [tutorIds]
    ),
    pool.query(
      "SELECT tutor_id, day_of_week, start_time, end_time FROM tutor_availability WHERE tutor_id = ANY($1)",
      [tutorIds]
    ),
    pool.query(
      "SELECT tutor_id, badge_type FROM tutor_verifications WHERE tutor_id = ANY($1) AND status = 'approved'",
      [tutorIds]
    ),
  ]);

  const subjectMap = new Map<string, string[]>();
  for (const row of subjects.rows) {
    const list = subjectMap.get(row.tutor_id) ?? [];
    list.push(row.subject_name);
    subjectMap.set(row.tutor_id, list);
  }

  const availabilityMap = new Map<string, { dayOfWeek: number; startTime: string; endTime: string }[]>();
  for (const row of availability.rows) {
    const list = availabilityMap.get(row.tutor_id) ?? [];
    list.push({ dayOfWeek: row.day_of_week, startTime: row.start_time, endTime: row.end_time });
    availabilityMap.set(row.tutor_id, list);
  }

  const badgeMap = new Map<string, TutorBadgeType[]>();
  for (const row of badges.rows) {
    const list = badgeMap.get(row.tutor_id) ?? [];
    list.push(row.badge_type);
    badgeMap.set(row.tutor_id, list);
  }

  const snapshotMap = await getTutorRankingSnapshots(tutorIds);
  const metricsMap = await getTutorRankingMetrics(tutorIds);
  const now = Date.now();
  const maxAgeMs = 24 * 60 * 60 * 1000;

  const compiled = await Promise.all(
    tutors.map(async (row) => {
      const tutor = mapTutor(row);
      const baseMetrics =
        metricsMap.get(row.id) ?? {
          avgRating: tutor.ratingAvg,
          ratingCount: tutor.ratingCount,
          completedSessionsCount: toNumber(row.completed_sessions, 0),
          cancellationCountLate: 0,
          noShowCount: 0,
          disputesLostCount: 0,
          offPlatformAttemptsLow: 0,
          offPlatformAttemptsHigh: 0,
          fraudStrikesCount: 0,
          unresolvedDisputesCount: 0,
          createdAt: new Date(tutor.createdAt),
          deliveryMode: tutor.deliveryMode,
          hasVerifiedTeacher: false,
          hasVerifiedStudent: false,
          hasVerifiedGraduate: false,
          supportsOnline: ["online", "hybrid"].includes(tutor.deliveryMode),
          distanceKm: null,
        };

      const distanceKm =
        tutor.deliveryMode === "online"
          ? null
          : computeDistanceKm(
              baseMetrics,
              filters.learnerLat ?? null,
              filters.learnerLng ?? null,
              row.location_lat !== null ? Number(row.location_lat) : null,
              row.location_lng !== null ? Number(row.location_lng) : null
            );
      baseMetrics.distanceKm = distanceKm;

      const snapshot = snapshotMap.get(row.id);
      const isFresh = snapshot
        ? now - new Date(snapshot.computed_at).getTime() < maxAgeMs
        : false;
      let rankingScore = snapshot ? Number(snapshot.ranking_score) : 0;
      let reliabilityScore = snapshot ? Number(snapshot.reliability_score) : 0;

      if (!isFresh) {
        const score = computeTutorRankingScore(baseMetrics);
        rankingScore = score.finalScore;
        reliabilityScore = score.reliabilityScore;
        await upsertTutorRankingSnapshot({
          tutorId: row.id,
          rankingScore,
          reliabilityScore,
        });
      }

      const metrics = {
        completed: toNumber(row.completed_sessions, 0),
        cancellationRate: toNumber(row.cancellation_rate, 0),
      };
      const badgeSet = new Set<TutorBadgeType>(badgeMap.get(row.id) ?? []);
      if (isTopTutor(metrics, tutor.ratingAvg)) {
        badgeSet.add("top_tutor");
      }

      return {
        ...tutor,
        subjects: subjectMap.get(row.id) ?? [],
        availability: availabilityMap.get(row.id) ?? [],
        badges: Array.from(badgeSet),
        verification: {
          isEmailVerified: row.is_email_verified,
          isPhoneVerified: row.is_phone_verified,
          verificationLevel: row.verification_level,
        },
        completedSessionsCount: baseMetrics.completedSessionsCount,
        reliabilityLabel: getReliabilityLabelFromScore(reliabilityScore),
        distanceKm,
        rankingScore,
      };
    })
  );

  compiled.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if ((b.ratingAvg ?? 0) !== (a.ratingAvg ?? 0)) {
      return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
    }
    return (b.completedSessionsCount ?? 0) - (a.completedSessionsCount ?? 0);
  });

  return compiled.map((item) => {
    const rest = { ...item };
    delete (rest as Partial<typeof item>).rankingScore;
    delete (rest as Partial<typeof item>).distanceKm;
    return rest;
  });
}

export async function createSessionRequest(input: {
  tutorId: string;
  learnerId: string;
  startTime: string;
  endTime: string;
  price: number;
}) {
  if (input.price < config.minSessionPrice) {
    throw new Error(`Minimum session price is R${config.minSessionPrice} per hour.`);
  }

  const result = await pool.query(
    `
      INSERT INTO tutor_sessions (
        tutor_id,
        learner_id,
        start_time,
        end_time,
        scheduled_start_at,
        scheduled_end_at,
        price,
        status
      )
      VALUES ($1, $2, $3, $4, $3, $4, $5, 'requested')
      RETURNING *
    `,
    [input.tutorId, input.learnerId, input.startTime, input.endTime, input.price]
  );

  return result.rows[0];
}

export async function getSessionWithTutor(sessionId: string) {
  const result = await pool.query(
    `
      SELECT s.*, t.user_id as tutor_user_id, t.full_name as tutor_name
      FROM tutor_sessions s
      JOIN tutors t ON t.id = s.tutor_id
      WHERE s.id = $1
    `,
    [sessionId]
  );
  return result.rows[0] ?? null;
}

export async function updateSessionStatus(sessionId: string, updates: Record<string, unknown>) {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  if (!fields.length) return null;

  const assignments = fields.map((field, idx) => `${field} = $${idx + 1}`);
  const query = `
    UPDATE tutor_sessions
    SET ${assignments.join(", ")}, updated_at = NOW()
    WHERE id = $${fields.length + 1}
    RETURNING *
  `;

  const result = await pool.query(query, [...values, sessionId]);
  return result.rows[0] ?? null;
}

export async function listSessionsForUser(userId: string) {
  const result = await pool.query(
    `
      SELECT s.*, t.user_id as tutor_user_id, t.full_name as tutor_name, r.id as rating_id, r.rating as rating_value
      FROM tutor_sessions s
      JOIN tutors t ON t.id = s.tutor_id
      LEFT JOIN tutor_ratings r ON r.session_id = s.id
      WHERE s.learner_id = $1 OR t.user_id = $1
      ORDER BY s.start_time DESC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tutorId: row.tutor_id,
    tutorName: row.tutor_name,
    learnerId: row.learner_id,
    startTime: row.start_time,
    endTime: row.end_time,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    price: Number(row.price),
    status: row.status,
    cancelledBy: row.cancelled_by,
    cancelledReason: row.cancelled_reason,
    disputedReason: row.disputed_reason,
    confirmedAt: row.confirmed_at,
    completedAt: row.completed_at,
    paidOutAt: row.paid_out_at,
    payoutEligibleAmount: row.payout_eligible_amount,
    refundAmount: row.refund_amount,
    platformFeeAmount: row.platform_fee_amount,
    tutorPayoutAmount: row.tutor_payout_amount,
    ratingId: row.rating_id,
    ratingValue: row.rating_value,
    role: row.tutor_user_id === userId ? "tutor" : "learner",
  }));
}

export async function ensureCommissionRecord(session: {
  id: string;
  price: number;
}) {
  const existing = await pool.query("SELECT id FROM commission_records WHERE session_id = $1", [
    session.id,
  ]);
  if (existing.rows.length) return existing.rows[0];

  const commissionRate = config.commissionRate;
  const commissionAmount = Number((session.price * commissionRate).toFixed(2));
  const netAmount = Number((session.price - commissionAmount).toFixed(2));

  const result = await pool.query(
    `
      INSERT INTO commission_records (
        session_id,
        gross_amount,
        commission_rate,
        commission_amount,
        net_amount
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [session.id, session.price, commissionRate, commissionAmount, netAmount]
  );

  return result.rows[0];
}

export async function createRating(input: {
  sessionId: string;
  tutorId: string;
  learnerId: string;
  rating: number;
  feedback?: string | null;
}) {
  const result = await pool.query(
    `
      INSERT INTO tutor_ratings (session_id, tutor_id, learner_id, rating, feedback)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [input.sessionId, input.tutorId, input.learnerId, input.rating, input.feedback ?? null]
  );

  await updateTutorRating(input.tutorId, input.rating);
  return result.rows[0];
}

export async function getRatingForSession(sessionId: string) {
  const result = await pool.query("SELECT id, rating FROM tutor_ratings WHERE session_id = $1", [
    sessionId,
  ]);
  return result.rows[0] ?? null;
}

export async function updateTutorRating(tutorId: string, newRating: number) {
  const existing = await pool.query("SELECT rating_avg, rating_count FROM tutors WHERE id = $1", [
    tutorId,
  ]);
  const row = existing.rows[0];
  if (!row) return;

  const currentCount = Number(row.rating_count ?? 0);
  const currentAvg = row.rating_avg !== null ? Number(row.rating_avg) : 0;
  const nextCount = currentCount + 1;
  const nextAvg = Number(((currentAvg * currentCount + newRating) / nextCount).toFixed(2));

  await pool.query(
    "UPDATE tutors SET rating_avg = $1, rating_count = $2, updated_at = NOW() WHERE id = $3",
    [nextAvg, nextCount, tutorId]
  );
}

export async function flagRating(ratingId: string, reason: string) {
  const result = await pool.query(
    "UPDATE tutor_ratings SET flagged = TRUE, flagged_reason = $1 WHERE id = $2 RETURNING *",
    [reason, ratingId]
  );
  return result.rows[0] ?? null;
}

export async function getPayoutSummary(tutorId: string) {
  const weekly = await pool.query(
    `
      SELECT COALESCE(SUM(price), 0) as total
      FROM tutor_sessions
      WHERE tutor_id = $1
        AND status = 'completed'
        AND completed_at >= NOW() - INTERVAL '7 days'
    `,
    [tutorId]
  );

  const upcoming = await pool.query(
    `
      SELECT COALESCE(SUM(price), 0) as total
      FROM tutor_sessions
      WHERE tutor_id = $1
        AND status = 'completed'
        AND paid_out_at IS NULL
    `,
    [tutorId]
  );

  const netMultiplier = 1 - config.commissionRate;

  return {
    weeklyEarnings: Number((Number(weekly.rows[0]?.total ?? 0) * netMultiplier).toFixed(2)),
    upcomingPayout: Number((Number(upcoming.rows[0]?.total ?? 0) * netMultiplier).toFixed(2)),
  };
}

export async function listPayoutHistory(tutorId: string) {
  const result = await pool.query(
    `
      SELECT pi.*, pb.period_start, pb.period_end, pb.run_at
      FROM payout_items pi
      JOIN payout_batches pb ON pb.id = pi.payout_batch_id
      WHERE pi.tutor_id = $1
      ORDER BY pb.run_at DESC
    `,
    [tutorId]
  );

  return result.rows.map((row) => ({
    payoutBatchId: row.payout_batch_id,
    sessionId: row.session_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    runAt: row.run_at,
    grossAmount: Number(row.gross_amount),
    commissionAmount: Number(row.commission_amount),
    netAmount: Number(row.net_amount),
    status: row.status,
    paidAt: row.paid_at,
  }));
}

export async function listTutorVerifications(status?: TutorVerificationStatus) {
  const values: any[] = [];
  const clauses: string[] = [];
  if (status) {
    values.push(status);
    clauses.push(`tv.status = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        tv.*,
        t.full_name,
        t.user_id,
        t.qualification_type
      FROM tutor_verifications tv
      JOIN tutors t ON t.id = tv.tutor_id
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY tv.created_at DESC
    `,
    values
  );

  return result.rows.map((row) => ({
    id: row.id,
    tutorId: row.tutor_id,
    tutorUserId: row.user_id,
    tutorName: row.full_name,
    qualificationType: row.qualification_type,
    badgeType: row.badge_type,
    status: row.status,
    documentUrl: row.document_url,
    documentName: row.document_name,
    reason: row.reason,
    submittedAt: row.created_at,
    reviewedAt: row.reviewed_at,
  })) as TutorVerificationRecord[];
}

export async function updateTutorVerificationStatus(options: {
  id: string;
  status: TutorVerificationStatus;
  reason?: string | null;
  reviewerId: string;
}) {
  const result = await pool.query(
    `
      UPDATE tutor_verifications
      SET status = $1,
          reason = $2,
          reviewed_by = $3,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
    [options.status, options.reason ?? null, options.reviewerId, options.id]
  );
  return result.rows[0] ?? null;
}
