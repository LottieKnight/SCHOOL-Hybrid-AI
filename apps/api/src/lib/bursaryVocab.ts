/**
 * Canonical bursary vocabulary — the single API-side source of truth shared by
 * the public matcher route and the admin write routes. Keeping admin writes and
 * the finder's filters on the same tokens is the load-bearing invariant of the
 * feature: an off-vocabulary field/year token would persist silently and then be
 * invisible to anyone filtering by that (correctly spelled) value.
 *
 * The web filter UI mirrors these in apps/web/lib/bursary/constants.ts — it can't
 * import from here (the @saedu/shared / server-module bundle rule), so the two
 * lists are kept in sync by hand. Update both together.
 */

export const YEAR_LEVELS = ["school", "1", "2", "3", "4", "postgrad"] as const;
export const PROVIDER_TYPES = ["nsfas", "seta", "corporate", "ngo", "government", "other"] as const;
export const FIELDS = [
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

export type YearLevel = (typeof YEAR_LEVELS)[number];
export type ProviderType = (typeof PROVIDER_TYPES)[number];
export type FieldOfStudy = (typeof FIELDS)[number];
