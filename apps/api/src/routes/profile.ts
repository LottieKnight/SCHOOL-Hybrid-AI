import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { findUserById } from "../db/users.js";
import { pool } from "../db/pool.js";
import {
  createAchievement,
  ensureProfile,
  findProfileByUsername,
  followUser,
  unfollowUser,
  getFollowCounts,
  getProfile,
  hasBlockedRelationship,
  listAchievements,
  listFollowSuggestions,
  listUserRelationships,
  removeUserRelationship,
  searchUsersByUsername,
  setUserRelationship,
  updateProfile,
  userAllowsFollowers,
} from "../db/profile.js";
import { getSchoolById } from "../db/schools.js";
import { createProductEvent } from "../db/product-events.js";
import {
  mergeAppPreferences,
  resolveOnboardingTransitionEvent,
} from "../lib/profile-preferences.js";
import { clearDashboardSummaryCache } from "../lib/dashboard-summary.js";
import {
  clearSocialDiscoveryCache,
  getSocialDiscoveryCacheEntry,
  setSocialDiscoveryCacheEntry,
} from "../lib/social-discovery-cache.js";

const avatarSchema = z.object({
  skinTone: z.string().min(3).max(32),
  hairStyle: z.string().min(3).max(20),
  hairColor: z.string().min(3).max(32),
  topColor: z.string().min(3).max(32),
  bottomColor: z.string().min(3).max(32),
  accentColor: z.string().min(3).max(32),
});

const appPreferencesSchema = z
  .object({
    // All 11 official SA text languages — must stay in sync with SaLanguageCode
    // in apps/web/lib/server/userProfileState.ts (SASL is visual, excluded).
    language: z
      .enum(["en", "zu", "xh", "af", "st", "tn", "nso", "ts", "ss", "ve", "nr"])
      .optional(),
    lessonDifficulty: z.enum(["easy", "balanced", "challenge"]).optional(),
    notifications: z
      .object({
        messaging: z.boolean().optional(),
        progress: z.boolean().optional(),
        reminders: z.boolean().optional(),
      })
      .optional(),
    reducedDataMode: z.boolean().optional(),
    personalisation: z
      .object({
        studyStyle: z.enum(["visual", "text", "mixed"]).optional(),
        bestStudyTime: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
        aiPersona: z.enum(["standard", "mzansi", "strict"]).optional(),
        weakestSubjects: z.array(z.string()).optional(),
      })
      .optional(),
    profileSettings: z
      .object({
        preferenceOnboardingStatus: z.enum(["pending", "completed", "declined"]).optional(),
        promptedAt: z.string().optional(),
        completedAt: z.string().optional(),
        declinedAt: z.string().optional(),
        discoverableInSuggestions: z.boolean().optional(),
        allowFollowers: z.boolean().optional(),
        allowSearch: z.boolean().optional(),
        allowMessages: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough()
  .optional();

const profileUpdateSchema = z.object({
  username: z.string().regex(/^[a-z0-9_]{3,20}$/).optional(),
  region: z.string().min(3).max(64).optional(),
  country: z.string().min(2).max(80).optional(),
  province: z.string().min(2).max(80).optional(),
  city: z.string().min(2).max(80).optional(),
  schoolId: z.string().uuid().optional(),
  liteMode: z.boolean().optional(),
  likes: z.array(z.string().min(1).max(40)).optional(),
  interests: z.array(z.string().min(1).max(40)).optional(),
  favoriteBook: z.string().min(1).max(120).optional(),
  favoriteMovie: z.string().min(1).max(120).optional(),
  avatarUniform: avatarSchema.optional(),
  avatarCasual: avatarSchema.optional(),
  appPreferences: appPreferencesSchema,
});

const achievementSchema = z.object({
  category: z.enum(["academic", "extracurricular"]),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  achievedOn: z.string().optional(),
});

const cursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).optional(),
  cursor: z.string().optional(),
});

const usernameSearchSchema = cursorQuerySchema.extend({
  username: z.string().trim().min(1).max(24),
});

const followUserSchema = z.object({
  userId: z.string().uuid(),
});

const relationshipBodySchema = z.object({
  userId: z.string().uuid(),
});

const relationshipParamSchema = z.object({
  userId: z.string().uuid(),
});

const relationshipListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

type CursorPayload = {
  offset: number;
};

function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset } satisfies CursorPayload), "utf8").toString(
    "base64url"
  );
}

function decodeCursor(value?: string) {
  if (!value) return { offset: 0 };
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (!Number.isFinite(parsed.offset) || parsed.offset < 0) {
      return null;
    }
    return { offset: Math.floor(parsed.offset) };
  } catch {
    return null;
  }
}

function invalidateDashboardForUsers(userIds: Array<string | null | undefined>) {
  const unique = new Set(userIds.filter((value): value is string => Boolean(value)));
  for (const userId of unique) {
    clearDashboardSummaryCache({ userId });
  }
}

function buildSuggestionsCacheKey(input: { userId: string; limit: number; offset: number }) {
  return `${input.userId}|suggestions|${input.limit}|${input.offset}`;
}

function buildUsernameSearchCacheKey(input: {
  userId: string;
  username: string;
  limit: number;
  offset: number;
}) {
  const normalizedUsername = input.username.trim().toLowerCase();
  return `${input.userId}|user-search|${normalizedUsername}|${input.limit}|${input.offset}`;
}

function invalidateSocialDiscovery() {
  clearSocialDiscoveryCache();
}

function computeProfileCompletion(input: {
  username: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  likes: string[];
  interests: string[];
  favoriteBook: string | null;
  favoriteMovie: string | null;
}) {
  const checklist = [
    { key: "username", done: Boolean(input.username?.trim()) },
    { key: "location", done: Boolean(input.country?.trim() && input.province?.trim() && input.city?.trim()) },
    { key: "likes", done: (input.likes?.length ?? 0) > 0 },
    { key: "interests", done: (input.interests?.length ?? 0) > 0 },
    { key: "favorites", done: Boolean(input.favoriteBook?.trim() || input.favoriteMovie?.trim()) },
  ];
  const completed = checklist.filter((item) => item.done).length;
  const percent = Math.round((completed / checklist.length) * 100);
  const missing = checklist.filter((item) => !item.done).map((item) => item.key);
  return { percent, missing };
}

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get("/profile/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await findUserById(request.user.sub);
    if (!user) {
      reply.code(401).send({ error: "Unauthorized" });
      return;
    }

    const baseName = user.email.split("@")[0];
    const profile = await ensureProfile(user.id, baseName);
    const stats = await getFollowCounts(user.id);
    const achievements = await listAchievements(user.id);
    const school = profile.school_id ? await getSchoolById(profile.school_id) : null;
    const completion = computeProfileCompletion({
      username: profile.username,
      country: profile.country,
      province: profile.province,
      city: profile.city,
      likes: profile.likes || [],
      interests: profile.interests || [],
      favoriteBook: profile.favorite_book,
      favoriteMovie: profile.favorite_movie,
    });

    reply.send({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
      },
      profile: {
        username: profile.username,
        region: profile.region,
        country: profile.country,
        province: profile.province,
        city: profile.city,
        schoolId: profile.school_id,
        schoolName: school?.name ?? null,
        liteMode: profile.lite_mode ?? false,
        likes: profile.likes,
        interests: profile.interests,
        favoriteBook: profile.favorite_book,
        favoriteMovie: profile.favorite_movie,
        appPreferences: profile.app_preferences ?? {},
        avatarUniform: profile.avatar_uniform,
        avatarCasual: profile.avatar_casual,
      },
      stats,
      achievements,
      completion,
    });
  });

  app.get(
    "/profile/users/:username",
    { preHandler: requireAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { username } = request.params as { username: string };
      if (!username || !/^[a-z0-9_]{1,20}$/.test(username.toLowerCase())) {
        reply.code(404).send({ error: "Profile not found." });
        return;
      }

      const profile = await findProfileByUsername(username.toLowerCase());
      if (!profile) {
        reply.code(404).send({ error: "Profile not found." });
        return;
      }

      const viewerId = request.user.sub;
      const isSelf = viewerId === profile.user_id;
      const profileSettings = (profile.app_preferences as Record<string, unknown>)?.profileSettings as
        | Record<string, unknown>
        | undefined;
      const allowSearch = (profileSettings?.allowSearch ?? "true") !== "false";
      const allowFollowers = (profileSettings?.allowFollowers ?? "true") !== "false";

      if (!isSelf && !allowSearch) {
        const isFollower = await pool
          .query("SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2", [viewerId, profile.user_id])
          .then((r) => (r.rowCount ?? 0) > 0)
          .catch(() => false);
        if (!isFollower) {
          reply.code(404).send({ error: "Profile not found." });
          return;
        }
      }

      const isBlocked = !isSelf && (await hasBlockedRelationship(viewerId, profile.user_id).catch(() => false));
      if (isBlocked) {
        reply.code(404).send({ error: "Profile not found." });
        return;
      }

      const [schoolResult, achievementsResult, gameScoresResult, followCountsResult] = await Promise.allSettled([
        profile.school_id ? getSchoolById(profile.school_id) : Promise.resolve(null),
        listAchievements(profile.user_id),
        pool.query<{ game_type: string; score: number; played_at: string }>(
          `SELECT DISTINCT ON (game_type) game_type, score, played_at
           FROM game_scores WHERE user_id = $1
           ORDER BY game_type, score DESC`,
          [profile.user_id]
        ),
        allowFollowers || isSelf ? getFollowCounts(profile.user_id) : Promise.resolve(null),
      ]);

      const school = schoolResult.status === "fulfilled" ? schoolResult.value : null;
      const achievements = achievementsResult.status === "fulfilled" ? achievementsResult.value.slice(0, 5) : [];
      const topGames =
        gameScoresResult.status === "fulfilled"
          ? gameScoresResult.value.rows.sort((a, b) => b.score - a.score).slice(0, 3)
          : [];
      const followCounts = followCountsResult.status === "fulfilled" ? followCountsResult.value : null;

      const viewerIsFollowing = isSelf
        ? false
        : await pool
            .query("SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2", [viewerId, profile.user_id])
            .then((r) => (r.rowCount ?? 0) > 0)
            .catch(() => false);

      const followsYou = !isSelf
        ? await pool
            .query("SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2", [profile.user_id, viewerId])
            .then((r) => (r.rowCount ?? 0) > 0)
            .catch(() => false)
        : false;

      const mutual = followsYou
        ? await pool
            .query<{ id: string; username: string | null; avatar_uniform: unknown }>(
              `SELECT u.id::text AS id, p.username, p.avatar_uniform
               FROM friends f
               JOIN users u ON u.id = f.friend_id
               LEFT JOIN user_profiles p ON p.user_id = u.id
               WHERE f.user_id = $1 AND EXISTS (
                 SELECT 1 FROM friends f2
                 WHERE f2.user_id = $2 AND f2.friend_id = f.friend_id
               )
               ORDER BY f.created_at DESC
               LIMIT 6`,
              [profile.user_id, viewerId]
            )
            .then((r) => r.rows)
            .catch(() => [])
        : [];

      reply.send({
        userId: profile.user_id,
        username: profile.username,
        city: profile.city,
        province: profile.province,
        country: profile.country,
        schoolName: school?.name ?? null,
        avatarUniform: profile.avatar_uniform,
        avatarCasual: profile.avatar_casual,
        interests: profile.interests ?? [],
        likes: profile.likes ?? [],
        achievements,
        topGames,
        followingCount: followCounts?.followingCount ?? null,
        followerCount: followCounts?.followersCount ?? null,
        isSelf,
        isFollowing: viewerIsFollowing,
        followsYou,
        mutualConnections: mutual,
        joinedAt: profile.created_at,
      });
    }
  );

  app.put("/profile/me", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const user = await findUserById(request.user.sub);
    if (!user) {
      reply.code(401).send({ error: "Unauthorized" });
      return;
    }

    let existing = await getProfile(user.id);
    if (!existing) {
      const baseName = user.email.split("@")[0];
      await ensureProfile(user.id, baseName);
      existing = await getProfile(user.id);
    }
    if (!existing) {
      reply.code(404).send({ error: "Profile not found" });
      return;
    }
    const wasLiteModeEnabled = existing.lite_mode === true;

    const updates: Record<string, unknown> = {};
    let onboardingEvent: "onboarding_completed" | "onboarding_declined" | null = null;
    if (parsed.data.username !== undefined) {
      // Public handle: normalise to a stable, URL-safe form (lowercase a-z0-9_)
      // so it matches the public lookup route and reads consistently everywhere.
      const value = parsed.data.username.trim().toLowerCase();
      if (value.length) {
        if (!/^[a-z0-9_]{3,20}$/.test(value)) {
          reply.code(400).send({ error: "Handle must be 3–20 characters using lowercase letters, numbers, or underscores." });
          return;
        }
        updates.username = value;
      } else {
        updates.username = null;
      }
    }
    if (parsed.data.region !== undefined) {
      const value = parsed.data.region.trim();
      updates.region = value.length ? value : null;
    }
    if (parsed.data.country !== undefined) {
      const value = parsed.data.country.trim();
      updates.country = value.length ? value : null;
    }
    if (parsed.data.province !== undefined) {
      const value = parsed.data.province.trim();
      updates.province = value.length ? value : null;
    }
    if (parsed.data.city !== undefined) {
      const value = parsed.data.city.trim();
      updates.city = value.length ? value : null;
    }
    if (parsed.data.schoolId !== undefined) {
      updates.school_id = parsed.data.schoolId;
    }
    if (parsed.data.liteMode !== undefined) {
      updates.lite_mode = parsed.data.liteMode;
    }
    if (parsed.data.likes !== undefined) updates.likes = parsed.data.likes;
    if (parsed.data.interests !== undefined) updates.interests = parsed.data.interests;
    if (parsed.data.favoriteBook !== undefined) {
      const value = parsed.data.favoriteBook.trim();
      updates.favorite_book = value.length ? value : null;
    }
    if (parsed.data.favoriteMovie !== undefined) {
      const value = parsed.data.favoriteMovie.trim();
      updates.favorite_movie = value.length ? value : null;
    }
    if (parsed.data.avatarUniform !== undefined) updates.avatar_uniform = parsed.data.avatarUniform;
    if (parsed.data.avatarCasual !== undefined) updates.avatar_casual = parsed.data.avatarCasual;
    if (parsed.data.appPreferences !== undefined) {
      const mergedPreferences = mergeAppPreferences(existing.app_preferences, parsed.data.appPreferences);
      updates.app_preferences = mergedPreferences;
      onboardingEvent = resolveOnboardingTransitionEvent(existing.app_preferences, mergedPreferences);
    }

    try {
      const profile = await updateProfile(user.id, updates);
      if (!profile) {
        reply.code(404).send({ error: "Profile not found" });
        return;
      }

      if (onboardingEvent) {
        void createProductEvent(request.user.sub, onboardingEvent, {
          source: "profile_update",
        }).catch(() => undefined);
      }
      if (parsed.data.liteMode === true && !wasLiteModeEnabled) {
        void createProductEvent(request.user.sub, "lite_mode_session", {
          source: "profile_update",
          route: "/settings",
          enabled: true,
        }).catch(() => undefined);
      }
      invalidateDashboardForUsers([request.user.sub]);
      invalidateSocialDiscovery();

      reply.send({
        profile: {
          username: profile.username,
          region: profile.region,
          country: profile.country,
          province: profile.province,
          city: profile.city,
          schoolId: profile.school_id,
          liteMode: profile.lite_mode ?? false,
          likes: profile.likes,
          interests: profile.interests,
          favoriteBook: profile.favorite_book,
          favoriteMovie: profile.favorite_movie,
          appPreferences: profile.app_preferences ?? {},
          avatarUniform: profile.avatar_uniform,
          avatarCasual: profile.avatar_casual,
        },
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === "23505") {
        reply.code(409).send({ error: "Username already taken" });
        return;
      }
      throw error;
    }
  });

  app.post("/profile/achievements", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = achievementSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const achievement = await createAchievement(request.user.sub, {
      category: parsed.data.category,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ?? null,
      achieved_on: parsed.data.achievedOn ?? null,
    });

    reply.code(201).send({ achievement });
  });

  app.get("/profile/following/suggestions", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = cursorQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const cursor = decodeCursor(parsed.data.cursor);
    if (!cursor) {
      reply.code(400).send({ error: "Invalid cursor" });
      return;
    }

    const limit = parsed.data.limit ?? 8;
    const cacheKey = buildSuggestionsCacheKey({
      userId: request.user.sub,
      limit,
      offset: cursor.offset,
    });
    const cached = getSocialDiscoveryCacheEntry<{
      suggestions: Awaited<ReturnType<typeof listFollowSuggestions>>;
      nextCursor: string | null;
      hasMore: boolean;
    }>(cacheKey);
    if (cached) {
      reply.header("X-Social-Discovery-Cache", "hit");
      reply.send(cached.payload);
      return;
    }

    const suggestions = await listFollowSuggestions(request.user.sub, {
      limit: limit + 1,
      offset: cursor.offset,
    });
    const hasMore = suggestions.length > limit;
    const items = hasMore ? suggestions.slice(0, limit) : suggestions;
    const nextCursor = hasMore ? encodeCursor(cursor.offset + limit) : null;
    const payload = {
      suggestions: items,
      nextCursor,
      hasMore,
    };
    setSocialDiscoveryCacheEntry(cacheKey, payload);
    reply.header("X-Social-Discovery-Cache", "miss");

    reply.send(payload);
  });

  app.post("/profile/following", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = followUserSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    if (parsed.data.userId === request.user.sub) {
      reply.code(400).send({ error: "You cannot follow yourself" });
      return;
    }

    const targetUser = await findUserById(parsed.data.userId);
    if (!targetUser) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    const blocked = await hasBlockedRelationship(request.user.sub, targetUser.id);
    if (blocked) {
      reply.code(403).send({ error: "Cannot follow this user." });
      return;
    }

    const allowsFollowers = await userAllowsFollowers(targetUser.id);
    if (!allowsFollowers) {
      reply.code(403).send({ error: "This user does not accept followers." });
      return;
    }

    await followUser(request.user.sub, targetUser.id);
    const stats = await getFollowCounts(request.user.sub);
    invalidateDashboardForUsers([request.user.sub, targetUser.id]);
    invalidateSocialDiscovery();
    void createProductEvent(request.user.sub, "follow", {
      targetUserId: targetUser.id,
    }).catch(() => undefined);

    const followerProfile = await getProfile(request.user.sub).catch(() => null);
    const followerUsername = followerProfile?.username ?? "Someone";
    await pool
      .query(
        `INSERT INTO user_notifications (user_id, title, message, link, type, is_read)
         VALUES ($1, 'New follower', $2, $3, 'follow', FALSE)`,
        [
          targetUser.id,
          `@${followerUsername} is now following you.`,
          `/profile/${encodeURIComponent(followerUsername)}`,
        ]
      )
      .catch(() => undefined);

    reply.send({ ok: true, stats });
  });

  app.delete("/profile/following/:userId", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = relationshipParamSchema.safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid user id." });
      return;
    }
    await unfollowUser(request.user.sub, parsed.data.userId);
    const stats = await getFollowCounts(request.user.sub);
    invalidateDashboardForUsers([request.user.sub, parsed.data.userId]);
    invalidateSocialDiscovery();
    reply.send({ ok: true, stats });
  });

  app.get(
    "/profile/users/search",
    { preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const parsed = usernameSearchSchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const cursor = decodeCursor(parsed.data.cursor);
    if (!cursor) {
      reply.code(400).send({ error: "Invalid cursor" });
      return;
    }

    const limit = parsed.data.limit ?? 8;
    const cacheKey = buildUsernameSearchCacheKey({
      userId: request.user.sub,
      username: parsed.data.username,
      limit,
      offset: cursor.offset,
    });
    const cached = getSocialDiscoveryCacheEntry<{
      users: Awaited<ReturnType<typeof searchUsersByUsername>>;
      nextCursor: string | null;
      hasMore: boolean;
    }>(cacheKey);
    if (cached) {
      reply.header("X-Social-Discovery-Cache", "hit");
      void createProductEvent(request.user.sub, "search", {
        queryLength: parsed.data.username.length,
        returnedCount: cached.payload.users.length,
        offset: cursor.offset,
      }).catch(() => undefined);
      reply.send(cached.payload);
      return;
    }

    const users = await searchUsersByUsername(request.user.sub, parsed.data.username, {
      limit: limit + 1,
      offset: cursor.offset,
    });
    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? encodeCursor(cursor.offset + limit) : null;
    const payload = {
      users: items,
      nextCursor,
      hasMore,
    };
    setSocialDiscoveryCacheEntry(cacheKey, payload);
    reply.header("X-Social-Discovery-Cache", "miss");

    void createProductEvent(request.user.sub, "search", {
      queryLength: parsed.data.username.length,
      returnedCount: items.length,
      offset: cursor.offset,
    }).catch(() => undefined);

    reply.send(payload);
  });

  app.post("/profile/users/block", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = relationshipBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    if (parsed.data.userId === request.user.sub) {
      reply.code(400).send({ error: "You cannot block yourself." });
      return;
    }

    const target = await findUserById(parsed.data.userId);
    if (!target) {
      reply.code(404).send({ error: "User not found." });
      return;
    }

    await setUserRelationship(request.user.sub, target.id, "blocked");
    const stats = await getFollowCounts(request.user.sub);
    invalidateDashboardForUsers([request.user.sub, target.id]);
    invalidateSocialDiscovery();
    reply.send({ ok: true, stats });
  });

  app.delete("/profile/users/block/:userId", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = relationshipParamSchema.safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid user id." });
      return;
    }
    await removeUserRelationship(request.user.sub, parsed.data.userId, "blocked");
    invalidateDashboardForUsers([request.user.sub, parsed.data.userId]);
    invalidateSocialDiscovery();
    reply.send({ ok: true });
  });

  app.post("/profile/users/mute", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = relationshipBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    if (parsed.data.userId === request.user.sub) {
      reply.code(400).send({ error: "You cannot mute yourself." });
      return;
    }

    const target = await findUserById(parsed.data.userId);
    if (!target) {
      reply.code(404).send({ error: "User not found." });
      return;
    }

    await setUserRelationship(request.user.sub, target.id, "muted");
    invalidateDashboardForUsers([request.user.sub, target.id]);
    invalidateSocialDiscovery();
    reply.send({ ok: true });
  });

  app.delete("/profile/users/mute/:userId", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = relationshipParamSchema.safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid user id." });
      return;
    }
    await removeUserRelationship(request.user.sub, parsed.data.userId, "muted");
    invalidateDashboardForUsers([request.user.sub, parsed.data.userId]);
    invalidateSocialDiscovery();
    reply.send({ ok: true });
  });

  app.get("/profile/users/relationships", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = relationshipListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const limit = parsed.data.limit ?? 40;
    const [blocked, muted] = await Promise.all([
      listUserRelationships(request.user.sub, "blocked", limit),
      listUserRelationships(request.user.sub, "muted", limit),
    ]);
    reply.send({ blocked, muted });
  });

  app.get("/profile/data-export", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user.sub;
    const user = await findUserById(userId);
    if (!user) {
      reply.code(404).send({ error: "User not found." });
      return;
    }

    const [profileResult, achievementsResult, walletResult, postsResult] = await Promise.allSettled([
      getProfile(userId),
      listAchievements(userId),
      pool.query(
        `SELECT amount_credits, type, reason, ref_type, created_at
         FROM wallet_ledger_entries WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 500`,
        [userId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, module_code, content, post_type, created_at
         FROM posts WHERE user_id = $1 AND is_hidden = FALSE
         ORDER BY created_at DESC LIMIT 500`,
        [userId]
      ).catch(() => ({ rows: [] })),
    ]);

    const rawProfile = profileResult.status === "fulfilled" ? profileResult.value : null;
    const safeProfile = rawProfile
      ? (() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { city, province, country, latitude, longitude, locationLat, locationLng, ...rest } =
            rawProfile as Record<string, unknown>;
          return { city, province, country, ...rest };
        })()
      : null;

    reply.header("Content-Disposition", `attachment; filename="school-data-export-${userId}.json"`);
    reply.send({
      exportedAt: new Date().toISOString(),
      userId,
      username: rawProfile ? (rawProfile as Record<string, unknown>).username : null,
      accountCreatedAt: user.created_at,
      profile: safeProfile,
      achievements: achievementsResult.status === "fulfilled" ? achievementsResult.value : [],
      walletHistory: walletResult.status === "fulfilled" ? (walletResult.value as { rows: unknown[] }).rows : [],
      communityPosts: postsResult.status === "fulfilled" ? (postsResult.value as { rows: unknown[] }).rows : [],
    });
  });

  // Paginated follower/following list for a given user
  const followListSchema = z.object({
    userId: z.string().uuid(),
    type: z.enum(["followers", "following"]),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  });

  app.get("/profile/follow-list", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = followListSchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const { userId, type, limit, offset } = parsed.data;
    const targetUser = await findUserById(userId);
    if (!targetUser) {
      reply.code(404).send({ error: "User not found." });
      return;
    }

    // Respect allowFollowers privacy setting
    const targetProfile = await getProfile(userId).catch(() => null);
    const settings = (targetProfile?.app_preferences as Record<string, unknown> | null)?.profileSettings as Record<string, unknown> | undefined;
    const allowFollowers = settings?.allowFollowers !== false;
    const viewerIsSelf = request.user.sub === userId;
    if (!allowFollowers && !viewerIsSelf) {
      reply.code(403).send({ error: "This user's follower list is private." });
      return;
    }

    // followers = people who follow userId (user_id = them, friend_id = userId)
    // following = people userId follows (user_id = userId, friend_id = them)
    const isFollowers = type === "followers";
    const rows = await pool.query<{
      id: string;
      username: string | null;
      avatar_uniform: unknown;
      school_name: string | null;
      is_following_back: boolean;
    }>(
       `SELECT
         u.id,
         p.username,
         p.avatar_uniform,
         s.name AS school_name,
         EXISTS(
           SELECT 1 FROM friends f2
           WHERE f2.user_id = $1 AND f2.friend_id = u.id
         ) AS is_following_back
       FROM friends f
       JOIN users u ON u.id = ${isFollowers ? "f.user_id" : "f.friend_id"}
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN schools s ON s.id = p.school_id
       WHERE ${isFollowers ? "f.friend_id" : "f.user_id"} = $2
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [request.user.sub, userId, limit, offset]
    );

    const total = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM friends WHERE ${isFollowers ? "friend_id" : "user_id"} = $1`,
      [userId]
    );

    reply.send({
      users: rows.rows,
      total: parseInt(total.rows[0]?.count ?? "0", 10),
      limit,
      offset,
    });
  });
}
