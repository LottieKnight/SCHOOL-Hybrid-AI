import { checkAiRateLimit } from "../../../../lib/aiRateLimit";
import { getBackendSessionFromRequest } from "../../../../lib/server/backendSession";
import { readLessonJson } from "../../../../lib/server/lessonContent";
import { loadModuleDetail } from "../../../../lib/server/moduleContent";
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE && process.env.OPENAI_API_BASE.trim().length > 0
    ? process.env.OPENAI_API_BASE.replace(/\/+$/, "")
    : "https://api.openai.com/v1";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim().length > 0
    ? process.env.OPENAI_MODEL
    : "gpt-4o-mini";

export const runtime = "nodejs";

type Flashcard = {
  front: string;
  back: string;
};

type FlashcardRequestBody = {
  text?: unknown;
  moduleCode?: unknown;
  chapterId?: unknown;
  count?: unknown;
};

type LessonContent = {
  title?: string;
  summary: string;
  outcomes?: string[];
  explanation?: string;
  workedExamples?: string[];
  lessonOutline?: string[];
  activities?: string[];
  assessment?: string[];
  memo?: string[];
  teacherNotes?: string[];
  resources?: Array<{
    title: string;
    note?: string;
    pageRefs?: string;
  }>;
  quiz: {
    questions: Array<{
      prompt: string;
      options?: string[];
      answer: string;
      explanation: string;
    }>;
  };
};

function clampCount(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(12, Math.max(5, Math.round(parsed)));
}

function parseChapterId(input: unknown) {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const text = String(input).trim();
  if (!text) return null;
  return text;
}

function formatSection(title: string, values: string[]) {
  if (!values.length) return null;
  return `${title}:\n- ${values.join("\n- ")}`;
}

function formatDefinitions(definitions: Array<{ term: string; definition: string }>) {
  if (!definitions.length) return null;
  return `Definitions:\n- ${definitions.map((definition) => `${definition.term}: ${definition.definition}`).join("\n- ")}`;
}

function buildLessonLookup(moduleCode: string, chapterId: string | null) {
  const chapterNumber = Number.parseInt(chapterId ?? "", 10);
  const gradeMatch = moduleCode.trim().match(/(\d)(\d{2})$/);
  const grade = gradeMatch ? gradeMatch[1] : "2";
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) return null;
  return {
    gradeKey: grade,
    subjectKey: moduleCode.trim().toLowerCase(),
    termKey: "1",
    weekNumber: chapterNumber,
  };
}

function formatLessonSource(lesson: LessonContent) {
  const sections: string[] = [];
  sections.push(`Lesson title: ${lesson.title ?? lesson.summary}`);
  sections.push(`Summary: ${lesson.summary}`);
  if (lesson.outcomes?.length) sections.push(`Outcomes:\n- ${lesson.outcomes.join("\n- ")}`);
  if (lesson.explanation) sections.push(`Explanation:\n${lesson.explanation}`);
  if (lesson.workedExamples?.length) sections.push(`Worked examples:\n- ${lesson.workedExamples.join("\n- ")}`);
  if (lesson.lessonOutline?.length) sections.push(`Lesson outline:\n- ${lesson.lessonOutline.join("\n- ")}`);
  if (lesson.activities?.length) sections.push(`Activities:\n- ${lesson.activities.join("\n- ")}`);
  if (lesson.assessment?.length) sections.push(`Assessment:\n- ${lesson.assessment.join("\n- ")}`);
  if (lesson.memo?.length) sections.push(`Memo:\n- ${lesson.memo.join("\n- ")}`);
  if (lesson.teacherNotes?.length) sections.push(`Teacher notes:\n- ${lesson.teacherNotes.join("\n- ")}`);
  if (lesson.resources?.length) {
    sections.push(
      `Resources:\n- ${lesson.resources
        .map((resource) => [resource.title, resource.pageRefs, resource.note].filter(Boolean).join(" · "))
        .join("\n- ")}`
    );
  }
  if (lesson.quiz.questions.length) {
    sections.push(
      `Quiz prompts:\n- ${lesson.quiz.questions
        .map((question) => `${question.prompt}${question.options?.length ? ` [${question.options.join(" | ")}]` : ""}`)
        .join("\n- ")}`
    );
  }
  return sections.join("\n\n");
}

function buildModuleSource(moduleCode: string, chapterId: string | null) {
  const detail = loadModuleDetail(moduleCode);
  if (!detail) return null;

  const sections: string[] = [];
  sections.push(`Module: ${detail.moduleCode} — ${detail.moduleName}`);
  if (detail.institution) sections.push(`Institution: ${detail.institution}`);
  if (detail.semester) sections.push(`Semester: ${detail.semester}`);
  if (detail.programme) sections.push(`Programme: ${detail.programme}`);
  if (detail.studyUnits.length) sections.push(`Study units:\n- ${detail.studyUnits.join("\n- ")}`);
  if (detail.keyTopics.length) sections.push(`Key topics:\n- ${detail.keyTopics.join("\n- ")}`);
  if (detail.quizSignals.length) sections.push(`Quiz signals:\n- ${detail.quizSignals.join("\n- ")}`);

  const selectedChapterId = chapterId?.trim().toLowerCase() ?? "";
  const selectedChapter = selectedChapterId
    ? detail.chapters.find((chapter) => chapter.id.toLowerCase() === selectedChapterId) ?? null
    : null;

  const chapterList = selectedChapter ? [selectedChapter] : detail.chapters;
  if (chapterList.length) {
    sections.push(
      chapterList
        .map((chapter) => {
          const chapterSections: string[] = [`Chapter: ${chapter.id} — ${chapter.title}`];
          if (chapter.summary) chapterSections.push(`Chapter summary: ${chapter.summary}`);
          const chapterOutcomes = formatSection("Chapter outcomes", chapter.outcomes);
          if (chapterOutcomes) chapterSections.push(chapterOutcomes);
          const chapterFormulas = formatSection("Chapter formulas", chapter.formulas);
          if (chapterFormulas) chapterSections.push(chapterFormulas);
          const chapterDefinitions = formatDefinitions(chapter.definitions);
          if (chapterDefinitions) chapterSections.push(chapterDefinitions);
          const revisionPrompts = formatSection("Revision prompts", chapter.revisionPrompts);
          if (revisionPrompts) chapterSections.push(revisionPrompts);
          if (chapter.saContext) chapterSections.push(`South African context:\n${chapter.saContext}`);
          return chapterSections.join("\n\n");
        })
        .join("\n\n")
    );
  }

  const lessonLookup = buildLessonLookup(moduleCode, selectedChapterId || chapterId);
  if (lessonLookup) {
    const lesson = readLessonJson(lessonLookup);
    if (lesson) {
      sections.push(formatLessonSource(lesson as LessonContent));
    }
  }

  return sections.join("\n\n");
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateCheck = await checkAiRateLimit(session.user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many AI requests. Please wait a moment before trying again." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: FlashcardRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestedCount = clampCount(body.count);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const moduleCode = typeof body.moduleCode === "string" ? body.moduleCode.trim() : "";
  const chapterId = parseChapterId(body.chapterId);

  let sourceText = text;
  if (!sourceText && moduleCode) {
    sourceText = buildModuleSource(moduleCode, chapterId) ?? "";
  }

  if (!sourceText || sourceText.length < 10) {
    return NextResponse.json(
      { error: "Please provide module content or a short paragraph of text to generate flashcards." },
      { status: 400 }
    );
  }

  const messages = [
    {
      role: "system" as const,
      content: `
You are a master educator. Create a JSON array of effective flashcards from the provided material.
Each flashcard must have a 'front' (the question or concept) and a 'back' (the answer or explanation).

Rules:
- Create exactly ${requestedCount} flashcards if the material supports it. If the material is narrow, create between 5 and ${requestedCount}.
- Ensure the questions are clear and the answers are concise but complete.
- Respond ONLY with a valid JSON array. Do not include markdown blocks or commentary.
`.trim(),
    },
    {
      role: "user" as const,
      content: sourceText.trim().slice(0, 10000),
    },
  ];

  try {
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider responded with status ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!rawContent) {
      throw new Error("AI provider returned an empty response.");
    }

    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const flashcards = JSON.parse(cleaned) as Flashcard[];

    if (!Array.isArray(flashcards)) {
      throw new Error("AI did not return an array of flashcards.");
    }

    const cards = flashcards
      .filter((card): card is Flashcard => Boolean(card && typeof card.front === "string" && typeof card.back === "string"))
      .slice(0, requestedCount);

    return NextResponse.json({ cards, flashcards: cards });
  } catch (error) {
    console.error("Flashcard generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate flashcards. Please try again." },
      { status: 502 }
    );
  }
}
