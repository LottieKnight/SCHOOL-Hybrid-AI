import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import {
  getMusicProfile,
  upsertMusicProfile,
  discoverMusicProfiles,
} from "../db/music.js";

const MAX_GENRES = 5;
const MAX_ARTISTS = 10;
const MAX_ARTIST_LENGTH = 60;
const MAX_PLAYLIST_TITLE_LENGTH = 80;
const MAX_DISCOVER_LIMIT = 20;
const DEFAULT_DISCOVER_LIMIT = 12;

const musicProfileInputSchema = z.object({
  genres: z.array(z.string().max(60)).max(MAX_GENRES),
  artists: z.array(z.string().max(MAX_ARTIST_LENGTH)).max(MAX_ARTISTS),
  playlist_url: z
    .string()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://") || u.startsWith("http://"), {
      message: "playlist_url must use http or https",
    })
    .nullable(),
  playlist_title: z.string().max(MAX_PLAYLIST_TITLE_LENGTH).nullable(),
  vibe_tags: z.array(z.string().max(40)).max(10),
  visibility: z.enum(["public", "campus", "private"]),
});

export async function registerMusicRoutes(app: FastifyInstance) {
  // Get own music profile
  app.get("/profile/music/me", { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getMusicProfile(request.user.sub);
    if (!profile) {
      reply.code(404).send({ error: "no_music_profile" });
      return;
    }
    reply.send(profile);
  });

  // Upsert own music profile
  app.put("/profile/music/me", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = musicProfileInputSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_input", details: parsed.error.issues });
      return;
    }
    try {
      const updated = await upsertMusicProfile(request.user.sub, parsed.data);
      reply.send(updated);
    } catch {
      reply.code(500).send({ error: "save_failed" });
    }
  });

  // Get another user's music profile (visibility enforced)
  app.get(
    "/profile/music/:userId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };

      try {
        // Fetch requester's school_id for campus visibility check
        const viewerResult = await pool.query<{ school_id: string | null }>(
          "SELECT school_id FROM user_profiles WHERE user_id = $1",
          [request.user.sub]
        );
        const viewerSchoolId = viewerResult.rows[0]?.school_id ?? null;

        const profile = await getMusicProfile(userId);
        if (!profile) {
          reply.code(404).send({ error: "no_music_profile" });
          return;
        }

        if (profile.visibility === "private" && userId !== request.user.sub) {
          reply.code(403).send({ error: "private_profile" });
          return;
        }

        if (profile.visibility === "campus" && userId !== request.user.sub) {
          const ownerResult = await pool.query<{ school_id: string | null }>(
            "SELECT school_id FROM user_profiles WHERE user_id = $1",
            [userId]
          );
          const ownerSchoolId = ownerResult.rows[0]?.school_id ?? null;
          if (!ownerSchoolId || ownerSchoolId !== viewerSchoolId) {
            reply.code(403).send({ error: "campus_only" });
            return;
          }
        }

        reply.send(profile);
      } catch {
        reply.code(500).send({ error: "profile_fetch_failed" });
      }
    }
  );

  // Discovery feed
  app.get(
    "/community/music/discover",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const match = query.match === "different" ? "different" : "similar";
      const limit = Math.min(
        parseInt(query.limit ?? String(DEFAULT_DISCOVER_LIMIT), 10) || DEFAULT_DISCOVER_LIMIT,
        MAX_DISCOVER_LIMIT
      );
      const offset = Math.max(0, parseInt(query.offset ?? "0", 10) || 0);

      try {
        // Get current user's music profile + school_id
        const [musicProfile, profileResult] = await Promise.all([
          getMusicProfile(request.user.sub),
          pool.query<{ school_id: string | null }>(
            "SELECT school_id FROM user_profiles WHERE user_id = $1",
            [request.user.sub]
          ),
        ]);

        if (!musicProfile || musicProfile.genres.length === 0) {
          reply.code(400).send({ error: "complete_your_music_profile" });
          return;
        }

        const schoolId = profileResult.rows[0]?.school_id ?? null;

        const results = await discoverMusicProfiles({
          userId: request.user.sub,
          schoolId,
          userGenres: musicProfile.genres,
          match,
          limit,
          offset,
        });

        reply.send({ results, match, limit, offset });
      } catch {
        reply.code(500).send({ error: "discovery_failed" });
      }
    }
  );
}
