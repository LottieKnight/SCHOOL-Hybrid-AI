# SCHOOL Press — a publishing surface for scholarly and creative works

**Status:** design spec (not yet built)
**Owner:** Moloti Ditshego (Ditshego Ventures / AURA)
**Brand:** **SCHOOL Press** is the single imprint. It covers both written work
(papers, essays, literature) and visual work (artistic & design pieces). The
visual side renders as a **Gallery** *within* SCHOOL Press — one brand, two
render modes, not two sibling products.
**Relationship to other docs:** this is deliberately *separate* from
`docs/research/*` (the Observational Silence studies). **Research = ethics-bound
data collection. SCHOOL Press = published outputs.** Keeping the two brands apart
protects the credibility of the research programme (see §1).

---

## 1. Why this is a separate surface from "SCHOOL Research"

"SCHOOL Research" is being built to mean something a Research Ethics Committee
will respect: REC clearance, POPIA, pre-registration, the AURA studies. If
personal literature and design portfolios are filed under the same banner, the
word "research" stops being a credibility signal.

So we split the namespace:

| Surface | Contains | Credibility model |
|---|---|---|
| **SCHOOL Research** (`/research`, existing) | Ethics-bound studies, datasets, pre-registrations | REC + POPIA + OSF |
| **SCHOOL Press** (`/press`, new) | Papers, essays, literature **and** artistic/design work | Self-published → optionally curated |

SCHOOL Press is one imprint over **one data model** (a `work`). Written and visual
works share the same pipeline and differ only in how they render: written works
get an abstract-first/PDF layout, visual works get an image-first **Gallery**
layout (`/press/gallery`). "Gallery" is a *view*, not a separate backend or brand.

## 2. What we are NOT copying from academia.edu

The plumbing lessons are worth taking; the business model is not.

- **Never paywall a creator's own audience data.** Reader analytics (§7) are
  free to the author, always. This is academia.edu's most-resented choice.
- **Give works a citable, permanent identifier.** academia.edu does not mint
  DOIs; we do (via Zenodo/DataCite, §8). This is what makes Press *infrastructure*
  rather than a vanity feed.
- **No email spam, no SEO-farming.** Distribution is opt-in following + feed.
- **Licensing is explicit.** Every work carries a Creative Commons (or
  all-rights-reserved) license chosen by the author (§6).

## 3. Reuse, don't reinvent

The following already exist and back this feature directly:

| Need | Existing building block |
|---|---|
| Author identity & social graph | `/profile/[username]`, follower/following, `profile.ts` |
| File hosting (PDF, images) | `/api/files` |
| Discovery | `/api/feed`, `/api/search` |
| "Someone read your work" | notifications |
| Reader counts / geography | `/api/analytics`, Vercel analytics |
| Reward / gate | credits / wallet |
| Takedown & abuse | `docs/legal/COPYRIGHT_POLICY.md`, AUP |

The genuinely new thing is the **`work` object** and an author **bibliography**.

## 4. Data model (migration `083_publications.sql`)

> **Built (v1).** Migration `083` creates `works`, `work_versions`,
> `work_authors` and `work_references`. The `work_events` table below ships in
> **v2** (analytics, §7) — it is shown here for the full picture. The migration
> file is the source of truth; this block is illustrative. File references use the
> codebase convention (`*_url TEXT` + optional `storage_key`, `image_urls TEXT[]`
> for galleries) — there is no central `files` table to FK against.

Postgres, following the `082` conventions (snake_case, `gen_random_uuid()`,
`user_id ON DELETE SET NULL` where authorship should survive account deletion as
a pseudonymous credit only if the author opted in — otherwise CASCADE).

```sql
-- A published work: paper, essay, literary piece, or visual/design portfolio.
CREATE TABLE works (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN
                    ('paper','essay','literature','design','dataset_note','other')),
  layout          text NOT NULL DEFAULT 'written' CHECK (layout IN ('written','gallery')),
  title           text NOT NULL,
  slug            text NOT NULL UNIQUE,
  abstract        text,                 -- or artist's statement for gallery works
  body_md         text,                 -- optional inline content (essays, poems)
  discipline_tags text[] NOT NULL DEFAULT '{}',
  license         text NOT NULL DEFAULT 'CC-BY-4.0' CHECK (license IN
                    ('CC-BY-4.0','CC-BY-SA-4.0','CC-BY-NC-4.0','CC-BY-NC-SA-4.0',
                     'CC-BY-ND-4.0','CC0-1.0','all-rights-reserved')),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN
                    ('draft','published','curated','withdrawn')),
  doi             text UNIQUE,          -- minted on publish if author opts in (§8)
  cover_url       text,                 -- *_url TEXT convention (no central files table)
  cover_storage_key text,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Versioning: a work can have many versions; the DOI resolves to the latest.
CREATE TABLE work_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id       uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  version       integer NOT NULL,
  file_url      text,                   -- the PDF / primary asset
  storage_key   text,
  image_urls    text[] NOT NULL DEFAULT '{}',  -- gallery works (one or many images)
  changelog     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, version)
);

-- Co-authors / collaborators (ordered; not all need SCHOOL accounts).
CREATE TABLE work_authors (
  work_id      uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL,           -- always stored, so external co-authors render
  affiliation  text,
  ord          integer NOT NULL DEFAULT 0,
  PRIMARY KEY (work_id, ord)
);

-- Free-text references the author cites (citation graph v1 — no resolver yet).
CREATE TABLE work_references (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id   uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  raw       text NOT NULL,              -- the reference as typed
  doi       text,                       -- optional, if known
  ord       integer NOT NULL DEFAULT 0
);

-- One row per read/download/view event → powers author analytics (§7).
-- Pseudonymous: store coarse geo + hashed viewer, never raw IP.
CREATE TABLE work_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id       uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  event_type    text NOT NULL CHECK (event_type IN ('view','read','download','cite_click')),
  viewer_hash   text,                   -- hash(user_id|session), for unique counts
  country       text,                   -- coarse geo only
  referrer      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX works_author_idx       ON works(author_id, status);
CREATE INDEX works_layout_idx       ON works(layout, status, published_at DESC);
CREATE INDEX works_tags_idx         ON works USING gin (discipline_tags);
CREATE INDEX work_events_work_idx   ON work_events(work_id, created_at);
```

## 5. Shared types (`packages/shared/src/press/works.ts`)

Mirror the `research/` module: canonical enums + input interfaces, exported from
`@saedu/shared`.

```ts
export type WorkKind = "paper" | "essay" | "literature" | "design" | "dataset_note" | "other";
export type WorkLayout = "written" | "gallery";
export type WorkStatus = "draft" | "published" | "curated" | "withdrawn";
export type WorkLicense =
  | "CC-BY-4.0" | "CC-BY-SA-4.0" | "CC-BY-NC-4.0" | "CC-BY-NC-SA-4.0"
  | "CC-BY-ND-4.0" | "CC0-1.0" | "all-rights-reserved";

export interface WorkInput {
  kind: WorkKind;
  layout: WorkLayout;
  title: string;
  abstract?: string;
  bodyMd?: string;
  disciplineTags: string[];
  license: WorkLicense;
  authors: { displayName: string; userId?: string; affiliation?: string }[];
  references?: { raw: string; doi?: string }[];
}

export const LICENSE_LABELS: Record<WorkLicense, string> = {
  "CC-BY-4.0": "CC BY 4.0 — credit required",
  "CC-BY-SA-4.0": "CC BY-SA 4.0 — credit + share-alike",
  "CC-BY-NC-4.0": "CC BY-NC 4.0 — credit, non-commercial",
  "CC-BY-NC-SA-4.0": "CC BY-NC-SA 4.0 — credit, non-commercial, share-alike",
  "CC-BY-ND-4.0": "CC BY-ND 4.0 — credit, no derivatives",
  "CC0-1.0": "CC0 — public domain dedication",
  "all-rights-reserved": "All rights reserved",
};
```

## 6. Licensing (the credibility decision)

- The author **must** pick a license at publish time; default highlight is
  **CC BY 4.0** (maximises reuse + citation while guaranteeing credit).
- The license is rendered on the work page and embedded in any DOI metadata.
- "All rights reserved" is allowed but de-emphasised — open is the house style.
- Store the SPDX-style identifier (the `CHECK` list), render the human label.

## 7. Author analytics (free, always)

The retention engine — and the thing academia.edu charges for. Build it as a
read model over `work_events`:

- **Per work:** total reads, unique readers, downloads, reads-over-time sparkline,
  top countries, top referrers.
- **Per author (dashboard):** total reads across all works, trend, "3 new readers
  from Kenya this week" notification hooks.
- **Privacy:** never expose individual readers; counts and coarse geo only.
  `viewer_hash` is for de-duplication, never displayed or reversible.

## 8. Citable identifiers (DOI via Zenodo/DataCite) — optional per work

What separates Press from a vanity feed.

- On publish, offer **"Mint a DOI"**. If accepted, push the work + metadata to
  **Zenodo** (free DataCite DOIs) and store the returned `doi`.
- The DOI resolves to the latest `work_version`; new versions get a versioned DOI
  under the same concept DOI (Zenodo handles this).
- Embed DOI + license + authors as schema.org `ScholarlyArticle` /
  `CreativeWork` JSON-LD on the page for Google Scholar indexing.
- Phase this — v1 can ship without DOIs and add the integration once Press has
  works worth preserving.

## 9. API (`apps/api/src/routes/press.ts`, Fastify, cookie JWT like `research.ts`)

```
POST   /press/works                      create a draft work
PUT    /press/works/:id                  update draft (title, abstract, tags, license, authors, refs)
POST   /press/works/:id/versions         upload a new version (file_id from /api/files)
POST   /press/works/:id/publish          draft → published (+ optional DOI mint)
POST   /press/works/:id/withdraw         published → withdrawn (keeps DOI tombstone)
GET    /press/works/:slug                public read (fires a 'view' work_event)
POST   /press/works/:slug/download       returns file + fires 'download' work_event
GET    /press/authors/:username/works    an author's bibliography
GET    /press/feed                       discovery feed (by follows + tags)
GET    /press/works/:id/analytics        author-only analytics (owner check)
GET    /admin/press/moderation           curation/abuse queue
```

Zod validation per route; reuse the `research.ts` auth + ownership patterns.

## 10. Surfaces (Next.js app router)

```
/press                      SCHOOL Press home — recent + followed authors' works
/press/[slug]               a single work (written: body_md/PDF; gallery: image-first)
/press/gallery              the visual view — grid of works with layout='gallery'
/profile/[username]         + a "Publications" tab listing the bibliography
/press/new                  authoring flow (kind, layout, files, license, authors, refs)
/press/dashboard            the author's works + analytics
```

- All of this is **one brand, SCHOOL Press.** `/press/gallery` is the same `work`
  data filtered to `layout='gallery'`, rendered image-first (no abstract above the
  fold). A single work page (`/press/[slug]`) chooses its layout from the `layout`
  column. Reuse the Observatory-grade design tokens already in `globals.css`.
- The **profile "Publications" tab** is the academia.edu-style "body of work"
  view — this is what turns a person into an author.

## 11. Moderation, copyright, minors

- Every work passes through the existing **AUP / Copyright Policy**; add a
  takedown path in the admin moderation queue.
- **Minors:** gate publishing behind the existing `is_minor` / guardian-consent
  check before a work can leave `draft`.
- **Plagiarism / AI-content:** out of scope for v1; flag as a curation concern.

## 12. Phased rollout

1. **v1 — Self-publish + bibliography.** `works` + `work_versions` +
   `work_authors`, authoring flow, public work pages, profile Publications tab,
   CC licensing. No analytics, no DOI. *Ships the loop: upload → public page → on
   your profile.*
2. **v2 — Author analytics.** `work_events` + per-work and dashboard analytics +
   "new readers" notifications. *The retention engine.*
3. **v3 — Citable + discoverable.** Zenodo DOI minting, schema.org JSON-LD,
   references, tag/author discovery feed. *Press becomes infrastructure.*
4. **v4 — Curation tier.** `status='curated'`, an editorial review path → a
   credible "SCHOOL Press" imprint distinct from raw self-publishing.

## 13. The one-line verdict

SCHOOL already owns the hard, boring 65% (identity, files, feed, search,
analytics, notifications). This spec adds the missing 35% — a `work` object, an
author bibliography, free reader analytics, and citable licensing — and keeps it
**off the "Research" brand** so the ethics-bound studies stay credible. v1 is an
afternoon of schema and a week of UI; the moat is licensing + DOIs, which is
exactly the line academia.edu refused to cross.
