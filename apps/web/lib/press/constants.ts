/**
 * Client-safe Press constants + types for the web bundle.
 *
 * IMPORTANT: this module must NOT reference `@saedu/shared` in any form — not
 * even `import type` / `export type ... from`. The shared barrel re-exports
 * server-only modules (pg, node:fs), and the bundler pulls the whole graph into
 * the browser chunk even for type-only re-exports. So the Press types are
 * declared locally here; they mirror `packages/shared/src/press/works.ts`, which
 * stays the single source of truth on the server side.
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

export interface WorkAuthorInput {
  displayName: string;
  userId?: string | null;
  affiliation?: string | null;
}

export interface WorkReferenceInput {
  raw: string;
  doi?: string | null;
}

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

export interface WorkVersionInput {
  fileUrl?: string | null;
  storageKey?: string | null;
  imageUrls?: string[];
  changelog?: string | null;
}

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

export const LICENSE_LABELS: Record<WorkLicense, string> = {
  "CC-BY-4.0": "CC BY 4.0 — credit required",
  "CC-BY-SA-4.0": "CC BY-SA 4.0 — credit + share-alike",
  "CC-BY-NC-4.0": "CC BY-NC 4.0 — credit, non-commercial",
  "CC-BY-NC-SA-4.0": "CC BY-NC-SA 4.0 — credit, non-commercial, share-alike",
  "CC-BY-ND-4.0": "CC BY-ND 4.0 — credit, no derivatives",
  "CC0-1.0": "CC0 — public domain dedication",
  "all-rights-reserved": "All rights reserved",
};

export const LICENSE_URLS: Record<WorkLicense, string | null> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC-BY-NC-4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
  "CC-BY-NC-SA-4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "CC-BY-ND-4.0": "https://creativecommons.org/licenses/by-nd/4.0/",
  "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "all-rights-reserved": null,
};

export const DEFAULT_LICENSE: WorkLicense = "CC-BY-4.0";
