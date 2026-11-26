import { getAuthToken } from "../auth/tokenStore";

const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://school.ditshego-ventures.co.za";

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

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export type XpRecentEvent = {
  label: string;
  xp: number;
};

export type XpSummary = {
  totalXp: number;
  level: number;
  progress: number;
  required: number;
  nextLevelXp: number;
  recentEvents: XpRecentEvent[];
};

export async function fetchXpSummary() {
  return webFetch<XpSummary>("/api/xp");
}
