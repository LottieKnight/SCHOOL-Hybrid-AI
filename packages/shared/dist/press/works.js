/**
 * SCHOOL Press — canonical vocabulary for the publishing surface.
 * One imprint over a single `work` object; written and visual works differ only
 * by `layout`. See docs/product/school-press.md.
 */
export const WORK_KINDS = [
    "paper",
    "essay",
    "literature",
    "design",
    "dataset_note",
    "other",
];
export const WORK_LAYOUTS = ["written", "gallery"];
export const WORK_LICENSES = [
    "CC-BY-4.0",
    "CC-BY-SA-4.0",
    "CC-BY-NC-4.0",
    "CC-BY-NC-SA-4.0",
    "CC-BY-ND-4.0",
    "CC0-1.0",
    "all-rights-reserved",
];
/** Human-facing license labels (store the identifier, render the label). */
export const LICENSE_LABELS = {
    "CC-BY-4.0": "CC BY 4.0 — credit required",
    "CC-BY-SA-4.0": "CC BY-SA 4.0 — credit + share-alike",
    "CC-BY-NC-4.0": "CC BY-NC 4.0 — credit, non-commercial",
    "CC-BY-NC-SA-4.0": "CC BY-NC-SA 4.0 — credit, non-commercial, share-alike",
    "CC-BY-ND-4.0": "CC BY-ND 4.0 — credit, no derivatives",
    "CC0-1.0": "CC0 — public domain dedication",
    "all-rights-reserved": "All rights reserved",
};
/** Canonical URL for a license (for the work page + future DOI metadata). */
export const LICENSE_URLS = {
    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
    "CC-BY-NC-4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
    "CC-BY-NC-SA-4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "CC-BY-ND-4.0": "https://creativecommons.org/licenses/by-nd/4.0/",
    "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "all-rights-reserved": null,
};
/** The house default — maximises reuse + citation while guaranteeing credit. */
export const DEFAULT_LICENSE = "CC-BY-4.0";
