import { readFirestoreMinimalProfile, writeFirestoreMinimalProfile, type GoogleAccount } from "@/lib/firebaseGoogleAuth";
import {
  MINIMAL_PROFILE_EVENT,
  applyGoogleIdentity,
  mergeProfiles,
  readMinimalProfile,
  writeMinimalProfile,
  type MinimalProfile,
} from "@/lib/minimalProfile";
import { pushMinimalProfileToAccount } from "@/lib/minimalProfileSync";

export async function persistGoogleAccount(account: GoogleAccount, csrfToken?: string | null): Promise<MinimalProfile> {
  const local = typeof window === "undefined" ? null : readMinimalProfile(window.localStorage);
  const remote = await readFirestoreMinimalProfile();
  const next = applyGoogleIdentity(mergeProfiles(local, remote), account);
  const saved = typeof window === "undefined" ? next : writeMinimalProfile(window.localStorage, next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MINIMAL_PROFILE_EVENT));
  await Promise.all([
    pushMinimalProfileToAccount(saved, csrfToken ? { csrfToken } : null),
    writeFirestoreMinimalProfile(saved),
  ]);
  return saved;
}
