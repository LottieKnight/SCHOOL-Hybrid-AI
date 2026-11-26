import { randomUUID } from "node:crypto";
import { pool } from "./pool.js";

export type ProfileRecord = {
  user_id: string;
  username: string | null;
  region: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  school_id: string | null;
  lite_mode: boolean;
  app_preferences: Record<string, unknown>;
  avatar_uniform: Record<string, unknown>;
  avatar_casual: Record<string, unknown>;
  likes: string[];
  interests: string[];
  favorite_book: string | null;
  favorite_movie: string | null;
  created_at: string;
  updated_at: string;
};

export type AchievementRecord = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string | null;
  achieved_on: string | null;
  created_at: string;
};

export type FollowSuggestionRecord = {
  user_id: string;
  username: string | null;
  name: string;
  relevance_score: number;
  reason_label: string;
  same_school: boolean;
  same_city: boolean;
  same_province: boolean;
  same_country: boolean;
  shared_likes: number;
  shared_interests: number;
  shared_subjects: number;
  mutual_follows: number;
  recent_interactions: number;
  already_following: boolean;
};

export type UsernameSearchRecord = {
  user_id: string;
  username: string | null;
  name: string;
  school_name: string | null;
  already_following: boolean;
};

export type RelationshipType = "blocked" | "muted";

export type UserRelationshipRecord = {
  user_id: string;
  username: string | null;
  name: string;
  relationship_type: RelationshipType;
  created_at: string;
};

const DEFAULT_AVATAR = {
  skinTone: "#d9a98f",
  hairStyle: "short",
  hairColor: "#4a3128",
  topColor: "#2d3b6f",
  bottomColor: "#2f2f2f",
  accentColor: "#f5c04f",
};

const MAX_SOCIAL_RESULT_LIMIT = 12;
const DEFAULT_SUGGESTION_LIMIT = 8;
const DEFAULT_USERNAME_SEARCH_LIMIT = 8;

function normalizeSocialLimit(limit: number | undefined, fallback: number) {
  if (!Number.isFinite(limit) || !limit || limit < 1) return fallback;
  return Math.min(Math.floor(limit), MAX_SOCIAL_RESULT_LIMIT);
}

function normalizeOffset(offset: number | undefined) {
  if (!Number.isFinite(offset) || !offset || offset < 0) return 0;
  return Math.floor(offset);
}

function sanitizeUsername(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return normalized || "student";
}

export async function findProfileByUsername(username: string) {
  const result = await pool.query<ProfileRecord>(
    "SELECT user_id, username, region, country, province, city, school_id, lite_mode, app_preferences, avatar_uniform, avatar_casual, likes, interests, favorite_book, favorite_movie, created_at, updated_at FROM user_profiles WHERE username = $1",
    [username]
  );
  return result.rows[0] ?? null;
}

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const result = await pool.query<ProfileRecord>(
    "SELECT user_id, username, region, country, province, city, school_id, lite_mode, app_preferences, avatar_uniform, avatar_casual, likes, interests, favorite_book, favorite_movie, created_at, updated_at FROM user_profiles WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function ensureProfile(userId: string, baseUsername: string) {
  const existing = await getProfile(userId);
  if (existing) return existing;

  const base = sanitizeUsername(baseUsername);
  let username = base;

  const insertProfile = async (candidate: string) => {
    try {
      const result = await pool.query<ProfileRecord>(
        "INSERT INTO user_profiles (user_id, username, avatar_uniform, avatar_casual) VALUES ($1, $2, $3, $4) RETURNING user_id, username, region, country, province, city, school_id, lite_mode, app_preferences, avatar_uniform, avatar_casual, likes, interests, favorite_book, favorite_movie, created_at, updated_at",
        [userId, candidate, DEFAULT_AVATAR, DEFAULT_AVATAR]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        return null;
      }
      throw error;
    }
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const created = await insertProfile(username);
    if (created) return created;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    username = `${base}${suffix}`;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    username = `${base}${randomUUID().slice(0, 8)}`;
    const created = await insertProfile(username);
    if (created) return created;
  }

  throw new Error("Unable to create a unique profile username.");
}

export async function updateProfile(userId: string, updates: Partial<ProfileRecord>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  const mapping: Record<string, string> = {
    username: "username",
    region: "region",
    country: "country",
    province: "province",
    city: "city",
    school_id: "school_id",
    lite_mode: "lite_mode",
    avatar_uniform: "avatar_uniform",
    avatar_casual: "avatar_casual",
    likes: "likes",
    interests: "interests",
    favorite_book: "favorite_book",
    favorite_movie: "favorite_movie",
    app_preferences: "app_preferences",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (updates[key as keyof ProfileRecord] !== undefined) {
      fields.push(`${column} = $${index}`);
      values.push(updates[key as keyof ProfileRecord]);
      index += 1;
    }
  }

  if (!fields.length) return getProfile(userId);

  fields.push("updated_at = NOW()");
  values.push(userId);
  const result = await pool.query<ProfileRecord>(
    `UPDATE user_profiles SET ${fields.join(", ")} WHERE user_id = $${index} RETURNING user_id, username, region, country, province, city, school_id, lite_mode, app_preferences, avatar_uniform, avatar_casual, likes, interests, favorite_book, favorite_movie, created_at, updated_at`,
    values
  );
  return result.rows[0] ?? null;
}

export async function listAchievements(userId: string) {
  const result = await pool.query<AchievementRecord>(
    `SELECT id, user_id, category, title, description, achieved_on, created_at
     FROM achievements
     WHERE user_id = $1
     ORDER BY achieved_on DESC NULLS LAST, created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function createAchievement(
  userId: string,
  data: Pick<AchievementRecord, "category" | "title" | "description" | "achieved_on">
) {
  const result = await pool.query<AchievementRecord>(
    `INSERT INTO achievements (user_id, category, title, description, achieved_on)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, category, title, description, achieved_on, created_at`,
    [userId, data.category, data.title, data.description, data.achieved_on]
  );
  return result.rows[0];
}

export async function getFollowCounts(userId: string) {
  const followingResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM friends WHERE user_id = $1",
    [userId]
  );
  const followersResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM friends WHERE friend_id = $1",
    [userId]
  );
  return {
    followingCount: Number(followingResult.rows[0]?.count ?? 0),
    followersCount: Number(followersResult.rows[0]?.count ?? 0),
  };
}

export async function hasBlockedRelationship(userAId: string, userBId: string) {
  const result = await pool.query(
    `SELECT 1
     FROM user_relationships
     WHERE relationship_type = 'blocked'
       AND (
         (user_id = $1 AND target_user_id = $2)
         OR
         (user_id = $2 AND target_user_id = $1)
       )
     LIMIT 1`,
    [userAId, userBId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function userAllowsFollowers(userId: string) {
  const result = await pool.query<{ allows_followers: boolean }>(
    `SELECT
       COALESCE(app_preferences->'profileSettings'->>'allowFollowers', 'true') <> 'false'
         AS allows_followers
     FROM user_profiles
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.allows_followers ?? true;
}

export async function userAllowsMessages(userId: string) {
  const result = await pool.query<{ allows_messages: boolean }>(
    `SELECT
       COALESCE(app_preferences->'profileSettings'->>'allowMessages', 'true') <> 'false'
         AS allows_messages
     FROM user_profiles
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.allows_messages ?? true;
}

export async function userAllowsSearch(userId: string) {
  const result = await pool.query<{ allows_search: boolean }>(
    `SELECT
       COALESCE(app_preferences->'profileSettings'->>'allowSearch', 'true') <> 'false'
         AS allows_search
     FROM user_profiles
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.allows_search ?? true;
}

export async function listFollowSuggestions(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const limit = normalizeSocialLimit(options.limit, DEFAULT_SUGGESTION_LIMIT);
  const offset = normalizeOffset(options.offset);

  const result = await pool.query<FollowSuggestionRecord>(
    `WITH self_profile AS (
       SELECT school_id, city, province, country, likes, interests
       FROM user_profiles
       WHERE user_id = $1
     ),
     candidate_metrics AS (
       SELECT
         u.id AS user_id,
         up.username,
         COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), up.username, 'Student') AS name,
         COALESCE(
           (
             SELECT COUNT(*)::int
             FROM unnest(COALESCE(up.likes, '{}'::text[])) candidate_like
             WHERE candidate_like = ANY(COALESCE(sp.likes, '{}'::text[]))
           ),
           0
         ) AS shared_likes,
         COALESCE(
           (
             SELECT COUNT(*)::int
             FROM unnest(COALESCE(up.interests, '{}'::text[])) candidate_interest
             WHERE candidate_interest = ANY(COALESCE(sp.interests, '{}'::text[]))
           ),
           0
         ) AS shared_interests,
         COALESCE(
           (
             SELECT COUNT(*)::int
             FROM (
               SELECT DISTINCT qa.subject, qa.grade
               FROM quiz_attempts_v2 qa
               WHERE qa.learner_id = $1
             ) self_quiz
             JOIN (
               SELECT DISTINCT qa.subject, qa.grade
               FROM quiz_attempts_v2 qa
               WHERE qa.learner_id = u.id
             ) candidate_quiz
               ON candidate_quiz.subject = self_quiz.subject
              AND candidate_quiz.grade = self_quiz.grade
           ),
           0
         ) AS shared_subjects,
         COALESCE(sp.school_id IS NOT NULL AND up.school_id = sp.school_id, false) AS same_school,
         COALESCE(sp.city IS NOT NULL AND up.city = sp.city, false) AS same_city,
         COALESCE(sp.province IS NOT NULL AND up.province = sp.province, false) AS same_province,
         COALESCE(sp.country IS NOT NULL AND up.country = sp.country, false) AS same_country,
         COALESCE(
           (
             SELECT COUNT(*)::int
             FROM friends my_following
             JOIN friends candidate_following
               ON candidate_following.user_id = u.id
              AND candidate_following.friend_id = my_following.friend_id
             WHERE my_following.user_id = $1
           ),
           0
         ) AS mutual_follows,
         COALESCE(
           (
             SELECT COUNT(*)::int
             FROM conversations c
             JOIN conversation_participants cp_self
               ON cp_self.conversation_id = c.id
              AND cp_self.user_id = $1
             JOIN conversation_participants cp_other
               ON cp_other.conversation_id = c.id
              AND cp_other.user_id = u.id
             JOIN messages m ON m.conversation_id = c.id
             WHERE c.type = 'direct'
               AND m.created_at >= NOW() - INTERVAL '30 days'
           ),
           0
         ) AS recent_interactions
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN self_profile sp ON true
       WHERE u.id <> $1
         AND NOT EXISTS (
           SELECT 1
           FROM friends f
           WHERE f.user_id = $1
             AND f.friend_id = u.id
         )
         AND COALESCE(up.app_preferences->'profileSettings'->>'discoverableInSuggestions', 'true') <> 'false'
         AND COALESCE(up.app_preferences->'profileSettings'->>'allowFollowers', 'true') <> 'false'
         AND COALESCE(up.app_preferences->'profileSettings'->>'allowSearch', 'true') <> 'false'
         AND NOT EXISTS (
           SELECT 1
           FROM user_relationships rel
           WHERE rel.relationship_type = 'blocked'
             AND (
               (rel.user_id = $1 AND rel.target_user_id = u.id)
               OR
               (rel.user_id = u.id AND rel.target_user_id = $1)
             )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM user_relationships rel
           WHERE rel.relationship_type = 'muted'
             AND rel.user_id = $1
             AND rel.target_user_id = u.id
         )
     )
     SELECT
       user_id,
       username,
       name,
       (
         (CASE WHEN same_school THEN 80 ELSE 0 END)
         + (CASE WHEN same_city THEN 30 ELSE 0 END)
         + (CASE WHEN same_province THEN 20 ELSE 0 END)
         + (CASE WHEN same_country THEN 10 ELSE 0 END)
         + (shared_likes * 6)
         + (shared_interests * 5)
         + (shared_subjects * 7)
         + (mutual_follows * 8)
         + (recent_interactions * 4)
       )::int AS relevance_score,
       CASE
         WHEN same_school THEN 'Same school'
         WHEN mutual_follows > 0 THEN CONCAT(mutual_follows::text, ' mutual follow', CASE WHEN mutual_follows = 1 THEN '' ELSE 's' END)
         WHEN shared_subjects > 0 THEN CONCAT(shared_subjects::text, ' shared subject pattern', CASE WHEN shared_subjects = 1 THEN '' ELSE 's' END)
         WHEN shared_interests > 0 THEN CONCAT(shared_interests::text, ' shared interest', CASE WHEN shared_interests = 1 THEN '' ELSE 's' END)
         WHEN recent_interactions > 0 THEN CONCAT(recent_interactions::text, ' recent interaction', CASE WHEN recent_interactions = 1 THEN '' ELSE 's' END)
         ELSE 'Recommended for discovery'
       END AS reason_label,
       same_school,
       same_city,
       same_province,
       same_country,
       shared_likes,
       shared_interests,
       shared_subjects,
       mutual_follows,
       recent_interactions,
       false AS already_following
     FROM candidate_metrics
     ORDER BY relevance_score DESC, username NULLS LAST, name ASC, user_id ASC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

export async function searchUsersByUsername(
  userId: string,
  usernameQuery: string,
  options: { limit?: number; offset?: number } = {}
) {
  const normalizedQuery = usernameQuery.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const limit = normalizeSocialLimit(options.limit, DEFAULT_USERNAME_SEARCH_LIMIT);
  const offset = normalizeOffset(options.offset);
  const containsPattern = `%${normalizedQuery}%`;
  const prefixPattern = `${normalizedQuery}%`;

  const result = await pool.query<UsernameSearchRecord>(
    `SELECT
       u.id AS user_id,
       up.username,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), up.username, 'Student') AS name,
       s.name AS school_name,
       EXISTS (
         SELECT 1
         FROM friends f
         WHERE f.user_id = $1
           AND f.friend_id = u.id
       ) AS already_following
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN schools s ON s.id = up.school_id
     WHERE u.id <> $1
       AND up.username IS NOT NULL
       AND (
         LOWER(up.username) LIKE $2
         OR LOWER(COALESCE(u.first_name, '')) LIKE $2
         OR LOWER(COALESCE(u.last_name, '')) LIKE $2
         OR LOWER(COALESCE(s.name, '')) LIKE $2
       )
       AND COALESCE(up.app_preferences->'profileSettings'->>'discoverableInSuggestions', 'true') <> 'false'
       AND COALESCE(up.app_preferences->'profileSettings'->>'allowSearch', 'true') <> 'false'
       AND NOT EXISTS (
         SELECT 1
         FROM user_relationships rel
         WHERE rel.relationship_type = 'blocked'
           AND (
             (rel.user_id = $1 AND rel.target_user_id = u.id)
             OR
             (rel.user_id = u.id AND rel.target_user_id = $1)
           )
       )
       AND NOT EXISTS (
         SELECT 1
         FROM user_relationships rel
         WHERE rel.relationship_type = 'muted'
           AND rel.user_id = $1
           AND rel.target_user_id = u.id
       )
     ORDER BY
       CASE
         WHEN LOWER(up.username) = $3 THEN 0
         WHEN LOWER(up.username) LIKE $4 THEN 1
         WHEN LOWER(COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), up.username)) LIKE $4 THEN 1
         ELSE 2
       END,
       similarity(LOWER(up.username), $3) DESC,
       LENGTH(up.username),
       up.username,
       u.id
     LIMIT $5 OFFSET $6`,
    [userId, containsPattern, normalizedQuery, prefixPattern, limit, offset]
  );
  return result.rows;
}

export async function followUser(userId: string, targetUserId: string) {
  await pool.query(
    "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [userId, targetUserId]
  );
}

export async function unfollowUser(userId: string, targetUserId: string) {
  await pool.query("DELETE FROM friends WHERE user_id = $1 AND friend_id = $2", [userId, targetUserId]);
}

export async function setUserRelationship(
  userId: string,
  targetUserId: string,
  relationshipType: RelationshipType
) {
  await pool.query(
    `INSERT INTO user_relationships (user_id, target_user_id, relationship_type, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, target_user_id, relationship_type)
     DO UPDATE SET updated_at = NOW()`,
    [userId, targetUserId, relationshipType]
  );

  if (relationshipType === "blocked") {
    await pool.query("DELETE FROM friends WHERE user_id = $1 AND friend_id = $2", [userId, targetUserId]);
    await pool.query("DELETE FROM friends WHERE user_id = $1 AND friend_id = $2", [targetUserId, userId]);
  }
}

export async function removeUserRelationship(
  userId: string,
  targetUserId: string,
  relationshipType: RelationshipType
) {
  await pool.query(
    `DELETE FROM user_relationships
     WHERE user_id = $1
       AND target_user_id = $2
       AND relationship_type = $3`,
    [userId, targetUserId, relationshipType]
  );
}

export async function listUserRelationships(
  userId: string,
  relationshipType: RelationshipType,
  limit = 40
) {
  const normalizedLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const result = await pool.query<UserRelationshipRecord>(
    `SELECT
       rel.target_user_id AS user_id,
       up.username,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), up.username, 'Student') AS name,
       rel.relationship_type,
       rel.created_at
     FROM user_relationships rel
     JOIN users u ON u.id = rel.target_user_id
     LEFT JOIN user_profiles up ON up.user_id = rel.target_user_id
     WHERE rel.user_id = $1
       AND rel.relationship_type = $2
     ORDER BY rel.created_at DESC
     LIMIT $3`,
    [userId, relationshipType, normalizedLimit]
  );
  return result.rows;
}
