import { getAuthToken } from "../auth/tokenStore";

const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://school.ditshego-ventures.co.za";

async function webFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${webBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.error === "string" ? body.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export type OnboardingStudyType = "school" | "university";

export type OnboardingModulePlanEntry = {
  code: string;
  name: string;
  semester?: 1 | 2 | "both" | null;
  yearOfStudy: number;
  credits?: number | null;
  isCore?: boolean | null;
  durationType?: "semester" | "year" | null;
  durationLabel?: string | null;
  assumed?: boolean;
  source?: string;
};

export type OnboardingPayload = {
  studyType: OnboardingStudyType;
  grade?: number | null;
  phase?: string | null;
  institutionId?: string | null;
  plannerUniversityId?: string | null;
  institution?: string | null;
  campus?: string | null;
  campusId?: string | null;
  academicPeriodType?: "term" | "semester" | "trimester" | "quarter" | null;
  yearOfStudy?: number | null;
  faculty?: string | null;
  course?: string | null;
  qualification?: string | null;
  courseId?: string | null;
  courseCode?: string | null;
  studentNumber?: string | null;
  subjects: string[];
  selectedSubjectLabels?: string[];
  subjectKeys?: string[];
  modulePlan: OnboardingModulePlanEntry[];
  examDates: Array<{ subject: string; date: string }>;
  personalisation?: {
    studyStyle?: "visual" | "text" | "mixed" | "";
    bestStudyTime?: "morning" | "afternoon" | "evening" | "night" | "";
  };
};

export async function completeOnboarding(payload: OnboardingPayload) {
  return webFetch<{ success: boolean }>("/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
