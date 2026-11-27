import { readLessonJson } from "@saedu/shared";

export { readLessonJson };

/** Legacy files that fail the strict lesson schema should not take down a route. */
export function readLessonJsonSafe(input: Parameters<typeof readLessonJson>[0]) {
  try {
    return readLessonJson(input);
  } catch {
    return null;
  }
}
export type { LessonJsonLookup, LessonContent } from "@saedu/shared";
