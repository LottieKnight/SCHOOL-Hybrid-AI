# GEMINI CONTINUATION PROMPT

Use this prompt if you need Gemini to continue the SCHOOL language-layer work after OpenAI rate limits or model switching.

---

You are continuing in-progress product and engineering work inside the SCHOOL repo.

## Repo
`/home/lottie/projects/SCHOOL-Academic-Platform`

## Current branch
Usually `main` unless MK says otherwise.

## Primary objective
Continue building the **grounded multilingual language layer** for SCHOOL so it becomes a native student product surface, not just an assistant add-on.

## What has already been built

### 1. Language API surface
Under `apps/web/app/api/language/`:
- `analyze`
- `correct`
- `rewrite`
- `explain`
- `search`
- `glossary/lookup`
- `feedback`
- `health`

### 2. Core language layer libs
Under `apps/web/lib/language/`:
- `types.ts`
- `seed.ts`
- `service.ts`
- `index.ts`
- `README.md`

### 3. Persistence / event logging
- Migration: `apps/api/migrations/068_language_layer_events.sql`
- Logging helper: `apps/web/lib/server/languageEvents.ts`

Current logged events:
- language search events
- language rewrite events
- language feedback events

### 4. Grounding against real generated module content
Key files:
- `apps/web/lib/server/languageContent.ts`
- `apps/web/lib/server/assistantGrounding.ts`
- `apps/web/content/modules-generated/*.generated.json`

This supports:
- module-grounded search
- grounded explain
- grounded assistant prompt injection
- cross-module inference from query/material

### 5. UI integrations already shipped
#### Assistant page
- `apps/web/app/assistant/page.tsx`
- language analysis panel
- rewrite actions
- feedback buttons

#### Learning flow
- `apps/web/app/university/learning/page.tsx`
- `apps/web/components/intelligence/LanguageSearchPanel.tsx`

#### Module-native explanation
- `apps/web/components/intelligence/GroundedExplainPanel.tsx`
- `apps/web/components/intelligence/InlineExplainButton.tsx`
- `apps/web/app/university/modules/wves312/page.tsx`

### 6. Commits already pushed
- `bbb3045` — `feat: add grounded multilingual language layer for study flows`
- `395094a` — `feat: add grounded concept explainer to module study flow`

## Product direction
The right product direction is:
- SCHOOL first
- keyboard later
- build the South African multilingual language intelligence layer inside SCHOOL
- use it for writing assist, concept explanation, grounded retrieval, and code-switch aware support

## Current recommended next priorities
Choose the next highest-leverage item from this list:

### Priority A — expand native module surfaces
Add grounded explain/search into more modules, especially:
- `ECON211`
- `EKIP212`
- `WVES312`

### Priority B — improve relevance and module inference
Improve ranking in:
- `apps/web/lib/server/languageContent.ts`
- better cross-module matching
- better result scoring
- clearer source typing

### Priority C — connect more of the assistant flow to grounded retrieval
Strengthen:
- `apps/web/app/api/assistant/route.ts`
- use grounded snippets more explicitly before generation
- possibly expose a retrieval block in the response for debugging/tuning

### Priority D — move from seed data toward DB-backed assets
Eventually replace or augment the seed-based language layer with persisted:
- glossary data
- correction candidates
- localization entries
- accepted feedback loops

## Important implementation rules
1. **Do not sweep unrelated repo changes into commits.**
   Only commit the language-layer tranche you actually touched.

2. **Run typecheck before committing.**
   Use:
   `npm run typecheck -w apps/web`

3. **Progressively commit and push.**
   After each coherent tranche:
   - commit focused changes
   - push to `origin main`

4. **Preserve the current architecture direction.**
   Keep the layer:
   - grounded
   - modular
   - product-facing
   - easy to migrate from seed-based to DB-backed later

5. **Do not remove the generated module grounding files** unless replacing them with a clearly better mechanism.

## Useful files to inspect first
- `apps/web/lib/server/languageContent.ts`
- `apps/web/lib/server/assistantGrounding.ts`
- `apps/web/app/api/language/search/route.ts`
- `apps/web/app/api/language/explain/route.ts`
- `apps/web/app/api/assistant/route.ts`
- `apps/web/app/university/modules/wves312/page.tsx`
- `apps/web/app/university/learning/page.tsx`
- `apps/web/components/intelligence/LanguageSearchPanel.tsx`
- `apps/web/components/intelligence/GroundedExplainPanel.tsx`
- `apps/web/components/intelligence/InlineExplainButton.tsx`

## If you need a next concrete task right away
Start with:
> Add native grounded explain/search to ECON211 and EKIP212 study surfaces, then improve result ranking and commit/push the tranche.

---

When continuing, be product-minded, not just technically correct.
The goal is to make the language layer feel like a real SCHOOL capability students would actually use.
