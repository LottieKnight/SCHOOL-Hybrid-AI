/**
 * Delivery schema for /learn.
 *
 * Existing lessons stay on disk in older shapes (legacy lesson JSON, generated
 * v1, shared LessonV2, and the AI generator payload). `normalizeLesson` upgrades
 * every one of those into this document without throwing, so a missing or
 * partial file still opens as a teachable lesson.
 */

export const LESSON_SCHEMA_VERSION = 2 as const;

export type CurriculumCode = "CAPS" | "IEB";
export type LessonDifficulty = "foundation" | "core" | "extension";
export type LessonSectionKind = "explanation" | "worked_example" | "exam_tip" | "activity";
export type QuickCheckKind = "mcq" | "reveal";

export type LessonGlossaryEntry = {
  term: string;
  definition: string;
};

export type LessonExampleStep = {
  prompt: string;
  detail: string;
};

export type LessonSection = {
  id: string;
  kind: LessonSectionKind;
  heading: string;
  body: string;
  steps?: LessonExampleStep[];
};

export type LessonQuickCheck = {
  id: string;
  kind: QuickCheckKind;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type LessonPacingStep = {
  label: string;
  minutes: number;
};

export type LessonTeacherGuide = {
  pacing: LessonPacingStep[];
  discussionPrompts: string[];
  misconceptions: string[];
  boardExamples: string[];
  notes: string[];
};

export type LessonPracticeLinks = {
  pastPapersHref: string;
  tutorHref: string;
  subject: string;
  topic: string;
};

export type LessonVideo = {
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  provider: "heygen" | "elevenlabs" | "youtube" | "vimeo" | "other";
  transcript?: string;
  captionsUrl?: string;
};

export type LessonCurriculum = {
  curriculum: CurriculumCode;
  phase: string;
  grade: number;
  subject: string;
  subjectKey: string;
  term: number;
  week: number;
  topic: string;
  capsTopicCode?: string;
  outcomes: string[];
  estimatedMinutes: number;
  difficulty: LessonDifficulty;
  prerequisites: string[];
  institutionId?: string;
  classId?: string;
  cohortId?: string;
  curriculumStandard?: string;
  termWeighting?: number;
};

export type StructuredLesson = {
  schemaVersion: typeof LESSON_SCHEMA_VERSION;
  id: string;
  curriculum: LessonCurriculum;
  title: string;
  summary: string;
  learningObjectives: string[];
  keyConcepts: LessonGlossaryEntry[];
  sections: LessonSection[];
  quickChecks: LessonQuickCheck[];
  teacherGuide: LessonTeacherGuide;
  practice: LessonPracticeLinks;
  citations: string[];
  /** Present when the authored lesson (usually generated v1) carries its own clip. */
  video?: LessonVideo;
  /** True when the body was built from the outline because no authored lesson exists. */
  outlineBacked: boolean;
};

export type LessonNormalizeContext = {
  phase?: string;
  grade?: number;
  subject?: string;
  subjectKey?: string;
  term?: number;
  week?: number;
  topic?: string;
  summary?: string;
  outcomes?: string[];
  curriculum?: CurriculumCode;
  capsTopicCode?: string;
  estimatedMinutes?: number;
  difficulty?: LessonDifficulty;
  prerequisites?: string[];
  institutionId?: string;
  classId?: string;
  cohortId?: string;
  curriculumStandard?: string;
  termWeighting?: number;
};

export type LessonSourceKind =
  | "structured-v2"
  | "generated-v1"
  | "legacy-json"
  | "lesson-v2"
  | "generator-content"
  | "scaffold";

export type NormalizeLessonResult = {
  lesson: StructuredLesson;
  source: LessonSourceKind;
  warnings: string[];
};

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of value) {
    const text = asString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    list.push(text);
  }
  return list;
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildLessonId(input: {
  phase: string;
  grade: number;
  subjectKey: string;
  term: number;
  week: number;
}) {
  const phase = slug(input.phase) || "phase";
  const subjectKey = slug(input.subjectKey) || "subject";
  return `caps:${phase}:g${input.grade}:${subjectKey}:t${input.term}:w${input.week}`;
}

export function enumerateLessonIds(plans: Array<{
  phase: string;
  grade: number;
  subjectKey: string;
  term: number;
  weeks: number;
}>) {
  const ids: string[] = [];
  for (const plan of plans) {
    const count = Math.max(0, Math.round(plan.weeks));
    for (let week = 1; week <= count; week += 1) {
      ids.push(
        buildLessonId({
          phase: plan.phase,
          grade: plan.grade,
          subjectKey: plan.subjectKey,
          term: plan.term,
          week,
        })
      );
    }
  }
  return ids;
}

export function buildPracticeLinks(input: {
  subject: string;
  grade?: number | null;
  topic?: string | null;
}): LessonPracticeLinks {
  const subject = asString(input.subject) || "Subject";
  const topic = asString(input.topic);
  const usableTopic = topic && !/^placeholder\b/i.test(topic) ? topic : null;
  const papers = new URLSearchParams();
  papers.set("subject", subject);
  if (typeof input.grade === "number" && Number.isFinite(input.grade)) {
    papers.set("grade", String(input.grade));
  }
  if (usableTopic) papers.set("q", usableTopic);

  const tutor = new URLSearchParams();
  tutor.set("subject", subject);
  if (typeof input.grade === "number" && Number.isFinite(input.grade)) {
    tutor.set("grade", String(input.grade));
  }
  const prompt = usableTopic
    ? `Practise ${subject}: ${usableTopic}. Ask one question at a time and check my reasoning.`
    : `Practise ${subject} with me. Ask one question at a time and check my reasoning.`;
  tutor.set("q", prompt);

  return {
    pastPapersHref: `/past-papers?${papers.toString()}`,
    tutorHref: `/tutor?${tutor.toString()}`,
    subject,
    topic: usableTopic || subject,
  };
}

function difficultyFromWeek(week: number | null, explicit?: unknown): LessonDifficulty {
  const named = asString(explicit)?.toLowerCase();
  if (named === "foundation" || named === "easy") return "foundation";
  if (named === "extension" || named === "hard" || named === "advanced") return "extension";
  if (named === "core" || named === "medium") return "core";
  if (week !== null && week <= 3) return "foundation";
  if (week !== null && week >= 8) return "extension";
  return "core";
}

function curriculumFrom(value: unknown, fallback: CurriculumCode): CurriculumCode {
  const named = asString(value)?.toUpperCase();
  if (named === "IEB") return "IEB";
  if (named === "CAPS") return "CAPS";
  return fallback;
}

function headingContentList(value: unknown): Array<{ heading: string; content: string }> {
  if (!Array.isArray(value)) return [];
  const sections: Array<{ heading: string; content: string }> = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const heading = asString(item.heading) || asString(item.title);
    const content = asString(item.content) || asString(item.body) || asString(item.text);
    if (!heading || !content) continue;
    sections.push({ heading, content });
  }
  return sections;
}

function answerText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = asStringList(value);
    return parts.length ? parts.join(", ") : null;
  }
  return asString(value);
}

type LooseQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  kind: QuickCheckKind;
};

function looseQuestions(value: unknown): LooseQuestion[] {
  const quiz = isRecord(value) && Array.isArray(value.questions) ? value.questions : Array.isArray(value) ? value : [];
  const questions: LooseQuestion[] = [];
  quiz.forEach((item, index) => {
    if (!isRecord(item)) return;
    const prompt = asString(item.prompt) || asString(item.question);
    const answer = answerText(item.answer) || answerText(item.correct);
    if (!prompt || !answer) return;
    let options = asStringList(item.options);
    const type = asString(item.type);
    if (!options.length && (type === "true_false" || /^(true|false)$/i.test(answer))) {
      options = ["True", "False"];
    }
    const explanation = asString(item.explanation) || "Compare your answer with the model response and name the step that changed your mind.";
    questions.push({
      id: asString(item.id) || `check-${index + 1}`,
      prompt,
      options,
      answer,
      explanation,
      kind: options.length >= 2 ? "mcq" : "reveal",
    });
  });
  return questions;
}

function toSteps(content: string): LessonExampleStep[] {
  const lines = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return [{ prompt: "Solution", detail: content.trim() }];
  }
  return lines.slice(0, 8).map((line, index) => ({
    prompt: `Step ${index + 1}`,
    detail: line.replace(/^(step\s*\d+[:.)-]*|\d+[.)]|[-*•])\s*/i, ""),
  }));
}

function pacingFor(minutes: number): LessonPacingStep[] {
  const weights: Array<[string, number]> = [
    ["Open and share the objective", 0.15],
    ["Teach the idea", 0.35],
    ["Work a board example", 0.25],
    ["Quick check", 0.15],
    ["Close and set the next step", 0.1],
  ];
  const raw = weights.map(([label, weight]) => ({
    label,
    minutes: Math.max(1, Math.round(minutes * weight)),
  }));
  const drift = minutes - raw.reduce((sum, step) => sum + step.minutes, 0);
  raw[1]!.minutes = Math.max(1, raw[1]!.minutes + drift);
  return raw;
}

function firstSentence(text: string) {
  const match = text.split(/(?<=[.!?])\s+/)[0];
  return (match || text).trim();
}

const VIDEO_PROVIDERS = ["heygen", "elevenlabs", "youtube", "vimeo", "other"] as const;

export function readLessonVideo(value: unknown): LessonVideo | undefined {
  if (!isRecord(value)) return undefined;
  const videoUrl = asString(value.videoUrl);
  if (!videoUrl) return undefined;
  const named = asString(value.provider);
  const provider = VIDEO_PROVIDERS.find((item) => item === named) ?? "other";
  const video: LessonVideo = { videoUrl, provider };
  const thumbnailUrl = asString(value.thumbnailUrl);
  const transcript = asString(value.transcript);
  const captionsUrl = asString(value.captionsUrl);
  const durationSeconds = asNumber(value.durationSeconds);
  if (thumbnailUrl) video.thumbnailUrl = thumbnailUrl;
  if (transcript) video.transcript = transcript;
  if (captionsUrl) video.captionsUrl = captionsUrl;
  if (durationSeconds !== null && durationSeconds > 0) video.durationSeconds = durationSeconds;
  return video;
}

export function quickCheckFeedback(
  check: Pick<LessonQuickCheck, "kind" | "answer" | "explanation">,
  correct: boolean
) {
  if (check.kind === "reveal") {
    return `Model answer: ${check.answer}. ${check.explanation}`;
  }
  if (correct) return `That's right. ${check.explanation}`;
  return `Not quite — read the explanation and try the method again. ${check.explanation}`;
}

function uniqueConcepts(entries: LessonGlossaryEntry[]): LessonGlossaryEntry[] {
  const seen = new Set<string>();
  const concepts: LessonGlossaryEntry[] = [];
  for (const entry of entries) {
    const term = entry.term.trim();
    const definition = entry.definition.trim();
    if (!term || !definition) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    concepts.push({ term, definition });
    if (concepts.length >= 8) break;
  }
  return concepts;
}

type Draft = {
  id?: string;
  phase?: string;
  grade?: number;
  subject?: string;
  subjectKey?: string;
  term?: number;
  week?: number;
  topic?: string;
  title?: string;
  summary?: string;
  objectives: string[];
  outcomes: string[];
  concepts: LessonGlossaryEntry[];
  explanations: Array<{ heading: string; content: string }>;
  examples: Array<{ heading: string; content: string }>;
  activities: Array<{ heading: string; content: string }>;
  tips: string[];
  questions: LooseQuestion[];
  teacherNotes: string[];
  citations: string[];
  video?: LessonVideo;
  capsTopicCode?: string;
  curriculum?: CurriculumCode;
  estimatedMinutes?: number;
  difficulty?: LessonDifficulty;
  prerequisites: string[];
  institutionId?: string;
  classId?: string;
  cohortId?: string;
  curriculumStandard?: string;
  termWeighting?: number;
  outlineBacked: boolean;
};

function emptyDraft(): Draft {
  return {
    objectives: [],
    outcomes: [],
    concepts: [],
    explanations: [],
    examples: [],
    activities: [],
    tips: [],
    questions: [],
    teacherNotes: [],
    citations: [],
    prerequisites: [],
    outlineBacked: false,
  };
}

function applyContext(draft: Draft, context: LessonNormalizeContext) {
  draft.phase = draft.phase || asString(context.phase) || undefined;
  draft.grade = draft.grade ?? (typeof context.grade === "number" ? context.grade : undefined);
  draft.subject = draft.subject || asString(context.subject) || undefined;
  draft.subjectKey = draft.subjectKey || asString(context.subjectKey) || undefined;
  draft.term = draft.term ?? context.term;
  draft.week = draft.week ?? context.week;
  draft.topic = draft.topic || asString(context.topic) || undefined;
  draft.summary = draft.summary || asString(context.summary) || undefined;
  if (!draft.outcomes.length) draft.outcomes = asStringList(context.outcomes);
  draft.capsTopicCode = draft.capsTopicCode || asString(context.capsTopicCode) || undefined;
  draft.curriculum = draft.curriculum || context.curriculum;
  draft.estimatedMinutes = draft.estimatedMinutes ?? context.estimatedMinutes;
  draft.difficulty = draft.difficulty || context.difficulty;
  if (!draft.prerequisites.length) draft.prerequisites = asStringList(context.prerequisites);
  draft.institutionId = draft.institutionId || asString(context.institutionId) || undefined;
  draft.classId = draft.classId || asString(context.classId) || undefined;
  draft.cohortId = draft.cohortId || asString(context.cohortId) || undefined;
  draft.curriculumStandard = draft.curriculumStandard || asString(context.curriculumStandard) || undefined;
  draft.termWeighting = draft.termWeighting ?? context.termWeighting;
}

function absorbPracticeBands(draft: Draft, practice: unknown) {
  if (!isRecord(practice)) return;
  for (const band of ["easy", "medium", "hard"] as const) {
    for (const [index, item] of asStringList(practice[band]).entries()) {
      draft.activities.push({
        heading: `${band[0]!.toUpperCase()}${band.slice(1)} practice ${index + 1}`,
        content: item,
      });
    }
  }
}

function absorbNotes(draft: Draft, value: unknown) {
  draft.teacherNotes.push(...asStringList(value));
}

function detectSource(input: Loose): LessonSourceKind | null {
  if (input.schemaVersion === LESSON_SCHEMA_VERSION || input.schemaVersion === "2") {
    if (input.learningObjectives || input.teacherGuide || input.quickChecks || input.curriculum) {
      return "structured-v2";
    }
  }
  if (isRecord(input.sections) && Array.isArray(input.sections.explanation)) return "generated-v1";
  if (input.lessonOutline || input.extractedText || (input.activities && input.assessment && input.topic)) {
    return "legacy-json";
  }
  if (
    typeof input.version === "number" &&
    asString(input.subjectKey) &&
    Array.isArray(input.sections) &&
    Array.isArray(input.workedExamples)
  ) {
    return "lesson-v2";
  }
  if (input.learningOutcomes || input.lessonNotes) return "generator-content";
  return null;
}

function readStructured(input: Loose, draft: Draft, warnings: string[]) {
  const curriculum = isRecord(input.curriculum) ? input.curriculum : {};
  draft.id = asString(input.id) || undefined;
  draft.phase = asString(curriculum.phase) || asString(input.phase) || undefined;
  draft.grade = asNumber(curriculum.grade) ?? asNumber(input.grade) ?? undefined;
  draft.subject = asString(curriculum.subject) || asString(input.subject) || undefined;
  draft.subjectKey = asString(curriculum.subjectKey) || asString(input.subjectKey) || undefined;
  draft.term = asNumber(curriculum.term) ?? asNumber(input.term) ?? undefined;
  draft.week = asNumber(curriculum.week) ?? asNumber(input.week) ?? undefined;
  draft.topic = asString(curriculum.topic) || asString(input.topic) || undefined;
  draft.title = asString(input.title) || undefined;
  draft.summary = asString(input.summary) || undefined;
  draft.objectives = asStringList(input.learningObjectives);
  draft.outcomes = asStringList(curriculum.outcomes).concat(asStringList(input.outcomes));
  draft.capsTopicCode = asString(curriculum.capsTopicCode) || asString(input.capsTopicCode) || undefined;
  draft.curriculum = curriculumFrom(curriculum.curriculum ?? input.curriculum, "CAPS");
  draft.estimatedMinutes = asNumber(curriculum.estimatedMinutes) ?? undefined;
  draft.difficulty = difficultyFromWeek(draft.week ?? null, curriculum.difficulty);
  draft.prerequisites = asStringList(curriculum.prerequisites);
  draft.institutionId = asString(curriculum.institutionId) || undefined;
  draft.classId = asString(curriculum.classId) || undefined;
  draft.cohortId = asString(curriculum.cohortId) || undefined;
  draft.curriculumStandard = asString(curriculum.curriculumStandard) || undefined;
  draft.termWeighting = asNumber(curriculum.termWeighting) ?? undefined;
  draft.outlineBacked = input.outlineBacked === true;

  if (Array.isArray(input.keyConcepts)) {
    for (const entry of input.keyConcepts) {
      if (!isRecord(entry)) continue;
      const term = asString(entry.term);
      const definition = asString(entry.definition);
      if (term && definition) draft.concepts.push({ term, definition });
    }
  }

  if (Array.isArray(input.sections)) {
    for (const section of input.sections) {
      if (!isRecord(section)) continue;
      const heading = asString(section.heading);
      const body = asString(section.body) || asString(section.content);
      if (!heading || !body) continue;
      const kind = asString(section.kind);
      if (kind === "worked_example") draft.examples.push({ heading, content: body });
      else if (kind === "exam_tip") draft.tips.push(`${heading}: ${body}`);
      else if (kind === "activity") draft.activities.push({ heading, content: body });
      else draft.explanations.push({ heading, content: body });
    }
  }

  draft.questions = looseQuestions(input.quickChecks);
  const guide = isRecord(input.teacherGuide) ? input.teacherGuide : {};
  draft.teacherNotes.push(...asStringList(guide.notes), ...asStringList(input.teacherNotes));
  draft.citations = asStringList(input.citations);
  if (!draft.title) warnings.push("Structured lesson was missing a title; the topic was used instead.");
}

function readGeneratedV1(input: Loose, draft: Draft) {
  draft.title = asString(input.title) || undefined;
  draft.summary = asString(input.summary) || undefined;
  draft.objectives = asStringList(input.objectives);
  draft.topic = asString(input.topic) || undefined;
  const sections = isRecord(input.sections) ? input.sections : {};
  draft.explanations = headingContentList(sections.explanation);
  draft.examples = headingContentList(sections.worked_examples);
  draft.activities = headingContentList(sections.guided_practice).concat(headingContentList(sections.independent_practice));
  draft.questions = looseQuestions(input.quiz);
  absorbNotes(draft, input.teacher_notes);
  if (Array.isArray(input.citations)) {
    for (const citation of input.citations) {
      if (!isRecord(citation)) continue;
      const source = asString(citation.source_path) || asString(citation.source);
      if (!source) continue;
      const start = asNumber(citation.page_start);
      const end = asNumber(citation.page_end);
      draft.citations.push(start && end ? `${source} (pages ${start}-${end})` : source);
    }
  }
}

function readLegacy(input: Loose, draft: Draft) {
  draft.phase = asString(input.phase) || undefined;
  draft.grade = asNumber(input.grade) ?? undefined;
  draft.term = asNumber(input.term) ?? undefined;
  draft.week = asNumber(input.week) ?? undefined;
  draft.subject = asString(input.subject) || undefined;
  draft.subjectKey = asString(input.subjectKey) || undefined;
  draft.title = asString(input.title) || undefined;
  draft.topic = asString(input.topic) || undefined;
  draft.summary = asString(input.summary) || undefined;
  draft.outcomes = asStringList(input.outcomes);
  draft.objectives = asStringList(input.outcomes);
  const explanation = asString(input.explanation);
  if (explanation) draft.explanations.push({ heading: "Explanation", content: explanation });
  const extracted = asString(input.extractedText);
  if (extracted) draft.explanations.push({ heading: "From the source text", content: extracted });
  asStringList(input.lessonOutline).forEach((item, index) => {
    draft.explanations.push({ heading: `Outline ${index + 1}`, content: item });
  });
  asStringList(input.workedExamples).forEach((item, index) => {
    draft.examples.push({ heading: `Worked example ${index + 1}`, content: item });
  });
  asStringList(input.activities).forEach((item, index) => {
    draft.activities.push({ heading: `Activity ${index + 1}`, content: item });
  });
  draft.tips.push(...asStringList(input.assessment));
  absorbPracticeBands(draft, input.practice);
  draft.questions = looseQuestions(input.quiz);
  absorbNotes(draft, input.teacherNotes ?? input.teacher_notes);
  draft.capsTopicCode = asString(input.capsTopicCode) || asString(input.caps_topic_code) || undefined;
  if (Array.isArray(input.resources)) {
    for (const resource of input.resources) {
      if (!isRecord(resource)) continue;
      const title = asString(resource.title) || asString(resource.label);
      const source = asString(resource.sourcePdfPath) || asString(resource.href);
      if (title && source) draft.citations.push(`${title} — ${source}`);
      else if (title || source) draft.citations.push(title || source || "");
    }
  }
}

function readLessonV2(input: Loose, draft: Draft) {
  draft.id = asString(input.id) || undefined;
  draft.phase = asString(input.phase) || undefined;
  draft.grade = asNumber(input.grade) ?? undefined;
  draft.subjectKey = asString(input.subjectKey) || undefined;
  draft.term = asNumber(input.term) ?? undefined;
  draft.week = asNumber(input.week) ?? undefined;
  draft.title = asString(input.title) || undefined;
  draft.topic = asString(input.topic) || undefined;
  draft.summary = asString(input.summary) || undefined;
  draft.outcomes = asStringList(input.outcomes);
  draft.objectives = asStringList(input.outcomes);
  draft.explanations = headingContentList(input.sections);
  asStringList(input.workedExamples).forEach((item, index) => {
    draft.examples.push({ heading: `Worked example ${index + 1}`, content: item });
  });
  absorbPracticeBands(draft, input.practice);
  draft.questions = looseQuestions(input.quiz);
  absorbNotes(draft, input.teacherNotes);
  if (Array.isArray(input.resources)) {
    for (const resource of input.resources) {
      if (typeof resource === "string") {
        const text = asString(resource);
        if (text) draft.citations.push(text);
        continue;
      }
      if (!isRecord(resource)) continue;
      const label = asString(resource.label) || asString(resource.title);
      const href = asString(resource.href) || asString(resource.sourcePdfPath);
      if (label && href) draft.citations.push(`${label} — ${href}`);
    }
  }
}

function readGenerator(input: Loose, draft: Draft) {
  draft.title = asString(input.title) || undefined;
  draft.topic = asString(input.topic) || undefined;
  draft.summary = asString(input.summary) || undefined;
  draft.objectives = asStringList(input.learningOutcomes);
  draft.outcomes = asStringList(input.learningOutcomes);
  draft.explanations = headingContentList(input.lessonNotes);
  asStringList(input.workedExamples).forEach((item, index) => {
    draft.examples.push({ heading: `Worked example ${index + 1}`, content: item });
  });
  absorbPracticeBands(draft, input.practice);
  draft.questions = looseQuestions(input.quiz);
  absorbNotes(draft, input.teacherNotes);
  if (Array.isArray(input.citations)) {
    for (const citation of input.citations) {
      if (typeof citation === "string") {
        const text = asString(citation);
        if (text) draft.citations.push(text);
        continue;
      }
      if (!isRecord(citation)) continue;
      const source = asString(citation.source) || asString(citation.source_path) || asString(citation.label);
      if (source) draft.citations.push(source);
    }
  }
}

function bulletLines(summary: string) {
  return summary
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 12 && !/^this week builds/i.test(line));
}

function finalize(draft: Draft, warnings: string[]): StructuredLesson {
  if (draft.outlineBacked && !draft.explanations.length && draft.summary) {
    const bullets = bulletLines(draft.summary);
    draft.explanations.push({ heading: "This week's focus", content: draft.summary });
    bullets.forEach((bullet) => {
      const heading = bullet.split(/[.!?]/)[0]?.trim().slice(0, 64) || "Practice task";
      draft.activities.push({ heading, content: bullet });
    });
  }

  const phase = slug(draft.phase || "foundation") || "foundation";
  const grade = clampInt(draft.grade ?? 0, 0, 12, 0);
  const term = clampInt(draft.term ?? 1, 1, 4, 1);
  const week = clampInt(draft.week ?? 1, 1, 53, 1);
  const subject = draft.subject || "Subject";
  const subjectKey = slug(draft.subjectKey || subject) || "subject";
  const topic = draft.topic && !/^placeholder\b/i.test(draft.topic)
    ? draft.topic
    : draft.title || `${subject} · Term ${term} · Week ${week}`;
  const placeholderTopic = !draft.topic || /^placeholder\b/i.test(draft.topic);
  if (placeholderTopic && draft.outlineBacked) {
    warnings.push("Outline topic is still a placeholder; the lesson uses the subject, term, and week.");
  }

  const summary =
    draft.summary ||
    (draft.outlineBacked
      ? `${subject}, Term ${term}, Week ${week} is on the curriculum outline as “${topic}”. Use this frame to teach or study that focus, then practise it.`
      : `Study ${topic} in ${subject}.`);

  const objectives = draft.objectives.length
    ? draft.objectives
    : draft.outcomes.length
      ? draft.outcomes
      : [
          `Explain ${topic} in your own words.`,
          `Work one example of ${topic} and name each step.`,
          `Answer one exam-style question on ${topic} and check your reasoning.`,
        ];

  const outcomes = draft.outcomes.length ? draft.outcomes : objectives;
  const minutes = clampInt(draft.estimatedMinutes ?? (summary.length > 700 ? 50 : 40), 10, 120, 40);
  const difficulty = draft.difficulty || difficultyFromWeek(week);
  const prerequisites =
    draft.prerequisites.length > 0
      ? draft.prerequisites
      : week > 1
        ? [`Term ${term}, Week ${week - 1}`]
        : [];

  const explanations = draft.explanations.length
    ? draft.explanations
    : [
        {
          heading: "What this week is for",
          content: summary,
        },
        {
          heading: "How to approach the work",
          content: [
            `Start by saying what ${topic} is asking you to notice.`,
            "Work one short example out loud before you try a question on your own.",
            "When you get stuck, name the step you are on instead of starting again from the top.",
          ].join(" "),
        },
      ];

  const examples = draft.examples.length
    ? draft.examples
    : [
        {
          heading: `Worked example: ${topic}`,
          content: [
            "Step 1: Read the question and underline what is given.",
            `Step 2: Name the part of ${topic} that applies.`,
            "Step 3: Carry out one step at a time and write the reason.",
            "Step 4: Check the result answers the question that was asked.",
          ].join("\n"),
        },
      ];

  const tips = draft.tips.length
    ? draft.tips
    : [
        `In an exam, show the step that uses ${topic}. A bare final answer does not show the method.`,
      ];

  let sectionCounter = 0;
  const sections: LessonSection[] = [];
  for (const section of explanations) {
    sectionCounter += 1;
    sections.push({
      id: `explanation-${sectionCounter}`,
      kind: "explanation",
      heading: section.heading,
      body: section.content,
    });
  }
  examples.forEach((example, index) => {
    sections.push({
      id: `example-${index + 1}`,
      kind: "worked_example",
      heading: example.heading,
      body: example.content,
      steps: toSteps(example.content),
    });
  });
  draft.activities.forEach((activity, index) => {
    sections.push({
      id: `activity-${index + 1}`,
      kind: "activity",
      heading: activity.heading,
      body: activity.content,
    });
  });
  tips.forEach((tip, index) => {
    const [maybeHeading, ...rest] = tip.split(": ");
    const hasHeading = rest.length > 0 && (maybeHeading?.length ?? 0) < 48;
    sections.push({
      id: `tip-${index + 1}`,
      kind: "exam_tip",
      heading: hasHeading ? maybeHeading! : `Exam tip ${index + 1}`,
      body: hasHeading ? rest.join(": ") : tip,
    });
  });

  const concepts = uniqueConcepts([
    ...draft.concepts,
    ...explanations.slice(0, 4).map((section) => ({
      term: section.heading,
      definition: firstSentence(section.content),
    })),
  ]);
  if (!concepts.length) {
    concepts.push({ term: topic, definition: firstSentence(summary) });
  }

  let questions = draft.questions.slice(0, 6);
  if (!questions.length) {
    const focus = bulletLines(summary)[0] || `Focus on ${topic}`;
    questions = [
      {
        id: "check-focus",
        kind: "mcq",
        prompt: "Which statement matches the focus of this lesson?",
        options: [
          focus,
          "Skip the topic and only copy a glossary.",
          "Revise an unrelated exam timetable.",
        ],
        answer: focus,
        explanation: `This lesson is about ${topic}. ${focus}`,
      },
      {
        id: "check-method",
        kind: "mcq",
        prompt: "What should you do first when you start an example?",
        options: [
          "Read the question and underline what is given.",
          "Write the final answer immediately.",
          "Skip the example and open a past paper.",
        ],
        answer: "Read the question and underline what is given.",
        explanation: "Naming the given information keeps the method attached to the question.",
      },
    ];
  }

  const quickChecks: LessonQuickCheck[] = questions.map((question, index) => ({
    id: question.id || `check-${index + 1}`,
    kind: question.kind,
    prompt: question.prompt,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
  }));

  const discussion = draft.teacherNotes.filter((note) => /discuss|ask |prompt|learners could/i.test(note));
  const misconceptions = draft.teacherNotes.filter((note) => /misconception|common error|often (think|confuse|mix)/i.test(note));
  const notes = draft.teacherNotes.filter((note) => !discussion.includes(note) && !misconceptions.includes(note));

  const teacherGuide: LessonTeacherGuide = {
    pacing: pacingFor(minutes),
    discussionPrompts: discussion.length
      ? discussion.slice(0, 4)
      : [
          `Where might learners meet ${topic} outside this example?`,
          `Which part of ${topic} should the class say back in their own words before independent work?`,
        ],
    misconceptions: misconceptions.length
      ? misconceptions.slice(0, 4)
      : [`Learners may memorise a line about ${topic} and still be unable to apply it to a new question.`],
    boardExamples: examples.slice(0, 3).map((example) => example.heading),
    notes: notes.slice(0, 8),
  };

  const id =
    draft.id ||
    buildLessonId({
      phase,
      grade,
      subjectKey,
      term,
      week,
    });

  const curriculum: LessonCurriculum = {
    curriculum: draft.curriculum || "CAPS",
    phase,
    grade,
    subject,
    subjectKey,
    term,
    week,
    topic,
    outcomes,
    estimatedMinutes: minutes,
    difficulty,
    prerequisites,
  };
  if (draft.capsTopicCode) curriculum.capsTopicCode = draft.capsTopicCode;
  if (draft.institutionId) curriculum.institutionId = draft.institutionId;
  if (draft.classId) curriculum.classId = draft.classId;
  if (draft.cohortId) curriculum.cohortId = draft.cohortId;
  if (draft.curriculumStandard) curriculum.curriculumStandard = draft.curriculumStandard;
  if (typeof draft.termWeighting === "number") curriculum.termWeighting = draft.termWeighting;

  return {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id,
    curriculum,
    title: draft.title || topic,
    summary,
    learningObjectives: objectives,
    keyConcepts: concepts,
    sections,
    quickChecks,
    teacherGuide,
    practice: buildPracticeLinks({ subject, grade, topic }),
    citations: draft.citations,
    ...(draft.video ? { video: draft.video } : {}),
    outlineBacked: draft.outlineBacked,
  };
}

export function normalizeLesson(input: unknown, context: LessonNormalizeContext = {}): NormalizeLessonResult {
  const warnings: string[] = [];
  const draft = emptyDraft();

  if (!isRecord(input)) {
    draft.outlineBacked = true;
    if (input !== null && input !== undefined) {
      warnings.push("Lesson payload was not an object and was replaced from the outline context.");
    }
    applyContext(draft, context);
    return { lesson: finalize(draft, warnings), source: "scaffold", warnings };
  }

  const source = detectSource(input);
  if (source === "structured-v2") readStructured(input, draft, warnings);
  else if (source === "generated-v1") readGeneratedV1(input, draft);
  else if (source === "legacy-json") readLegacy(input, draft);
  else if (source === "lesson-v2") readLessonV2(input, draft);
  else if (source === "generator-content") readGenerator(input, draft);
  else {
    draft.outlineBacked = true;
    draft.title = asString(input.title) || undefined;
    draft.topic = asString(input.topic) || asString(input.topic_title) || undefined;
    draft.summary = asString(input.summary) || asString(input.summary_md) || undefined;
    warnings.push("Lesson shape was not recognised; a study frame was built from the available fields.");
  }

  if (!draft.video) draft.video = readLessonVideo(input.video);
  applyContext(draft, context);
  if (!source) draft.outlineBacked = true;
  return {
    lesson: finalize(draft, warnings),
    source: source ?? "scaffold",
    warnings,
  };
}
