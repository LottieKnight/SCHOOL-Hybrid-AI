export const UNKNOWN_SUBJECT = "Unknown";

export function buildPastPaperWhere(includeIncomplete = false) {
  const base = {
    paperStorageKey: { not: null },
  };

  if (includeIncomplete) {
    return base;
  }

  return {
    ...base,
    grade: { not: null },
    year: { not: null },
    subject: { not: UNKNOWN_SUBJECT },
  };
}

export function isUiReadyRecord(input: { grade: number | null; year: number | null; subject: string; paperStorageKey: string | null }) {
  return Boolean(input.paperStorageKey && input.grade !== null && input.year !== null && input.subject !== UNKNOWN_SUBJECT);
}
