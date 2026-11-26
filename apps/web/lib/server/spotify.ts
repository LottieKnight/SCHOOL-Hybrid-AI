import "server-only";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string;
  albumImageUrl: string | null;
};

const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com";
const SPOTIFY_API = "https://api.spotify.com/v1";

function getConfig() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
    redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? "",
  };
}

export function getSpotifyAuthUrl(state: string) {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: "user-read-private user-top-read playlist-read-private",
  });
  return `${SPOTIFY_ACCOUNTS}/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string): Promise<SpotifyTokens> {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function fetchSpotifyTopArtists(accessToken: string): Promise<SpotifyArtist[]> {
  const res = await fetch(`${SPOTIFY_API}/me/top/artists?limit=5`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    imageUrl: a.images?.[0]?.url ?? null,
    genres: a.genres?.slice(0, 2) ?? [],
  }));
}

export async function fetchSpotifyTopTracks(accessToken: string): Promise<SpotifyTrack[]> {
  const res = await fetch(`${SPOTIFY_API}/me/top/tracks?limit=5`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a: any) => a.name).join(", "),
    albumImageUrl: t.album.images?.[0]?.url ?? null,
  }));
}
