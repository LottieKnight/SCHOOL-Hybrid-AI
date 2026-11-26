# QUICK WIN 1 — KaTeX Math Rendering in Lessons
**Confidence:** HIGH · **Risk:** LOW · **Effort:** S (½ day) · **Closes audit item P1-7**
**Files:** `apps/web/lib/markdown.ts`, `apps/web/components/AiLessonView.tsx`, `apps/web/package.json`, `apps/web/app/learn/[phase]/[grade]/[subject]/term/[term]/week/[week]/page.tsx`
**Verified current state (2026-08-25):**
- `renderMarkdown()` in `apps/web/lib/markdown.ts` uses `marked` + `sanitize-html`.
- `sanitize-html` allowedTags do NOT include `span`/`math` and would strip any KaTeX output; `marked` does not parse `$...$` LaTeX. → Math is currently NOT rendered. CONFIRMED: no katex/remark-math/rehype-katex in package.json.
- Lessons render via `AiLessonView.tsx` (`renderMarkdown(lesson.summary)` → `dangerouslySetInnerHTML`) and the week page (`section.content` as plain `<p>`).

## Why this wins
A Grade 10 learner seeing Unicode fractions vs KaTeX-typeset equations is a chasm. Math rendering alone puts SCHOOL ahead of ChatGPT/Gemini for SA curriculum maths (CAPS Maths, Maths Literacy, Physical Sciences, Accounting). Foundation Phase users already get readable text; FET users get proper notation.

## Implementation (two options — recommend B)

### Option A — keep marked, post-process with rehype-katex (less refactor)
1. `npm i rehype-katex katex` in `apps/web`.
2. Replace `renderMarkdown` with a pipeline that runs `marked` → wrap HTML → run through `unified().use(rehypeParse).use(rehypeKatex).use(rehypeStringify)`.
3. Add `span`, `math`, `semantics`, `annotation`, `mrow`, `mi`, `mo`, `mn` to `sanitize-html` allowedTags, and `style`/`class` to allowedAttributes for those tags. Import `katex/dist/katex.min.css` globally.

### Option B (RECOMMENDED) — React component, no dangerouslySetInnerHTML
1. `npm i react-markdown remark-math rehype-katex katex`.
2. Create `apps/web/components/Markdown.tsx`:
   ```tsx
   "use client";
   import ReactMarkdown from "react-markdown";
   import remarkMath from "remark-math";
   import rehypeKatex from "rehype-katex";
   import "katex/dist/katex.min.css";
   export function Markdown({ children }: { children: string }) {
     return (
       <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
         {children ?? ""}
       </ReactMarkdown>
     );
   }
   ```
3. In `AiLessonView.tsx` replace the summary block:
   ```tsx
   {lesson.summary ? <Markdown>{lesson.summary}</Markdown> : <p className="badge">No summary yet.</p>}
   ```
4. In the week page, render `section.content` and any math-bearing fields through `<Markdown>` instead of `<p>{...}</p>`.
5. Add `katex/dist/katex.min.css` import once at app root (`app/layout.tsx` or `globals.css`).

## Acceptance criteria
- [ ] Lesson summary containing `$E=mc^2$` or `$$\int_0^1 x^2 dx$$` renders as typeset math (not raw `$...$`).
- [ ] No new ESLint `dangerouslySetInnerHTML` introduced (or sanitize-html config proven safe).
- [ ] Existing bold/heading/lists still render (regression check on 3 sample lessons).
- [ ] `katex.min.css` loaded; math displays in both dark and light themes.

## Note
Generator prompt (`packages/shared/src/gen/lessonGenerator.ts`) should be told to emit math in `$...$` / `$$...$$` LaTeX where appropriate (e.g. formulas in worked examples). Add `mathNotation?: string[]` to `GeneratedLessonContent` if you want explicit formula fields (see Quick Win 3).
