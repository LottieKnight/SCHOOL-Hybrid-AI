/**
 * Client-safe constants for the Bursary Finder.
 *
 * Self-contained by design — like apps/web/lib/press/constants.ts, this module
 * must NOT import from `@saedu/shared` (its barrel pulls server-only Node modules
 * into the browser bundle). The vocabulary here mirrors the bursaries migrations
 * and apps/api/src/routes/bursaries.ts; keep the three in sync.
 */

export type YearLevel = "school" | "1" | "2" | "3" | "4" | "postgrad";
export type ProviderType = "nsfas" | "seta" | "corporate" | "ngo" | "government" | "other";
export type SortBy = "match" | "deadline";

// Field-of-study tokens. Must stay a superset of the tokens used in migration 084
// (the seed) and apps/api/src/lib/bursaryVocab.ts. Picking a field returns
// bursaries scoped to it plus any open to all fields. Some tokens (Law,
// Humanities, Social Sciences) are offered ahead of seeded coverage — selecting
// them gracefully surfaces the open-to-all bursaries until field-specific ones
// are added.
export const FIELD_OPTIONS: readonly string[] = [
  "Engineering",
  "Information Technology",
  "Commerce & Management",
  "Accounting & Finance",
  "Natural Sciences",
  "Health Sciences",
  "Medicine",
  "Education",
  "Law",
  "Humanities",
  "Social Sciences",
  "Agriculture",
  "Built Environment",
] as const;

export const YEAR_OPTIONS: readonly { value: YearLevel; label: string }[] = [
  { value: "school", label: "Still in school (Grade 8–12)" },
  { value: "1", label: "1st year" },
  { value: "2", label: "2nd year" },
  { value: "3", label: "3rd year" },
  { value: "4", label: "4th year" },
  { value: "postgrad", label: "Postgraduate / Honours+" },
] as const;

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  nsfas: "NSFAS",
  seta: "SETA",
  corporate: "Corporate",
  ngo: "NGO / Trust",
  government: "Government",
  other: "Other",
};

export const YEAR_LABELS: Record<YearLevel, string> = {
  school: "School",
  "1": "1st year",
  "2": "2nd year",
  "3": "3rd year",
  "4": "4th year",
  postgrad: "Postgraduate",
};
