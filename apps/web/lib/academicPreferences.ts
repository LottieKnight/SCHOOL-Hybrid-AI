import type { CalendarFormat } from "@/lib/academicPeriod";

export const CALENDAR_FORMAT_STORAGE_KEY = "school:calendar-format";

export type AcademicPreferences = {
  calendarFormat?: CalendarFormat;
  schoolGrade?: string;
  schoolPhase?: string;
  schoolSubjectKeys?: string[];
};

type ProfilePayload = {
  profile?: {
    appPreferences?: Record<string, unknown>;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function normalizeCalendarFormat(value: unknown): CalendarFormat | undefined {
  return value === "term" || value === "semester" || value === "trimester" || value === "quarter"
    ? value
    : undefined;
}

export function readAcademicPreferences(payload: ProfilePayload | null | undefined): AcademicPreferences {
  const appPreferences = asRecord(payload?.profile?.appPreferences);
  const academics = asRecord(appPreferences.academics);
  const schoolSubjectKeys = Array.isArray(academics.schoolSubjectKeys)
    ? academics.schoolSubjectKeys.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : undefined;

  return {
    calendarFormat: normalizeCalendarFormat(academics.calendarFormat),
    schoolGrade:
      typeof academics.schoolGrade === "string" && academics.schoolGrade.trim().length > 0
        ? academics.schoolGrade
        : undefined,
    schoolPhase:
      typeof academics.schoolPhase === "string" && academics.schoolPhase.trim().length > 0
        ? academics.schoolPhase
        : undefined,
    schoolSubjectKeys,
  };
}

export function buildAcademicPreferencesPatch(
  current: Record<string, unknown> | null | undefined,
  patch: AcademicPreferences
) {
  const appPreferences = asRecord(current);
  const academics = asRecord(appPreferences.academics);

  return {
    ...appPreferences,
    academics: {
      ...academics,
      ...patch,
    },
  };
}
