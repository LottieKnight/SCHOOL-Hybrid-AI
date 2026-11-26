export const XP_AWARD_CAPS = {
  POMODORO_COMPLETE: 25,
  QUIZ_COMPLETE: 50,
  GAME_COMPLETE: 30,
  QUEST_CLAIMED: 40,
} as const;

export type XpActionType = keyof typeof XP_AWARD_CAPS;

/** Client-supplied XP is capped. Unknown actions are rejected. */
export function resolveXpAward(actionType: unknown, amount: unknown) {
  if (typeof actionType !== "string" || !(actionType in XP_AWARD_CAPS)) {
    return { ok: false as const };
  }
  const cap = XP_AWARD_CAPS[actionType as XpActionType];
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { ok: false as const };
  }
  const requested = Math.floor(amount);
  if (requested <= 0) return { ok: false as const };
  return { ok: true as const, actionType, amount: Math.min(cap, requested) };
}
