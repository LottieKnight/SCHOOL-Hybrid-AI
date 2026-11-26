export type SplashContext = {
  reducedMotion: boolean;
  saveData: boolean;
  effectiveType: string;
  liteMode: boolean;
  alreadySeenThisSession: boolean;
};

/** First paint should not wait on a branded animation when data or motion is constrained. */
export function shouldSkipSplash(input: SplashContext) {
  if (input.alreadySeenThisSession || input.reducedMotion || input.saveData || input.liteMode) return true;
  const type = input.effectiveType.toLowerCase();
  return type === "slow-2g" || type === "2g";
}

/** Autoplay is off. A chord only plays when the learner opted in. */
export function shouldPlaySplashSound(soundPreference: string | null) {
  return soundPreference === "on";
}
