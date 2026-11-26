import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/server/cookieAuth";
import { findUserById, ensureProfile } from "@/lib/server/authDb";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FullProfileRow = {
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
};

function computeProfileCompletion(p: {
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
    { key: "username", done: Boolean(p.username?.trim()) },
    { key: "location", done: Boolean(p.country?.trim() && p.province?.trim() && p.city?.trim()) },
    { key: "likes", done: (p.likes?.length ?? 0) > 0 },
    { key: "interests", done: (p.interests?.length ?? 0) > 0 },
    { key: "favorites", done: Boolean(p.favoriteBook?.trim() || p.favoriteMovie?.trim()) },
  ];
  const completed = checklist.filter((c) => c.done).length;
  return {
    percent: Math.round((completed / checklist.length) * 100),
    missing: checklist.filter((c) => !c.done).map((c) => c.key),
  };
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserById(payload.sub);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { likes, interests, favoriteBook, favoriteMovie, appPreferences, username } = body as {
      likes?: unknown;
      interests?: unknown;
      favoriteBook?: unknown;
      favoriteMovie?: unknown;
      appPreferences?: unknown;
      username?: unknown;
    };

    const setClauses: string[] = [];
    const values: unknown[] = [user.id];
    let idx = 2;

    if (username !== undefined) {
      if (typeof username !== "string") {
        return NextResponse.json({ error: "Username must be a string" }, { status: 400 });
      }
      const normalized = username.trim().toLowerCase();
      if (normalized && !/^[a-z0-9_]{3,20}$/.test(normalized)) {
        return NextResponse.json(
          { error: "Username must be 3-20 characters: lowercase letters, numbers, or underscores." },
          { status: 400 }
        );
      }
      setClauses.push(`username = $${idx++}`);
      values.push(normalized || null);
    }

    if (Array.isArray(likes)) {
      setClauses.push(`likes = $${idx++}`);
      values.push(likes.filter((l): l is string => typeof l === "string").map((l) => l.slice(0, 40)));
    }
    if (Array.isArray(interests)) {
      setClauses.push(`interests = $${idx++}`);
      values.push(interests.filter((i): i is string => typeof i === "string").map((i) => i.slice(0, 40)));
    }
    if (typeof favoriteBook === "string") {
      setClauses.push(`favorite_book = $${idx++}`);
      values.push(favoriteBook.trim() || null);
    }
    if (typeof favoriteMovie === "string") {
      setClauses.push(`favorite_movie = $${idx++}`);
      values.push(favoriteMovie.trim() || null);
    }
    if (appPreferences !== undefined && typeof appPreferences === "object" && appPreferences !== null) {
      // Deep-merge at top level so callers that only send one key don't wipe others
      setClauses.push(`app_preferences = app_preferences || $${idx++}::jsonb`);
      values.push(JSON.stringify(appPreferences));
    }

    if (!setClauses.length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const result = await queryPlannerDb<FullProfileRow>(
      `UPDATE user_profiles SET ${setClauses.join(", ")} WHERE user_id = $1
       RETURNING user_id, username, region, country, province, city, school_id, lite_mode,
                 app_preferences, avatar_uniform, avatar_casual, likes, interests, favorite_book, favorite_movie`,
      values
    );

    const profile = result.rows[0];
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({
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
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That handle is already taken — try another." }, { status: 409 });
    }
    console.error("[profile/me PUT]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserById(payload.sub);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const baseName = user.email.split("@")[0];
    await ensureProfile(user.id, baseName);

    const profileResult = await queryPlannerDb<FullProfileRow>(
      `SELECT user_id, username, region, country, province, city, school_id, lite_mode,
              app_preferences, avatar_uniform, avatar_casual, likes, interests, favorite_book, favorite_movie
       FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );

    const profile = profileResult.rows[0];
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const [followingResult, followersResult, achievementsResult, schoolResult] = await Promise.all([
      queryPlannerDb<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM friends WHERE user_id = $1",
        [user.id]
      ),
      queryPlannerDb<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM friends WHERE friend_id = $1",
        [user.id]
      ),
      queryPlannerDb<{
        id: string;
        category: string;
        title: string;
        description: string | null;
        achieved_on: string | null;
        created_at: string;
      }>(
        `SELECT id, category, title, description, achieved_on, created_at
         FROM achievements WHERE user_id = $1
         ORDER BY achieved_on DESC NULLS LAST, created_at DESC`,
        [user.id]
      ),
      profile.school_id
        ? queryPlannerDb<{ name: string }>(
            "SELECT name FROM schools WHERE id = $1",
            [profile.school_id]
          )
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
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
        schoolName: schoolResult?.rows[0]?.name ?? null,
        liteMode: profile.lite_mode ?? false,
        likes: profile.likes,
        interests: profile.interests,
        favoriteBook: profile.favorite_book,
        favoriteMovie: profile.favorite_movie,
        appPreferences: profile.app_preferences ?? {},
        avatarUniform: profile.avatar_uniform,
        avatarCasual: profile.avatar_casual,
      },
      stats: {
        followingCount: Number(followingResult.rows[0]?.count ?? 0),
        followersCount: Number(followersResult.rows[0]?.count ?? 0),
      },
      achievements: achievementsResult.rows,
      completion: computeProfileCompletion({
        username: profile.username,
        country: profile.country,
        province: profile.province,
        city: profile.city,
        likes: profile.likes || [],
        interests: profile.interests || [],
        favoriteBook: profile.favorite_book,
        favoriteMovie: profile.favorite_movie,
      }),
    });
  } catch (error) {
    console.error("[profile/me]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
