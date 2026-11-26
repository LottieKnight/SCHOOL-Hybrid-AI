export type CalendarFormat = "term" | "semester" | "trimester" | "quarter";

export type AcademicPeriod = {
  format: CalendarFormat;
  periodNumber: number;
  weekNumber: number;
  label: string;
  periodLabel: string;
  year: number;
};

export type AcademicPeriodWindow = {
  format: CalendarFormat;
  periodNumber: number;
  periodLabel: string;
  shortLabel: string;
  year: number;
  startDate: Date;
  endDate: Date;
  weekCount: number;
};

type ScheduleDefinition = {
  periodPrefix: string;
  periodLabelPrefix: string;
  startMonths: number[];
  weekCounts: number[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

const SCHEDULES: Record<CalendarFormat, ScheduleDefinition> = {
  term: {
    periodPrefix: "Term",
    periodLabelPrefix: "Term",
    startMonths: [0, 3, 6, 9],
    weekCounts: [10, 9, 9, 8],
  },
  semester: {
    periodPrefix: "Sem",
    periodLabelPrefix: "Semester",
    startMonths: [1, 6],
    weekCounts: [18, 18],
  },
  trimester: {
    periodPrefix: "Tri",
    periodLabelPrefix: "Trimester",
    startMonths: [0, 4, 8],
    weekCounts: [13, 13, 13],
  },
  quarter: {
    periodPrefix: "Q",
    periodLabelPrefix: "Quarter",
    startMonths: [0, 3, 6, 9],
    weekCounts: [13, 13, 13, 13],
  },
};

function atStartOfDay(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), input.getDate());
}

function addDays(input: Date, days: number) {
  return new Date(input.getTime() + days * MS_PER_DAY);
}

function firstMondayOfMonth(year: number, monthIndex: number) {
  const candidate = new Date(year, monthIndex, 1);
  const day = candidate.getDay();
  const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  return addDays(candidate, delta);
}

function buildWindow(
  format: CalendarFormat,
  year: number,
  periodIndex: number,
  definition: ScheduleDefinition
): AcademicPeriodWindow {
  const periodNumber = periodIndex + 1;
  const startDate = firstMondayOfMonth(year, definition.startMonths[periodIndex] ?? 0);
  const weekCount = definition.weekCounts[periodIndex] ?? 0;
  const endDate = new Date(startDate.getTime() + weekCount * MS_PER_WEEK);
  const shortLabel =
    format === "quarter"
      ? `${definition.periodPrefix}${periodNumber}`
      : `${definition.periodPrefix} ${periodNumber}`;
  const periodLabel = `${definition.periodLabelPrefix} ${periodNumber}`;

  return {
    format,
    periodNumber,
    periodLabel,
    shortLabel,
    year,
    startDate,
    endDate,
    weekCount,
  };
}

export function getAcademicSchedule(format: CalendarFormat, year: number): AcademicPeriodWindow[] {
  const definition = SCHEDULES[format];
  return definition.startMonths.map((_, periodIndex) => buildWindow(format, year, periodIndex, definition));
}

function toAcademicPeriod(window: AcademicPeriodWindow, weekNumber: number, year = window.year): AcademicPeriod {
  return {
    format: window.format,
    periodNumber: window.periodNumber,
    weekNumber,
    label: `${window.shortLabel} \u00B7 Week ${weekNumber}`,
    periodLabel: window.periodLabel,
    year,
  };
}

export function getCurrentPeriod(format: CalendarFormat, referenceDate = new Date()): AcademicPeriod {
  const today = atStartOfDay(referenceDate);
  const currentYear = today.getFullYear();
  const currentSchedule = getAcademicSchedule(format, currentYear);

  for (let index = 0; index < currentSchedule.length; index += 1) {
    const window = currentSchedule[index];
    const nextWindow = currentSchedule[index + 1] ?? null;

    if (today < window.startDate) {
      return toAcademicPeriod(window, 0);
    }

    if (today >= window.startDate && today < window.endDate) {
      const diffWeeks = Math.floor((today.getTime() - window.startDate.getTime()) / MS_PER_WEEK);
      return toAcademicPeriod(window, Math.max(1, diffWeeks + 1));
    }

    if (nextWindow && today >= window.endDate && today < nextWindow.startDate) {
      return toAcademicPeriod(nextWindow, 0);
    }
  }

  const nextYearSchedule = getAcademicSchedule(format, currentYear + 1);
  return toAcademicPeriod(nextYearSchedule[0], 0, currentYear + 1);
}

export function formatAcademicDateRange(startDate: Date, endDate: Date) {
  const startLabel = startDate.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth();
  const endLabel = endDate.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  return `${startLabel} \u2013 ${endLabel}`;
}
