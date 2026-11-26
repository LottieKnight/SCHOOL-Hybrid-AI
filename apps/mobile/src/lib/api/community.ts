import { getAuthToken } from "../auth/tokenStore";

const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://school.ditshego-ventures.co.za";
const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://school-api-production-2ff7.up.railway.app";

async function webFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${webBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<T>;
}

export type CommunityPost = {
  id: string;
  authorName: string;
  authorRole: string;
  moduleCode: string;
  content: string;
  postType: "general" | "question" | "resource" | "announcement" | "poll";
  createdAt: string;
  commentCount: number;
  isAnonymous: boolean;
  reactionCounts: Record<string, number>;
};

export type LeaderboardEntry = {
  userId: string;
  username: string | null;
  displayName: string;
  score: number;
  rank: number;
};

export type CommunityStreak = { current: number; longest: number };

export async function fetchCommunityPosts(filter = "recent") {
  try {
    const data = await webFetch<{ posts: CommunityPost[] }>(
      `/api/community/questions?filter=${filter}&limit=20`
    );
    return data.posts ?? [];
  } catch {
    return [] as CommunityPost[];
  }
}

export async function fetchLeaderboard() {
  try {
    const data = await webFetch<{ entries: LeaderboardEntry[] }>("/api/community/leaderboard");
    return data.entries ?? [];
  } catch {
    return [] as LeaderboardEntry[];
  }
}

export async function fetchCommunityStreak() {
  try {
    return await webFetch<CommunityStreak>("/api/community/streak");
  } catch {
    return { current: 0, longest: 0 } as CommunityStreak;
  }
}

export async function createPost(params: {
  moduleCode: string;
  content: string;
  postType?: string;
  isAnonymous?: boolean;
}) {
  return webFetch<{ post: CommunityPost }>("/api/community/posts", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type MusicDiscoveryRecord = {
  user_id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  school_name: string | null;
  genres: string[];
  artists: string[];
  playlist_url: string | null;
  playlist_title: string | null;
  vibe_tags: string[];
  overlap_count: number | null;
};

export type MusicDiscoveryResponse = {
  results: MusicDiscoveryRecord[];
  match: string;
  limit: number;
  offset: number;
};

export async function fetchMusicDiscovery(
  match: "similar" | "different",
  offset = 0,
  limit = 12,
): Promise<MusicDiscoveryResponse> {
  const token = await getAuthToken();
  const url = `${apiBase}/community/music/discover?match=${match}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? String(res.status));
  }
  return res.json() as Promise<MusicDiscoveryResponse>;
}
