export type PlannerEventType =
  | "semester_boundary"
  | "exam"
  | "class"
  | "assignment_due"
  | "campus_event"
  | "public_holiday"
  | "recess"
  | "personal";

export type PlannerEventTier = "tier1" | "tier2" | "tier3" | "manual";

export type UniversityStudentSystem = "campusnexus" | "peoplesoft" | "moodle" | "its" | "other";

export type PlannerSourceType = "pdf_parsed" | "html_scraped" | "ical" | "manual" | "api";

export type UniversityRecord = {
  id: string;
  name: string;
  shortCode: string;
  country: string;
  studentSystem: UniversityStudentSystem;
  calendarUrl: string | null;
  examTimetableUrl: string | null;
  classTimetableUrl: string | null;
  yearbookUrl: string | null;
  portalUrl: string | null;
  isActive: boolean;
};

export type UniversityCampusRecord = {
  id: string;
  universityId: string;
  campusName: string;
  campusCode: string;
  city: string | null;
  province: string | null;
  isPrimary: boolean;
};

export type StudentUniversityProfileRecord = {
  id: string;
  studentId: string;
  universityId: string;
  campusId: string | null;
  faculty: string | null;
  yearOfStudy: number | null;
  qualification: string | null;
  studentNumber: string | null;
  onboardingCompleted: boolean;
  tier2Activated: boolean;
  tier3Activated: boolean;
};

export type EnrolledModuleRecord = {
  id: string;
  studentId: string;
  universityId: string;
  campusId: string | null;
  moduleCode: string;
  moduleName: string | null;
  year: number;
  semester: number | null;
  credits: number | null;
  isActive: boolean;
};

export type EnrolledModuleInput = {
  moduleCode: string;
  moduleName?: string | null;
  semester?: 1 | 2 | "both" | null;
  credits?: number | null;
};

export type StudentPlannerEventRecord = {
  id: string;
  studentId: string;
  title: string;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  eventType: PlannerEventType;
  tier: PlannerEventTier;
  sourceRefId: string | null;
  sourceTable: string | null;
  universityId: string | null;
  moduleCode: string | null;
  isManual: boolean;
  isDismissed: boolean;
  colourTag: string | null;
};

export type PlannerCalendarDay = {
  isoDate: string;
  dayLabel: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isExamDay: boolean;
  isPublicHoliday: boolean;
  events: StudentPlannerEventRecord[];
};

export type PlannerCalendarMonth = {
  monthLabel: string;
  weeks: PlannerCalendarDay[][];
};

export type PendingTimetableSyncPayload = {
  universityId: string;
  campusId: string | null;
  year: number;
  modules: Array<{
    moduleCode: string;
    moduleName: string | null;
    semester: 1 | 2;
  }>;
};
