# QUICK WIN 3 — Visual Lesson Schema Extension (Google Notebook Gap)
**Confidence:** HIGH · **Risk:** LOW · **Effort:** M (1–2 days, schema + generator prompt + 1 viewer widget) · **Closes audit items P1-6, P1-8, P1-9, P1-10 (foundation)**
**Files:** `packages/shared/src/gen/lessonGenerator.ts` (type + prompt), `apps/web/components/AiLessonView.tsx` (render new fields), `apps/web/components/LessonVisual.tsx` (NEW)
**Verified current state (2026-08-25):**
- `GeneratedLessonContent` type (`packages/shared/src/gen/lessonGenerator.ts:37`) has NO fields for diagrams, charts, images, audio, or interactive widgets. → Confirmed: zero visual content in the lesson schema.
- `AiLessonView.tsx` renders `summary`, `learningOutcomes`, `lessonNotes`, `workedExamples`, `practice`, `teacherNotes`, `memo`, `citations` — all text.
- This is the structural reason "7,702 lessons are text-only" — the schema can't hold visuals.

## Why this wins
Google Notebook auto-generates diagrams/graphics for lesson content; SCHOOL currently cannot represent them at all. Extending the schema is the *foundational* change that unlocks every visual differentiator (P1-6 SVG, P1-8 charts, P1-9 images, P1-10 widgets). Without this, those wins have nowhere to live.

## Implementation
1. Extend the type (`lessonGenerator.ts:37`):
   ```ts
   export type LessonVisual =
     | { kind: "diagram"; engine: "mermaid" | "plantuml"; spec: string; caption?: string }
     | { kind: "chart"; chartType: "bar" | "line" | "pie" | "scatter"; title: string; data: Record<string, unknown>[]; caption?: string }
     | { kind: "image"; src: string; alt: string; caption?: string; stylePreset?: "clean-diagram" | "warm-illustration" | "scientific-precise" }
     | { kind: "widget"; widgetType: "slider" | "quiz" | "simulation" | "sort"; config: Record<string, unknown> };

   export type GeneratedLessonContent = {
     // ... existing fields ...
     visuals?: LessonVisual[];        // NEW — rendered by <LessonVisual>
     mathNotation?: string[];         // NEW — explicit LaTeX for KaTeX (see Quick Win 1)
   };
   ```
2. Add a generator instruction (in the LLM system prompt inside `lessonGenerator.ts`) telling the model to emit 1–3 `visuals` per lesson: a `diagram` (Mermaid) for concept relationships, a `chart` for data subjects (Economics supply/demand, Geography population, Science results), and where helpful an `image` with a `stylePreset`. Keep it budget-bounded (max 3 visuals, only when genuinely useful).
3. Create `apps/web/components/LessonVisual.tsx` that switches on `visual.kind`:
   - `diagram` → render Mermaid via `mermaid` npm pkg (client-only, dynamic import) or `react-markdown` + `mermaid` plugin.
   - `chart` → `recharts` component fed `visual.data`.
   - `image` → `next/image` with `src` from Supabase Storage CDN.
   - `widget` → render the appropriate interactive component (start with `quiz`/`slider`; simulations later).
4. In `AiLessonView.tsx`, after the lesson notes, render:
   ```tsx
   {lesson.visuals?.map((v, i) => <LessonVisual key={i} visual={v} />)}
   ```

## Acceptance criteria
- [ ] Type compiles; generator emits `visuals` for new lessons (backfill optional, can be staged).
- [ ] A `diagram` renders as SVG; a `chart` renders as an interactive Recharts figure.
- [ ] No regression to existing text rendering.
- [ ] Images load from the CDN with proper alt text (accessibility + POPIA data-minimisation: alt must not leak PII).

## Sequencing
Do Quick Win 1 (math) and Quick Win 3 (schema) together — math is the cheapest visual; schema is the backbone. Quick Win 2 (CSP) is independent and can ship in parallel. After these three land, the higher-effort visual wins (image generation via DALL·E/SD, interactive simulations, ConceptMap wiring) become straightforward because the schema + render path exist.
