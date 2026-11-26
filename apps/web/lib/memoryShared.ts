export type MemoryBand = "Needs Review" | "Developing" | "Confident";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "explain",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "show",
  "so",
  "tell",
  "that",
  "the",
  "this",
  "to",
  "understand",
  "what",
  "why",
  "with",
]);

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordTokens(value: string) {
  return normalizeSearchText(value)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOPWORDS.has(part));
}

export function buildFallbackConceptSlug(value: string) {
  const tokens = Array.from(new Set(keywordTokens(value))).slice(0, 3);
  if (tokens.length === 0) return null;
  return tokens.join("-");
}

export function getMasteryBand(score: number): MemoryBand {
  if (score < 0.3) return "Needs Review";
  if (score < 0.65) return "Developing";
  return "Confident";
}

export function scoreMemoryRelevance(input: {
  strugglingMatches: number;
  recentMatches: number;
  openedButNotCompleted: boolean;
  moduleMatch: boolean;
}) {
  let score = 0;
  if (input.strugglingMatches > 0) score += 0.4;
  if (input.recentMatches > 0) score += 0.2;
  if (input.openedButNotCompleted) score += 0.15;
  if (input.moduleMatch) score += 0.1;
  return Number(score.toFixed(2));
}
