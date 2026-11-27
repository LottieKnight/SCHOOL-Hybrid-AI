import "server-only";

import { readGeneratedLesson } from "@saedu/shared";
import { readLessonJsonSafe } from "@/lib/server/lessonContent";
import { normalizeLesson, type LessonNormalizeContext, type NormalizeLessonResult } from "./schema";

export function resolveStructuredLesson(context: LessonNormalizeContext & {
  language?: string;
}): NormalizeLessonResult {
  const phase = context.phase || "";
  const grade = context.grade ?? 0;
  const subjectKey = context.subjectKey || context.subject || "";
  const term = context.term ?? 1;
  const week = context.week ?? 1;
  const warnings: string[] = [];

  if (phase && subjectKey) {
    try {
      const generated = readGeneratedLesson({
        phase,
        grade,
        subjectKey,
        term,
        week,
        language: context.language,
      });
      if (generated) {
        return normalizeLesson(generated, context);
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Generated lesson could not be read.");
    }
  }

  const legacy = readLessonJsonSafe({
    gradeKey: String(grade),
    subjectKey,
    termKey: String(term),
    weekNumber: week,
  });
  if (legacy) {
    const normalized = normalizeLesson(legacy, context);
    return { ...normalized, warnings: [...warnings, ...normalized.warnings] };
  }

  const scaffold = normalizeLesson(
    {
      topic: context.topic,
      summary: context.summary,
      outcomes: context.outcomes,
    },
    context
  );
  return { ...scaffold, warnings: [...warnings, ...scaffold.warnings] };
}
