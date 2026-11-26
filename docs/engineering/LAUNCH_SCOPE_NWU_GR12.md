# LAUNCH SCOPE — NWU 22-Module Corpus + Grade 12

**Owner:** PRODUCT / ENGINEERING
**Created:** 2026-09-14
**Status:** Documented — scope locked (decision log D2)
**Applies to:** SCHOOL (school.ditshego-ventures.co.za)

---

## 1. Launch Corpus

### 1.1 NWU — 22 curated modules

The launch targets **22 curated NWU modules**. Curriculum reference data already ships in
`apps/web/lib/generated/nwuAcademicCatalog.generated.json` (267 courses across faculties —
reference/browse data). A **curated 22-module set** is the lesson-content launch corpus.

Live module surfaces today (static + dynamic `[moduleCode]`):
- `econ211`, `ekip212`, `ekrp211`, `wves312` (static module dirs under `apps/web/app/university/modules/`)
- Dynamic `[moduleCode]` route resolves any catalog module from `generatedOutline.ts` / `learnV2.ts`
- `re1`, `re5`, `professional` learning-path pages under `apps/web/app/learn/`

### 1.2 Grade 12 outline

CAPS Grade R–12 learning surfaces exist; the launch outline is the **Grade 12 curriculum**
(dynamic grade-subject lookup endpoint + Grade 12 content). No generated per-grade
`lesson.json` corpus is bundled in-repo.

### 1.3 What is NOT in the launch scope

- UJ / UniZulu catalogs (ref data ships; not part of the 22-module launch corpus)
- Generated lesson-image / illustration backfill for every lesson
- Multi-language `lesson.<lang>.json` generated translations for the full corpus (i18n resolution is wired; generated translations are incremental)
- Institutional (SCIM/LTI/invoicing) enablement — separate enterprise track
- Marketplace/equipment procurement payments (quote-only until bookstore activation)

---

## 2. Gap — generated lesson corpus

| Item | Status |
|---|---|
| NWU catalog reference JSON | ✅ Present (267 courses) |
| Static module pages (econ211 / ekip212 / ekrp211 / wves312) | ✅ Present |
| Dynamic `[moduleCode]` resolution | ✅ Wired |
| Grade 12 outline endpoints + pages | ✅ Present |
| **Generated `lesson.json` corpus (22 modules)** | ❌ **Not present in-repo** — content lives via the generation pipeline (RAG / lesson generator) and DB; must be generated/fetched as part of launch prep |

**Decision log D2 (default applied 2026-09-14):** do **not** fabricate a generated corpus
in-repo to fake the scope. Launch-scope is documented; corpus generation is a stated
dependency, tracked in `SCHOOL_PRELAUNCH_50_PLAN.md` and the release gate.

---

## 3. Release Gate

The 22-module + Grade 12 outline scope is the **acceptance definition** for the corpus
portion of launch. Ship is complete when each of the 22 modules and the Grade 12 outline
resolve real lesson content from the pipeline (not placeholders) and pass the CI gate
(`.github/workflows/ci.yml`).