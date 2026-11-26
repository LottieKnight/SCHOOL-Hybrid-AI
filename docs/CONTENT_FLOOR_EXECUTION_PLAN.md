# SCHOOL Content Floor Execution Plan
## Subject × Grade × Week × Language launch readiness

**Owner:** Ditshego Ventures (Pty) Ltd t/a SCHOOL  
**Primary outcome:** Learners must never be shown a subject, grade, week, or language pathway as complete when the underlying lesson, resource, assessment, language, accessibility, or provenance evidence is not ready.

---

## 1. Definition of done

The content floor is achieved when every learner-visible pathway has a trustworthy status and every promoted pathway meets the same evidence contract.

A pathway is the atomic launch unit:

```text
phase × grade × subject × term × week × language
```

For each pathway, SCHOOL must know:

1. Whether the curriculum scope is defined.
2. Whether the required lesson exists.
3. Whether the lesson passes schema and structural validation.
4. Whether the lesson has a usable explanation, examples, retrieval practice, and feedback.
5. Whether supporting resources are present and traceable to an approved source.
6. Whether the language variant is genuinely native or professionally reviewed, not merely machine-translated interface copy.
7. Whether the content is accessible on mobile and low-bandwidth devices.
8. Whether the pathway has a truthful learner-facing availability state.
9. Who approved it, when, and against which curriculum version.

A route existing is not evidence of content readiness.

---

## 2. Status model

### 2.1 Pathway status

Every subject-language pathway must expose one of these states:

| Status | Meaning | Learner experience | Release treatment |
|---|---|---|---|
| **Green** | Meets lesson, resource, quality, language, accessibility, and assessment thresholds | Full lesson journey with practice and recovery | Safe to promote as available |
| **Amber** | Useful partial coverage exists, but one or more thresholds are incomplete | Explicit “available coverage” labels and visible gaps | May be included in controlled beta; never market as complete |
| **Red** | Below the amber threshold, missing resources, or failed quality/provenance gates | Preview, waitlist, or alternative resource path | Do not expose as a complete learner journey |
| **Blocked** | Content exists but is unsafe, unreviewed, corrupted, unlicensed, or technically invalid | Hide or disable until fixed | Release blocker |
| **Retired** | No longer supported or replaced by a canonical pathway | Redirect or archive | Remove from normal discovery |

### 2.2 Existing repository thresholds

The current `content:floor` evaluator uses these week-level defaults:

- **Green:** at least 80% of tracked weeks have lesson JSON and at least 90% have resources.
- **Amber:** at least 50% of tracked weeks have lesson JSON and some resources exist.
- **Red:** below amber, or no resources are present.

These are useful coverage thresholds, but they are not sufficient for language readiness. A subject can be green at English week level while having no usable isiZulu or Sesotho variant. Language gates must therefore be added as a second dimension.

---

## 3. Recommended launch matrix

The launch matrix must be versioned and reviewed by Curriculum, Product, and Ditshego Ventures leadership before generation begins. Use the following as the default planning shape, then replace it with evidence from enrollment, search demand, past-paper demand, and institutional commitments.

### 3.1 Subject tiers

#### Tier A — launch-critical subjects

These receive the highest generation and review priority:

- Mathematics / Mathematical Literacy.
- English Home Language and First Additional Language.
- Afrikaans Home Language and First Additional Language.
- isiZulu Home Language and First Additional Language.
- Physical Sciences.
- Life Sciences.
- Accounting.
- Business Studies.
- Geography.
- History.
- Life Orientation.

#### Tier B — important expansion subjects

- Economics.
- Computer Applications Technology / Information Technology.
- Tourism.
- Agricultural Sciences.
- Technical Mathematics.
- Technical Sciences.
- Consumer Studies.
- Dramatic Arts, Visual Arts, and Music where source material is available.

#### Tier C — institution- or demand-led subjects

- Subjects with low current demand but committed school or institution users.
- Specialist technical subjects.
- University modules and institution-specific pathways.
- New subjects without a stable source corpus.

Tier C pathways can remain amber or preview until a real learner or partner need justifies production.

### 3.2 Language tiers

SCHOOL supports the 11 official South African written languages represented by the current language model:

- English (`en`).
- Afrikaans (`af`).
- isiZulu (`zu`).
- isiXhosa (`xh`).
- Sesotho (`st`).
- Setswana (`tn`).
- Sepedi (`nso`).
- siSwati (`ss`).
- Tshivenda (`ve`).
- isiNdebele (`nr`).
- Xitsonga (`ts`).

South African Sign Language requires a separate visual/video content programme and should not be represented as text-language parity.

Recommended language rollout:

| Language tier | Languages | Initial floor |
|---|---|---|
| L0 | English | Full Tier A coverage before broad web launch |
| L1 | Afrikaans, isiZulu, isiXhosa, Sesotho, Setswana | Language subjects across relevant grades plus translated explanations for priority Mathematics and Sciences concepts |
| L2 | Sepedi, siSwati, Tshivenda, isiNdebele, Xitsonga | Language subjects and priority concept packs first; expand to full Tier A coverage after QA capacity is proven |

The product must label L1/L2 partial coverage honestly. “AI supports 11 languages” is not equivalent to “11 languages have complete curriculum lessons.”

---

## 4. Readiness gates

A pathway cannot be promoted to Green until all gates pass.

### Gate A — Curriculum scope

- [ ] Grade, phase, subject, term, and week are mapped to a versioned curriculum outline.
- [ ] The topic and learning outcomes are defined.
- [ ] Required concepts and prerequisite concepts are listed.
- [ ] Assessment expectations are recorded.
- [ ] Source curriculum documents are identified and licensed for use.
- [ ] Subject aliases and language-stream aliases resolve to one canonical key.
- [ ] No duplicate or competing route claims the same pathway.

### Gate B — Lesson structure

- [ ] Canonical lesson JSON exists at the expected week path.
- [ ] Lesson schema parses successfully.
- [ ] Required metadata is present: grade, subject, term, week, topic, summary, key points.
- [ ] The lesson contains a clear explanation, worked example, misconception note, and recap.
- [ ] The lesson includes at least six validated questions for full lessons.
- [ ] Every question has a prompt, answer, and explanation.
- [ ] MCQs contain between three and five options.
- [ ] The answer is unambiguous and does not depend on hidden context.
- [ ] Math notation, diagrams, tables, and code render correctly.
- [ ] No placeholder text, generation traces, hallucinated citations, or unsupported claims remain.

The existing command remains the first structural gate:

```bash
npm run validate:lessons
```

### Gate C — Resource coverage and provenance

- [ ] At least one approved resource exists for every tracked week.
- [ ] Green pathways meet the 90% resource coverage threshold or an approved exception is recorded.
- [ ] Resource types are classified: lesson, worksheet, assessment, memo, slides, teacher notes, or other.
- [ ] Resource file paths resolve successfully.
- [ ] PDFs have extractable text or an explicit image/OCR handling decision.
- [ ] Sources are attributable and licensed or approved for use.
- [ ] Past papers have year, session, province/board, subject, and grade metadata.
- [ ] Memos are linked to their corresponding papers where available.
- [ ] Resources are not counted as proof of a completed lesson by themselves.

### Gate D — Assessment and recovery

- [ ] Every Green lesson has retrieval practice.
- [ ] Incorrect answers produce an explanation or misconception label.
- [ ] At least one retry or targeted practice route is available.
- [ ] Quiz difficulty is appropriate to the grade and topic.
- [ ] Correct answers are not exposed in the initial question payload.
- [ ] Marking and score persistence are verified.
- [ ] A completed lesson or assessment can create a learning artifact where appropriate.
- [ ] The pathway connects to the Study Loop: Know → Study → Prove → Recover → See Journey.

### Gate E — Language quality

For every language variant promoted beyond Preview:

- [ ] The content is tagged with a language code and curriculum stream.
- [ ] The language is native or reviewed by a qualified speaker; machine output alone is not sufficient.
- [ ] Subject terminology is checked against an approved glossary.
- [ ] Proper nouns, symbols, units, formulas, and code remain correct.
- [ ] Instructions and answer explanations use consistent terminology.
- [ ] The language variant preserves the educational meaning of the source lesson.
- [ ] The translation does not silently omit examples, caveats, or safety information.
- [ ] Reading level is appropriate for the target grade.
- [ ] Language-specific punctuation, diacritics, and orthography are checked.
- [ ] Mixed-language technical terms are intentional and documented.
- [ ] A reviewer signs off on a representative sample of each batch.
- [ ] A failed language variant is downgraded independently; it must not downgrade or corrupt the English source.

### Gate F — Accessibility and device readiness

- [ ] Content is usable on a 320–375px mobile viewport.
- [ ] Headings, lists, tables, and equations have semantic structure.
- [ ] Images and diagrams have useful alternative text or an equivalent explanation.
- [ ] Colour is not the only way to communicate an answer or status.
- [ ] Audio/video assets have captions or transcripts where applicable.
- [ ] Focus order and keyboard interaction work for interactive questions.
- [ ] Content remains usable in Lite Mode and under slow-network simulation.
- [ ] Large PDFs have a readable web alternative or clear download affordance.
- [ ] Reduced-motion users can complete the lesson without animation dependency.

### Gate G — Product and route integrity

- [ ] The canonical learner route resolves to the correct grade/subject/week.
- [ ] Legacy route redirects do not create duplicate content or analytics events.
- [ ] The UI displays the actual availability state.
- [ ] Empty, loading, error, offline, and unavailable states are designed.
- [ ] Search and navigation do not promote Red or Blocked pathways as complete.
- [ ] The language selector shows only available content states, not merely supported UI locales.
- [ ] Analytics record impressions, starts, completions, failures, and language selection.

---

## 5. Data model and reporting changes

The current content index measures:

```text
phase → grade → subject → term → week
```

It must be extended to measure language variants:

```text
phase → grade → subject → term → week → language
```

Add these fields to the content index/report model:

- `language`.
- `contentVariantPath`.
- `hasLessonJson`.
- `hasResources`.
- `hasAssessment`.
- `hasMemo` where a paper exists.
- `schemaValid`.
- `qualityStatus`.
- `languageReviewStatus`.
- `accessibilityStatus`.
- `sourceStatus`.
- `lastReviewedAt`.
- `reviewerId` or reviewer role.
- `curriculumVersion`.
- `availabilityStatus`.
- `blockedReason`.

Add report dimensions:

1. Overall coverage.
2. Coverage by phase.
3. Coverage by grade.
4. Coverage by subject.
5. Coverage by language.
6. Coverage by subject × language.
7. Coverage by subject × grade.
8. Coverage by subject × grade × language.
9. Missing-week backlog.
10. Failed-validation backlog.
11. Unreviewed-language backlog.
12. Resource and provenance exceptions.
13. Accessibility exceptions.

The existing command remains useful:

```bash
npm run content:index
npm run content:floor
CONTENT_FLOOR_STRICT=true npm run content:floor
```

The strict release check should eventually fail if any launch-critical subject-language pathway is Red or Blocked, not only when the overall aggregate is Red. An overall green aggregate must never hide a Red language pathway.

---

## 6. Execution workstreams

### Workstream 1 — Establish the authoritative matrix

**Deliverable:** `content/config/content_floor_matrix.json` or an equivalent versioned configuration.

Checklist:

- [ ] List all supported phases and grades.
- [ ] List all launch subjects and canonical subject keys.
- [ ] List language streams and language codes.
- [ ] Define the number of terms and weeks per grade/subject.
- [ ] Mark Tier A, B, and C subjects.
- [ ] Mark L0, L1, and L2 languages.
- [ ] Assign a curriculum owner to every matrix slice.
- [ ] Record exceptions explicitly rather than omitting them.
- [ ] Version the matrix independently from generated lessons.
- [ ] Require pull-request review for changes to the matrix.

### Workstream 2 — Baseline the current repository

Run in a clean checkout:

```bash
npm run content:index
npm run content:floor
npm run validate:lessons
```

Checklist:

- [ ] Save the generated index and report as dated artifacts.
- [ ] Record current overall Green/Amber/Red status.
- [ ] Export all Red pathways.
- [ ] Export all Amber pathways.
- [ ] Separate resource-only weeks from lesson-ready weeks.
- [ ] Compare actual content against the authoritative matrix.
- [ ] Identify subjects or grades that exist in routes but not in content.
- [ ] Identify content files that exist but are unreachable from canonical routes.
- [ ] Count language variants separately from interface translations.
- [ ] Record baseline numbers in the release dashboard.

### Workstream 3 — Repair source and curriculum gaps

Checklist:

- [ ] Resolve unmapped PDFs and subject aliases.
- [ ] Resolve grade, term, and week naming drift.
- [ ] Repair orphaned resources.
- [ ] Remove duplicate files and duplicate curriculum claims.
- [ ] OCR or replace image-only source documents.
- [ ] Confirm source licensing and provenance.
- [ ] Prioritise missing weeks by learner demand and exam proximity.
- [ ] Freeze source documents while a batch is being generated.
- [ ] Rebuild the content index after each source correction.

Recommended commands where applicable:

```bash
npm run ingest:pdf-lessons
npm run lessons:shells
npm run content:index
```

### Workstream 4 — Generate and curate English lessons

For each missing Tier A week:

- [ ] Confirm the topic and source pack.
- [ ] Generate a lesson or shell using the approved generator.
- [ ] Add the required explanation, examples, misconceptions, and quiz.
- [ ] Run schema and structural validation.
- [ ] Run curriculum-owner review.
- [ ] Run assessment review.
- [ ] Run accessibility review.
- [ ] Publish only after all gates pass.

Example generation shape:

```bash
npm run lessons:generate-week -w packages/shared -- \
  --grade 9 \
  --subject mathematics \
  --term 1 \
  --week 2 \
  --phase senior \
  --topic "..."
```

Do not mark a shell as a complete lesson. Shells are useful for prioritisation and learner-visible previews, but must retain an explicit status.

### Workstream 5 — Build language variants

For each approved English lesson:

1. Create the language assignment queue.
2. Generate a draft variant using the approved language-aware generation path.
3. Preserve formulas, question structure, metadata, and answer semantics.
4. Run automated structural and terminology checks.
5. Send the variant to a qualified language reviewer.
6. Resolve review comments.
7. Run a second sampling review for the batch.
8. Publish the variant with its own status and review metadata.
9. Recalculate the subject-language floor.

Example language generation shape:

```bash
npm run gen:lesson -w packages/shared -- \
  --phase senior \
  --grade 9 \
  --subjectKey mathematics \
  --term 1 \
  --week 2 \
  --language zu
```

The `--all-languages` option should be used only after the English source lesson has passed review and the language glossary is stable. It must not be used as a substitute for language QA.

### Workstream 6 — Assessment, memo, and recovery linking

Checklist:

- [ ] Link each past paper to its memo where available.
- [ ] Map missed questions to canonical concepts.
- [ ] Generate targeted retry sets for mapped concepts.
- [ ] Verify original-versus-retry score persistence.
- [ ] Link revision artifacts to the relevant lesson or assessment.
- [ ] Ensure each Green pathway has a visible next recovery action.
- [ ] Add a regression fixture for every new assessment format.

### Workstream 7 — Learner-facing availability states

Implement consistent copy and UI treatment:

- **Available:** “Full lesson, practice, and recovery available.”
- **Partial:** “Some weeks are available. More content is being prepared.”
- **Preview:** “Preview pathway — full lesson coverage is not yet available.”
- **Language in progress:** “This topic is available in English while the selected language variant is reviewed.”
- **Offline/resource-only:** “Downloadable resources available; interactive lesson coming soon.”
- **Blocked:** “Temporarily unavailable while SCHOOL verifies this content.”

Checklist:

- [ ] Availability state appears on subject cards.
- [ ] Availability state appears on grade and language selectors.
- [ ] Red pathways do not look like normal completed courses.
- [ ] Amber pathways show coverage percentage or a plain-language equivalent.
- [ ] The user can switch to an available language without losing context.
- [ ] Search results respect status.
- [ ] Analytics distinguish preview starts from full lesson starts.

---

## 7. Batch execution order

### Batch 0 — Instrumentation and governance

- [ ] Add the subject-language matrix.
- [ ] Extend the content index with language and quality fields.
- [ ] Add report generation for every required dimension.
- [ ] Add strict CI/release checks.
- [ ] Create reviewer and exception logs.

**Exit:** the team can measure the problem without guessing.

### Batch 1 — English Tier A foundation

- [ ] Reach Green for launch-critical English pathways.
- [ ] Prioritise Grades 10–12 first where exam impact is highest.
- [ ] Then cover Grades 7–9.
- [ ] Then cover Foundation and Intermediate phases.
- [ ] Include lesson, resource, quiz, feedback, and recovery evidence.

**Exit:** English Tier A is complete enough for a credible core learner journey.

### Batch 2 — L1 language subjects

- [ ] Reach Green for Afrikaans, isiZulu, isiXhosa, Sesotho, and Setswana language subjects in priority grades.
- [ ] Add glossary and terminology review.
- [ ] Add language-specific test fixtures.

**Exit:** the product can truthfully promote language learning pathways for the L1 languages.

### Batch 3 — L1 cross-subject explanations

- [ ] Translate or natively author priority Mathematics, Physical Sciences, and Life Sciences explanations.
- [ ] Keep formulas and assessment semantics invariant.
- [ ] Review terminology with subject and language reviewers.

**Exit:** selected STEM recovery journeys work in L1 languages, not only interface chrome.

### Batch 4 — L2 language subjects and priority packs

- [ ] Build language-subject coverage for Sepedi, siSwati, Tshivenda, isiNdebele, and Xitsonga.
- [ ] Add priority concept packs for high-demand subjects.
- [ ] Keep honest Amber/Preview labels where full coverage is not yet achieved.

**Exit:** every official written language has a measurable, learner-visible pathway rather than a marketing-only claim.

### Batch 5 — Full parity expansion

- [ ] Bring Tier B subjects to Green in English.
- [ ] Expand L1 and L2 language variants across Tier A.
- [ ] Add school/institution-specific curriculum differences.
- [ ] Add South African Sign Language as a separate visual/video roadmap, not as a text-language checkbox.

**Exit:** the content floor is a maintained operating capability, not a one-time launch project.

---

## 8. Quality sampling plan

Full manual review of every generated item may be impractical, but no batch should be published without representative human review.

For every generation batch:

- [ ] Review 100% of blocked or regenerated lessons.
- [ ] Review 100% of new language glossaries.
- [ ] Review at least 10% of ordinary English lessons.
- [ ] Review at least 20% of new language variants until a language reaches three consecutive passing batches.
- [ ] Review 100% of lessons with diagrams, complex formulas, practical work, or sensitive topics.
- [ ] Re-review any pathway after source curriculum changes.
- [ ] Perform blind comparison against source material for factual accuracy.
- [ ] Record reviewer, date, version, severity, and resolution.

Suggested defect severity:

| Severity | Example | Action |
|---|---|---|
| Critical | Wrong answer, unsafe advice, fabricated source, meaning reversal | Block release and quarantine batch |
| High | Missing core concept, broken marking, major translation error | Fix before Green; Amber only with explicit owner approval |
| Medium | Weak example, terminology inconsistency, accessibility issue | Fix in current sprint or record dated exception |
| Low | Style, punctuation, non-blocking layout issue | Backlog with owner and target date |

---

## 9. Release checklist

### Before a content release

- [ ] Curriculum matrix version is recorded.
- [ ] Source pack version is recorded.
- [ ] Generator/model version is recorded.
- [ ] Language glossary version is recorded.
- [ ] All changed lessons pass schema validation.
- [ ] All changed resources resolve.
- [ ] All changed pathways have a status.
- [ ] Language reviewer sign-offs are present.
- [ ] Accessibility sampling is complete.
- [ ] Assessment and recovery links are tested.
- [ ] Content index is regenerated.
- [ ] Content-floor report is regenerated.
- [ ] Subject-language report is regenerated.
- [ ] Red and Blocked counts are reviewed.
- [ ] No new Red pathway is promoted without an approved exception.
- [ ] Release notes state what is available and what remains partial.

### Commands

```bash
npm run content:index
npm run content:floor
npm run validate:lessons
npm run typecheck -w packages/shared
npm test -w packages/shared
```

For a strict release gate:

```bash
CONTENT_FLOOR_STRICT=true npm run content:floor
```

The strict check must eventually include language-aware and pathway-aware rules before it is considered a complete launch gate.

### After deployment

- [ ] Verify canonical routes for representative Green pathways.
- [ ] Verify representative Amber and Red pathways display honest states.
- [ ] Verify language switching preserves grade, subject, term, and week.
- [ ] Verify no unavailable lesson produces a raw 500 or empty white screen.
- [ ] Verify analytics events for view, start, completion, failure, and language selection.
- [ ] Verify RAG/source retrieval uses the correct curriculum and language context.
- [ ] Monitor content errors and learner support tickets for 72 hours.
- [ ] Re-run the report after any emergency content hotfix.

---

## 10. Ownership and cadence

| Area | Primary owner | Required evidence |
|---|---|---|
| Curriculum scope | Curriculum lead | Approved matrix and outcome map |
| Source licensing/provenance | Ditshego Ventures operations/legal | Source register and permissions |
| Lesson generation | Content engineering | Generator logs and commit/version |
| Subject correctness | Subject reviewer | Review checklist and sign-off |
| Language correctness | Qualified language reviewer | Language batch sign-off |
| Assessment/recovery | Learning product | Retry and feedback test evidence |
| Accessibility | UX/accessibility owner | Mobile, keyboard, contrast, and screen-reader sample |
| Platform/index/reporting | Engineering | Reproducible report and CI result |
| Release decision | Product + Ditshego Ventures | Green/Amber/Red decision record |

Recommended cadence:

- Daily: generation queue, validation failures, blocked items.
- Twice weekly: subject and language review triage.
- Weekly: content-floor report and backlog burn-down.
- Every release: strict content-floor gate and representative route verification.
- Monthly: matrix, demand, source, and language-priority review.

---

## 11. Required dashboards and artifacts

Create and retain these artifacts in `content/reports/` or the release evidence store:

- `content_index_report.md` — structural inventory.
- `content_floor_report.md` — aggregate and subject coverage.
- `content_language_floor_report.md` — subject × language readiness.
- `content_validation_report.json` — schema and quality failures.
- `content_provenance_register.csv` — source and licensing status.
- `content_review_log.csv` — human review evidence.
- `content_exceptions.md` — approved Amber/Red exceptions.
- `content_release_notes.md` — learner-facing availability changes.

Every artifact must contain:

- Generated timestamp.
- Git commit or content version.
- Curriculum version.
- Threshold configuration.
- Operator or workflow identity.
- Counts by status.
- Link to the source matrix.

---

## 12. Launch decision rules

### Web-first soft launch

A web-first soft launch is credible when:

- [ ] English Tier A core pathways are Green.
- [ ] No learner-facing core pathway is silently empty.
- [ ] Amber and Red states are explicit.
- [ ] Message and phone encryption production keys are provisioned.
- [ ] Consent and legal gates are documented.
- [ ] The infrastructure owner has accepted remaining live-verification gaps.
- [ ] Accessibility and authenticated learner-loop checks have evidence.

### Broad public launch

A broad launch requires:

- [ ] Green content floor for the agreed launch matrix.
- [ ] No unreviewed language claim presented as complete.
- [ ] Subject-language coverage is visible in the report.
- [ ] Assessment and recovery paths work for every promoted pathway.
- [ ] Source provenance and reviewer evidence are retained.
- [ ] Strict release checks pass.
- [ ] The product and Ditshego Ventures leadership approve any explicit exceptions.

### Play/mobile launch

Do not use content readiness to imply Android readiness. Play/mobile release additionally requires the separate Android signing, asset-links, device, and Play Console gates.

---

## 13. First 10 execution days

### Day 1 — establish truth

- [ ] Create the launch matrix.
- [ ] Run the existing index, floor, and lesson validation commands.
- [ ] Save the baseline report.
- [ ] Identify the first 100 Red/Amber pathways by demand and exam impact.

### Day 2 — repair naming and sources

- [ ] Resolve aliases, duplicate routes, missing source paths, and orphaned resources.
- [ ] Produce the provenance register.

### Day 3 — implement language-aware reporting

- [ ] Extend the index schema with language variants and review statuses.
- [ ] Add subject × language rollups.
- [ ] Add strict per-pathway rules.

### Day 4 — English Tier A generation queue

- [ ] Lock the first generation batch.
- [ ] Generate missing high-priority weeks.
- [ ] Run automated validation.

### Day 5 — English review and recovery

- [ ] Subject-review the batch.
- [ ] Verify assessments, memos, and retry links.
- [ ] Publish only passing pathways.

### Day 6 — L1 language pilot

- [ ] Select one representative grade and subject per L1 language.
- [ ] Build glossaries.
- [ ] Generate and review a controlled pilot.

### Day 7 — language QA and accessibility

- [ ] Run reviewer sampling.
- [ ] Test mobile, low-data, and accessibility behavior.
- [ ] Fix the content and UI defects found.

### Day 8 — expand the queue

- [ ] Promote the successful pilot pattern to priority L1 pathways.
- [ ] Start L2 language-subject batches.

### Day 9 — release rehearsal

- [ ] Generate all reports.
- [ ] Run strict floor checks.
- [ ] Test Green, Amber, Red, and Blocked learner states.
- [ ] Produce draft release notes.

### Day 10 — decision review

- [ ] Review the report with Product, Curriculum, Engineering, and Ditshego Ventures leadership.
- [ ] Approve the web-first launch matrix or keep the launch scoped.
- [ ] Assign every exception an owner and due date.
- [ ] Publish the next 30-day backlog.

---

## 14. Non-negotiable principles

1. Never aggregate away a Red language pathway behind a Green overall score.
2. Never count a resource-only week as a completed lesson.
3. Never call machine translation a reviewed language variant.
4. Never expose a generated lesson without answer and explanation validation.
5. Never let a route imply availability that the report does not support.
6. Never change the curriculum matrix silently.
7. Never publish without provenance and a rollback path.
8. Never sacrifice correctness for coverage numbers.
9. Prefer a smaller Green pathway to a larger misleading catalogue.
10. Make every availability decision visible to the learner and auditable by Ditshego Ventures.
