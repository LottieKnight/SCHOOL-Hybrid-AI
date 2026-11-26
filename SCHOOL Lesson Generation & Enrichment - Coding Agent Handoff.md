# SCHOOL — School-Lesson Generation + Academic Enrichment (Coding Agent Hand-off)

> Self-contained brief. Every path below is real and was verified on this host on 2026-08-23.
> Do NOT invent lesson facts, prices, or sources. Ground all content in the SCHOOL
> curriculum scaffold / DBE CAPS, and all references in the verified academic list below.
> HARD RULE: **NO Wikipedia. Academically-recognised sources ONLY.**

---

## 0. OBJECTIVE
1. Generate SCHOOL school-lesson content (CAPS-aligned; start with the Foundation Phase
   Grade 3 Sepedi / Home-Language set whose folder shells already exist) into the repo in
   the schema-conforming layout.
2. Enrich every generated lesson with:
   - a **complete reference list** of *academically-recognised, non-Wikipedia* sources,
   - **teacher/lecturer notes**, and
   - **source hashes** (sha256 of each reference).
3. Validate conformance to `LessonSchema` and (if lessons are served from the DB) sync the
   enrichment into the database.

---

## 1. CURRENT STATE (read first — do not re-discover)
Repo root: `/home/lottie/projects/SCHOOL-Academic-Platform`

- **University modules — DONE & PUSHED.** 22 NWU module study-guides in
  `apps/web/content/modules-generated/*.generated.json` already carry `referenceList`,
  `teacherNotes`, `sourceHashes`, plus `wikipediaExcluded:true` / `academicReferenceOnly:true`
  (verified: 0 Wikipedia links). Reusable enricher:
  `scripts/enrich_references_teachernotes.py`. Do NOT clobber these.
- **School lessons — NOT GENERATED.** `content/lessons/grade-03/...` exists as EMPTY folder
  shells (only `term-01` subdirs, no `lesson.json`). Zero school lessons on disk. No PDFs
  ingested. Nothing to enrich until lessons exist.
- **Enrichment script for school lessons — READY.** `scripts/enrich_school_lessons.py`:
  - Attaches academic-only reference lists (DBE CAPS, DBE LTSM/workbooks, Thutong, Siyavula
    open textbooks, SARB, Stats SA, SAHO, OpenStax, IFRS, CFA — NO Wikipedia).
  - Injects `teacherNotes` derived ONLY from each lesson's own fields (summary, outcomes,
    explanation, activities) — no invented subject facts.
  - Sets `wikipediaExcluded`/`academicReferenceOnly`, computes `sourceHashes`.
  - **Skips** files that already have a module `discipline` (so it never overwrites the
    richer module references).
  - Auto-enriches any `content/lessons/**/lesson.json` the moment they appear. Run:
    `python3 scripts/enrich_school_lessons.py` (add `--dry` to preview).
- **CAPS scaffold — structure present, subjects empty.** `apps/web/content/caps_scaffold.json`
  has phases (foundation/intermediate/senior/fet) and grades but no subjects populated.
  Source manifest: `content/academic-source-manifest.seed.json` (DBE CAPS + NWU yearbook
  placeholders, `reviewStatus:"pending"`). Seed scripts: `packages/shared/scripts/build-caps-scaffold.ts`,
  `packages/shared/scripts/seedCurriculumFromScaffold.ts` (DB-backed).
- **DB is the blocker (see §3).**

---

## 2. TARGET SCHEMA (authoritative contract)
`packages/shared/src/lesson-content.ts` — `LessonSchema` (zod). Required top-level fields:
`grade` (int), `phase` (`foundation|intermediate|senior|fet`), `term` (1–4), `week` (1–53),
`subject` (str), `topic` (str), `summary` (str, min 1), `lessonOutline` (str[]),
`activities` (str[]), `assessment` (str[]), `resources` (obj[] with `title`+`sourcePdfPath`),
`extractedText` (str), `quiz` ({questions[]}). Optional but expected:
`title`, `outcomes`, `explanation`, `workedExamples`, `practice{easy,medium,hard}`,
`memo`, `teacherNotes` (str[]), `sourceHashes` (str[]).
Phase mapping: foundation R–3, intermediate 4–6, senior 7–9, FET 10–12.
Output layout: `content/lessons/<phase>/grade-<gg>/<subject>/term-<tt>/week-<ww>/lesson.json`
(grade as `grade-03`, term/week zero-padded `term-01`/`week-07`).

---

## 3. THE BLOCKER — DATABASE (resolve before generation)
`DATABASE_URL=postgres://saedu:***@localhost:5432/saedu`
- **No Postgres server is installed** (only the `psql` *client* is present; no `postgres`,
  `pg_ctl`, `initdb`, no data dir, nothing on :5432). Docker daemon is unusable here
  ("protocol not available"). So the DB-backed generation pipeline cannot run as-is.
- **Decisions the agent must make / confirm with the user:**
  1. **Bring up Postgres** (install `postgresql` server via apt + `initdb` + migrate), **or**
  2. **Point `DATABASE_URL` at a reachable remote** (Supabase / existing hosted Postgres),
     run `apps/api/migrations/*.sql` (note `072_university_lessons.sql`,
     `073_university_lessons_ci_index.sql`, `020_lesson_v2.sql`), **or**
  3. **Generate file-only** (write `lesson.json` to `content/lessons/...`, skip DB) — valid
     because the enrichment script works on files and the app can be pointed at the file
     tree. Acceptable for a first pass.
- The `school-caps` model exists at `models/school-caps/` (Mistral, 32 768 ctx). If you use
  it for generation, confirm it loads (transformers/pytorch availability) and run it
  file-only or behind a queue; do not assume the DB is up.

---

## 4. IMPLEMENTATION STEPS
1. **Resolve DB (§3).** Prefer option 3 (file-only) for a fast first deliverable; wire DB
   later. If DB chosen, run migrations and confirm `v2_lessons` / `university_lessons` exist.
2. **Populate the CAPS scaffold subjects** for the target grades (start Grade 3 Foundation
   Phase: Home Language / Sepedi, Mathematics, Life Skills) so the generation has structure.
   Use `build-caps-scaffold.ts` + `seedCurriculumFromScaffold.ts` (DB) or a file-based
   equivalent.
3. **Generate lessons** into `content/lessons/<phase>/grade-<gg>/<subject>/term-<tt>/week-<ww>/lesson.json`
   conforming to §2. Use the GDE/Gauteng lesson-plan structure already implied by the existing
   `content/lessons/grade-03/gde-lesson-plans-*` folder names as a style reference. Ground
   content in DBE CAPS outcomes — do not fabricate.
4. **Enrich (automatic):** `python3 scripts/enrich_school_lessons.py`. Confirm output shows
   each lesson with `refs=N teacherNotes=M WRITTEN` and `wikipediaExcluded:true`.
5. **Validate schema:** run the conformance checker
   (`scripts/validate_lessons.mjs --root content/lessons --schema packages/shared/dist/lesson-content.js`
   if present; otherwise a node script calling `LessonSchema.safeParse` per file). Fix any
   failures before reporting done.
6. **Sync to DB (only if serving from DB):** the app reads `university_lessons` /
   `v2_lessons`, NOT the JSON files. Either (a) ingest the enriched `lesson.json` into those
   tables, or (b) run the enrichment against the DB rows directly. Add `referenceList`,
   `teacherNotes`, `sourceHashes` columns/fields if not already present.

---

## 5. HARD CONSTRAINTS (do not violate)
- **NO Wikipedia. Ever.** References must be academically recognised: DBE (gov.za/education.gov.za),
  Thutong, Siyavula (open, peer-reviewed, CC-BY), SARB, Stats SA, SA History Online, OpenStax,
  IFRS/IASB, CFA Institute, Purdue OWL, official publisher pages. The `enrich_school_lessons.py`
  library already enforces this — extend it there, never inline a wiki link.
- **No fabricated lesson content.** Outcomes/definitions must trace to DBE CAPS or the module's
  own generated `chapterInsights`. Mark any placeholder clearly.
- **Do not break the 22 enriched module JSONs** or the two enrichment scripts. The school script
  already skips module files; keep it that way.
- **Premium / verified-only ethos** of SCHOOL applies: every cited figure must be traceable.

---

## 6. DEFINITION OF DONE
- School lessons exist in `content/lessons/...` conforming to `LessonSchema` (validated).
- Every lesson has `referenceList` (academic, no Wikipedia), `teacherNotes`, `sourceHashes`,
  `wikipediaExcluded:true`, `academicReferenceOnly:true`.
- `python3 scripts/enrich_school_lessons.py` runs clean; 0 Wikipedia links repo-wide.
- (If DB path) enrichment present in `university_lessons`/`v2_lessons` and surfaced by the API.
- A short commit message records the generation + enrichment; unrelated dirty files
  (e.g. `apps/web/app/learn/professional/page.tsx`, `docs/*`, `package.json`) are left alone.

---

## 7. QUICK-START FOR THE AGENT
1. Read `packages/shared/src/lesson-content.ts` (schema) and `scripts/enrich_school_lessons.py`
   (the academic source library + injection logic).
2. Resolve the DB blocker (§3) — recommend file-only first pass.
3. Generate `content/lessons/.../lesson.json` for Grade 3 Foundation Phase.
4. `python3 scripts/enrich_school_lessons.py` → verify refs/notes/hashes attached.
5. Validate against `LessonSchema`; fix failures.
6. Commit only the generated+enriched lesson files and any scaffold changes.
