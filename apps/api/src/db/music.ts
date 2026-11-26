import { pool } from "./pool.js";

export type MusicProfileRecord = {
  user_id: string;
  genres: string[];
  artists: string[];
  playlist_url: string | null;
  playlist_title: string | null;
  vibe_tags: string[];
  visibility: "public" | "campus" | "private";
  updated_at: string;
};

export type MusicDiscoveryRecord = {
  user_id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  avatar_uniform: Record<string, unknown> | null;
  school_name: string | null;
  genres: string[];
  artists: string[];
  playlist_url: string | null;
  playlist_title: string | null;
  vibe_tags: string[];
  overlap_count: number | null;
};

export type MusicProfileInput = {
  genres: string[];
  artists: string[];
  playlist_url: string | null;
  playlist_title: string | null;
  vibe_tags: string[];
  visibility: "public" | "campus" | "private";
};

export type DiscoverParams = {
  userId: string;
  schoolId: string | null;
  userGenres: string[];
  match: "similar" | "different";
  limit: number;
  offset: number;
};

export async function getMusicProfile(userId: string): Promise<MusicProfileRecord | null> {
  const result = await pool.query<MusicProfileRecord>(
    `SELECT user_id, genres, artists, playlist_url, playlist_title, vibe_tags, visibility, updated_at
     FROM student_music_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function upsertMusicProfile(
  userId: string,
  data: MusicProfileInput
): Promise<MusicProfileRecord> {
  const result = await pool.query<MusicProfileRecord>(
    `INSERT INTO student_music_profiles
       (user_id, genres, artists, playlist_url, playlist_title, vibe_tags, visibility, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       genres        = EXCLUDED.genres,
       artists       = EXCLUDED.artists,
       playlist_url  = EXCLUDED.playlist_url,
       playlist_title = EXCLUDED.playlist_title,
       vibe_tags     = EXCLUDED.vibe_tags,
       visibility    = EXCLUDED.visibility,
       updated_at    = NOW()
     RETURNING user_id, genres, artists, playlist_url, playlist_title, vibe_tags, visibility, updated_at`,
    [userId, data.genres, data.artists, data.playlist_url, data.playlist_title, data.vibe_tags, data.visibility]
  );
  if (!result.rows[0]) throw new Error("upsert did not return a row");
  return result.rows[0];
}

export async function discoverMusicProfiles(
  params: DiscoverParams
): Promise<MusicDiscoveryRecord[]> {
  const { userId, schoolId, userGenres, match, limit, offset } = params;

  if (match === "similar") {
    const result = await pool.query<MusicDiscoveryRecord>(
      `SELECT
         smp.user_id,
         up.username,
         u.first_name,
         u.last_name,
         up.avatar_uniform,
         s.name AS school_name,
         smp.genres,
         smp.artists,
         smp.playlist_url,
         smp.playlist_title,
         smp.vibe_tags,
         -- count matching genres via array intersection
         array_length(
           ARRAY(SELECT unnest(smp.genres) INTERSECT SELECT unnest($3::text[])),
           1
         ) AS overlap_count
       FROM student_music_profiles smp
       JOIN user_profiles up ON up.user_id = smp.user_id
       JOIN users u ON u.id = smp.user_id
       LEFT JOIN schools s ON s.id = up.school_id
       WHERE smp.genres && $3::text[]
         AND smp.user_id != $1
         AND (
           smp.visibility = 'public'
           OR (smp.visibility = 'campus' AND up.school_id = $2)
         )
       ORDER BY overlap_count DESC, smp.updated_at DESC
       LIMIT $4 OFFSET $5`,
      [userId, schoolId, userGenres, limit, offset]
    );
    return result.rows;
  }

  // different: zero genre overlap, randomised
  const result = await pool.query<MusicDiscoveryRecord>(
    `SELECT
       smp.user_id,
       up.username,
       u.first_name,
       u.last_name,
       up.avatar_uniform,
       s.name AS school_name,
       smp.genres,
       smp.artists,
       smp.playlist_url,
       smp.playlist_title,
       smp.vibe_tags,
       NULL::int AS overlap_count
     FROM student_music_profiles smp
     JOIN user_profiles up ON up.user_id = smp.user_id
     JOIN users u ON u.id = smp.user_id
     LEFT JOIN schools s ON s.id = up.school_id
     WHERE NOT (smp.genres && $3::text[])
       AND smp.user_id != $1
       AND (
         smp.visibility = 'public'
         OR (smp.visibility = 'campus' AND up.school_id = $2)
       )
     ORDER BY random()
     LIMIT $4 OFFSET $5`,
    [userId, schoolId, userGenres, limit, offset]
  );
  return result.rows;
}
