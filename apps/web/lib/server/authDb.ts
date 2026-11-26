import "server-only";

import { queryPlannerDb } from "@/lib/server/plannerDb";
import { redis } from "@/lib/redis";
import { recordActiveUser } from "@/lib/server/growthDb";
import { randomUUID } from "node:crypto";

const USER_CACHE_TTL = 600; // 10 minutes

function userCacheKey(id: string) {
  return `user:${id}`;
}

async function invalidateUserCache(id: string) {
  if (!redis) return;
  try { await redis.del(userCacheKey(id)); } catch { /* best-effort */ }
}

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  verification_level: string;
  trial_started_at: string;
  trial_ends_at: string;
  plan_type: string;
  plan_status: string;
  plan_expires_at: string | null;
  created_at: string;
  password_reset_token: string | null;
  password_reset_expires: string | null;
};

export type ProfileRecord = {
  user_id: string;
  username: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  school_id: string | null;
  app_preferences: Record<string, unknown>;
};

const USER_COLS =
  "id, email, password_hash, first_name, last_name, phone, role, is_email_verified, is_phone_verified, verification_level, trial_started_at, trial_ends_at, plan_type, plan_status, plan_expires_at, created_at, password_reset_token, password_reset_expires";

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await queryPlannerDb<UserRecord>(
    `SELECT ${USER_COLS} FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (redis) {
    try {
      const cached = await redis.get(userCacheKey(id));
      if (cached) return JSON.parse(cached) as UserRecord;
    } catch { /* fall through to DB on cache failure */ }
  }

  const result = await queryPlannerDb<UserRecord>(
    `SELECT ${USER_COLS} FROM users WHERE id = $1`,
    [id]
  );
  const user = result.rows[0] ?? null;

  if (user && redis) {
    try { await redis.setex(userCacheKey(id), USER_CACHE_TTL, JSON.stringify(user)); } catch { /* best-effort */ }
  }

  if (user) {
    recordActiveUser(user.id); // fire-and-forget — does not affect response latency
  }

  return user;
}

export async function createUser(
  email: string,
  passwordHash: string,
  firstName: string,
  lastName: string,
  phone: string,
  role: string
): Promise<UserRecord> {
  const result = await queryPlannerDb<UserRecord>(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${USER_COLS}`,
    [email, passwordHash, firstName, lastName, phone, role]
  );
  return result.rows[0];
}

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const result = await queryPlannerDb<ProfileRecord>(
    "SELECT user_id, username, country, province, city, school_id, app_preferences FROM user_profiles WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] ?? null;
}

const DEFAULT_AVATAR = JSON.stringify({
  skinTone: "#d9a98f",
  hairStyle: "short",
  hairColor: "#4a3128",
  topColor: "#2d3b6f",
  bottomColor: "#2f2f2f",
  accentColor: "#f5c04f",
});

export async function ensureProfile(userId: string, baseUsername: string): Promise<void> {
  const existing = await getProfile(userId);
  if (existing) return;

  const base =
    baseUsername
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "student";

  for (let i = 0; i < 5; i++) {
    const username = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await queryPlannerDb(
        "INSERT INTO user_profiles (user_id, username, avatar_uniform, avatar_casual) VALUES ($1, $2, $3::jsonb, $4::jsonb)",
        [userId, username, DEFAULT_AVATAR, DEFAULT_AVATAR]
      );
      return;
    } catch (error) {
      if ((error as { code?: string })?.code !== "23505") throw error;
    }
  }

  await queryPlannerDb(
    "INSERT INTO user_profiles (user_id, username, avatar_uniform, avatar_casual) VALUES ($1, $2, $3::jsonb, $4::jsonb)",
    [userId, `${base}${randomUUID().slice(0, 8)}`, DEFAULT_AVATAR, DEFAULT_AVATAR]
  );
}

export async function updateProfileOnRegister(
  userId: string,
  fields: { country: string; province: string; city: string; schoolId: string | null }
): Promise<void> {
  const onboardingMarkedAt = new Date().toISOString();
  const appPreferences = JSON.stringify({
    profileSettings: {
      preferenceOnboardingStatus: "pending",
      promptedAt: onboardingMarkedAt,
      discoverableInSuggestions: true,
      allowFollowers: true,
    },
  });

  await queryPlannerDb(
    `UPDATE user_profiles
     SET country = $2, province = $3, city = $4, school_id = $5,
         app_preferences = COALESCE(app_preferences, '{}'::jsonb) || $6::jsonb
     WHERE user_id = $1`,
    [userId, fields.country, fields.province, fields.city, fields.schoolId, appPreferences]
  );
}

export async function setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await queryPlannerDb(
    "UPDATE users SET password_reset_token = $2, password_reset_expires = $3 WHERE id = $1",
    [userId, tokenHash, expiresAt]
  );
}

export async function applyPasswordReset(userId: string, newPasswordHash: string): Promise<void> {
  await queryPlannerDb(
    "UPDATE users SET password_hash = $2, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1",
    [userId, newPasswordHash]
  );
  await invalidateUserCache(userId);
}

export function getAccessStatus(user: UserRecord) {
  const now = new Date();
  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const planExpiresAt = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const base = {
    trialEndsAt: user.trial_ends_at,
    planType: user.plan_type,
    planStatus: user.plan_status,
    planExpiresAt: user.plan_expires_at,
  };

  if (user.plan_status === "active") {
    if (!planExpiresAt || planExpiresAt > now) {
      return {
        hasAccess: true,
        status: "active" as const,
        daysLeft: planExpiresAt
          ? Math.ceil((planExpiresAt.getTime() - now.getTime()) / 86400000)
          : undefined,
        ...base,
      };
    }
    return { hasAccess: false, status: "expired" as const, reason: "Plan expired.", ...base, planStatus: "expired" };
  }

  if (user.plan_status === "trialing") {
    if (trialEndsAt && trialEndsAt > now) {
      return {
        hasAccess: true,
        status: "trial" as const,
        daysLeft: Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000),
        ...base,
      };
    }
    return { hasAccess: false, status: "expired" as const, reason: "Trial ended.", ...base, planStatus: "expired" };
  }

  if (user.plan_status === "canceled") {
    return { hasAccess: false, status: "canceled" as const, reason: "Plan canceled.", ...base };
  }

  return { hasAccess: false, status: "expired" as const, reason: "Access expired.", ...base };
}
