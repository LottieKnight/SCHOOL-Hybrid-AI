import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const result = await queryPlannerDb<{ top_artists: any; top_tracks: any }>(
      `SELECT top_artists, top_tracks FROM user_spotify_connections WHERE user_id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      topArtists: result.rows[0].top_artists,
      topTracks: result.rows[0].top_tracks,
    });
  } catch (error) {
    console.error("Failed to fetch Spotify data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
