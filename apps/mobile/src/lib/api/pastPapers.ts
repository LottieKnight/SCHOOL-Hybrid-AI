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
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type PastPaperListItem = {
  id: string;
  title: string;
  subject: string;
  grade: number | null;
  year: number | null;
  session: string;
  paperNumber: string;
  language: string;
  hasMemo: boolean;
  institutionType: string | null;
  moduleCode: string | null;
};

export type PastPaperFilters = {
  grades: number[];
  subjects: string[];
  years: number[];
};

export type PastPaperDetail = {
  id: string;
  title: string;
  subject: string;
  grade: number | null;
  year: number | null;
  session: string;
  paperNumber: string;
  language: string;
  totalMarks: number | null;
  durationMinutes: number | null;
  hasMemo: boolean;
  paperUrl: string | null;
  memoUrl: string | null;
};

export async function fetchPastPaperFilters() {
  return webFetch<PastPaperFilters>("/api/past-papers/filters");
}

export async function fetchPastPaperList(params: {
  grade?: number;
  subject?: string;
  year?: number;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (typeof params.grade === "number") searchParams.set("grade", String(params.grade));
  if (params.subject) searchParams.set("subject", params.subject);
  if (typeof params.year === "number") searchParams.set("year", String(params.year));
  if (typeof params.page === "number") searchParams.set("page", String(params.page));
  if (typeof params.limit === "number") searchParams.set("limit", String(params.limit));

  return webFetch<{ items: PastPaperListItem[]; total: number; page: number; pageSize: number }>(
    `/api/past-papers/list?${searchParams.toString()}`
  );
}

export async function fetchPastPaperDetail(paperId: string) {
  return webFetch<PastPaperDetail>(`/api/past-papers/${paperId}`);
}
