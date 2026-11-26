import { apiClient } from "./client";
import { getAuthToken } from "../auth/tokenStore";

const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://school.ditshego-ventures.co.za";

export type Achievement = {
  id: string;
  type: string;
  label: string;
  awardedAt: string;
};

export type ProfileMe = {
  user: { id: string; email: string; firstName: string; lastName: string; createdAt: string };
  profile: {
    username: string | null;
    country: string | null;
    province: string | null;
    city: string | null;
    schoolName: string | null;
    liteMode: boolean;
    appPreferences: Record<string, unknown>;
  };
  stats: { followingCount: number; followersCount: number };
  achievements: Achievement[];
  completion: number;
};

export async function fetchProfileMe() {
  const response = await apiClient.get<ProfileMe>("/profile/me");
  return response.data;
}

export type LocaleOption = {
  code: string;
  label: string;
};

export type ProfileUpdatePayload = {
  appPreferences?: {
    language?: string;
    personalisation?: {
      aiPersona?: "standard" | "mzansi" | "strict";
    };
  };
};

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
  return response.json() as Promise<T>;
}

export async function fetchLocaleOptions() {
  return webFetch<{ locales: LocaleOption[] }>("/api/locale");
}

export async function updateProfileMe(payload: ProfileUpdatePayload) {
  const response = await apiClient.put<ProfileMe & { profile: ProfileMe["profile"] }>("/profile/me", payload);
  return response.data;
}
