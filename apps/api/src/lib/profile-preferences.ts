export type OnboardingStatus = "pending" | "completed" | "declined";

type MaybeRecord = Record<string, unknown> | null | undefined;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function mergeAppPreferences(existing: MaybeRecord, incoming: MaybeRecord) {
  const existingPreferences = asRecord(existing);
  const incomingPreferences = asRecord(incoming);

  const merged: Record<string, unknown> = {
    ...existingPreferences,
    ...incomingPreferences,
  };

  for (const branch of ["notifications", "profileSettings", "academics", "onboarding", "personalisation", "dailyQuiz"]) {
    if (branch in incomingPreferences) {
      merged[branch] = {
        ...asRecord(existingPreferences[branch]),
        ...asRecord(incomingPreferences[branch]),
      };
    }
  }

  return merged;
}

function readOnboardingStatusFromPreferences(preferences: MaybeRecord): OnboardingStatus | null {
  const value = asRecord(asRecord(preferences).profileSettings).preferenceOnboardingStatus;
  return value === "pending" || value === "completed" || value === "declined" ? value : null;
}

export function resolveOnboardingTransitionEvent(
  previousPreferences: MaybeRecord,
  nextPreferences: MaybeRecord
) {
  const previousStatus = readOnboardingStatusFromPreferences(previousPreferences);
  const nextStatus = readOnboardingStatusFromPreferences(nextPreferences);

  if (previousStatus === nextStatus) return null;
  if (nextStatus === "completed") return "onboarding_completed" as const;
  if (nextStatus === "declined") return "onboarding_declined" as const;
  return null;
}

export function getPrivacySettings(preferences: MaybeRecord) {
  const profileSettings = asRecord(asRecord(preferences).profileSettings);
  const discoverableInSuggestions = profileSettings.discoverableInSuggestions;
  const allowFollowers = profileSettings.allowFollowers;
  const allowSearch = profileSettings.allowSearch;
  const allowMessages = profileSettings.allowMessages;
  return {
    discoverableInSuggestions:
      typeof discoverableInSuggestions === "boolean" ? discoverableInSuggestions : true,
    allowFollowers: typeof allowFollowers === "boolean" ? allowFollowers : true,
    allowSearch: typeof allowSearch === "boolean" ? allowSearch : true,
    allowMessages: typeof allowMessages === "boolean" ? allowMessages : true,
  };
}
