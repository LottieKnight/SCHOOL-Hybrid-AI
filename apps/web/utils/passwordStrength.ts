import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

zxcvbnOptions.setOptions({
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
});

// zxcvbn scores 0–4; collapse to 4 display levels: 0–1 → Weak, 2 → Fair, 3 → Good, 4 → Strong
const SCORE_MAP = [0, 0, 1, 2, 3] as const;
const LABELS = ["Weak", "Fair", "Good", "Strong"] as const;
const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"] as const;

export interface StrengthResult {
  score: -1 | 0 | 1 | 2 | 3; // -1 (empty) or 0–3
  label: string;
  color: string;
}

export function getPasswordStrength(password: string): StrengthResult {
  if (!password) return { score: -1, label: "", color: "transparent" };
  const raw = zxcvbn(password);
  const score = SCORE_MAP[raw.score] ?? 0;
  return { score, label: LABELS[score], color: COLORS[score] };
}
