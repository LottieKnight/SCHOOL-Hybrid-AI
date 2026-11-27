import { API_BASE } from "@/lib/apiBase";
import {
  mergeProfiles,
  profileForAccountSync,
  readMinimalProfile,
  readMinimalProfileFromPreferences,
  writeMinimalProfile,
  type MinimalProfile,
  type ProfileStorage,
} from "@/lib/minimalProfile";

type SessionLike = { csrfToken?: string | null } | null | undefined;

export async function pushMinimalProfileToAccount(profile: MinimalProfile, session: SessionLike) {
  if (!session?.csrfToken) return false;
  try {
    const response = await fetch(`${API_BASE}/profile/me`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": session.csrfToken,
      },
      body: JSON.stringify(profileForAccountSync(profile)),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pullAccountMinimalProfile(session: SessionLike) {
  if (!session?.csrfToken) return null;
  try {
    const response = await fetch(`${API_BASE}/profile/me`, { credentials: "include" });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => null)) as { profile?: { appPreferences?: unknown } } | null;
    return readMinimalProfileFromPreferences(data?.profile?.appPreferences);
  } catch {
    return null;
  }
}

export async function reconcileMinimalProfile(storage: ProfileStorage, session: SessionLike) {
  const local = readMinimalProfile(storage);
  const remote = await pullAccountMinimalProfile(session);
  const merged = mergeProfiles(local, remote);
  if (!merged) return null;
  const saved = writeMinimalProfile(storage, merged);
  if (!remote || saved.updatedAt > remote.updatedAt) {
    await pushMinimalProfileToAccount(saved, session);
  }
  return saved;
}
