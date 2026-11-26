/**
 * SCHOOL Press — canonical vocabulary for the publishing surface.
 * One imprint over a single `work` object; written and visual works differ only
 * by `layout`. See docs/product/school-press.md.
 */

export type WorkKind = "paper" | "essay" | "literature" | "design" | "dataset_note" | "other";
export type WorkLayout = "written" | "gallery";
export type WorkStatus = "draft" | "published" | "curated" | "withdrawn";
export type WorkLicense =
  | "CC-BY-4.0"
  | "CC-BY-SA-4.0"
  | "CC-BY-NC-4.0"
  | "CC-BY-NC-SA-4.0"
  | "CC-BY-ND-4.0"
  | "CC0-1.0"
  | "all-rights-reserved";

export const WORK_KINDS: readonly WorkKind[] = [
  "paper",
  "essay",
  "literature",
  "design",
  "dataset_note",
  "other",
] as const;

export const WORK_LAYOUTS: readonly WorkLayout[] = ["written", "gallery"] as const;

export const WORK_LICENSES: readonly WorkLicense[] = [
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC-BY-NC-4.0",
  "CC-BY-NC-SA-4.0",
  "CC-BY-ND-4.0",
  "CC0-1.0",
  "all-rights-reserved",
] as const;

/** Human-facing license labels (store the identifier, render the label). */
export const LICENSE_LABELS: Record<WorkLicense, string> = {
  "CC-BY-4.0": "CC BY 4.0 — credit required",
  "CC-BY-SA-4.0": "CC BY-SA 4.0 — credit + share-alike",
  "CC-BY-NC-4.0": "CC BY-NC 4.0 — credit, non-commercial",
  "CC-BY-NC-SA-4.0": "CC BY-NC-SA 4.0 — credit, non-commercial, share-alike",
  "CC-BY-ND-4.0": "CC BY-ND 4.0 — credit, no derivatives",
  "CC0-1.0": "CC0 — public domain dedication",
  "all-rights-reserved": "All rights reserved",
};

/** Canonical URL for a license (for the work page + future DOI metadata). */
export const LICENSE_URLS: Record<WorkLicense, string | null> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC-BY-NC-4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
  "CC-BY-NC-SA-4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "CC-BY-ND-4.0": "https://creativecommons.org/licenses/by-nd/4.0/",
  "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "all-rights-reserved": null,
};

/** The house default — maximises reuse + citation while guaranteeing credit. */
export const DEFAULT_LICENSE: WorkLicense = "CC-BY-4.0";

export interface WorkAuthorInput {
  displayName: string;
  userId?: string | null;
  affiliation?: string | null;
}

export interface WorkReferenceInput {
  raw: string;
  doi?: string | null;
}

/** Payload to create or update a draft work. */
export interface WorkInput {
  kind: WorkKind;
  layout: WorkLayout;
  title: string;
  abstract?: string | null;
  bodyMd?: string | null;
  disciplineTags: string[];
  license: WorkLicense;
  authors: WorkAuthorInput[];
  references?: WorkReferenceInput[];
  coverUrl?: string | null;
  coverStorageKey?: string | null;
}

/** Payload to attach a new version (file or gallery images) to a work. */
export interface WorkVersionInput {
  fileUrl?: string | null;
  storageKey?: string | null;
  imageUrls?: string[];
  changelog?: string | null;
}
