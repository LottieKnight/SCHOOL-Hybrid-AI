import { getAuthToken } from "../auth/tokenStore";
import { apiClient } from "./client";

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

  return (await response.json()) as T;
}

export async function recordQuizAttempt(params: {
  subject: string;
  grade: number;
  lessonKey: string;
  topicTag?: string;
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  }) {
  const response = await apiClient.post("/lessons/quiz/attempt", params);
  return response.data as { attempt: unknown; bias: unknown };
}

export type DailyQuizQuestion = {
  id: string;
  question_text: string;
  difficulty: number;
  subject: string;
};

export type DailyQuizReadyResponse = {
  completed?: false;
  quizId: string;
  date: string;
  questions: DailyQuizQuestion[];
  weaknessSubjects: string[];
  streak: number;
};

export type DailyQuizCompletedResponse = {
  completed: true;
  date: string;
  score: number;
  streak: number;
};

export type DailyQuizResponse = DailyQuizReadyResponse | DailyQuizCompletedResponse;

export type DailyQuizSubmitResponse = {
  score: number;
  scorePercent: number;
  answers: Array<{
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation?: string;
  }>;
  newStreak: number;
  streakBroken: boolean;
};

export type QuizHeatmapDay = {
  date: string;
  score: number | null;
};

export type QuizHeatmapResponse = {
  weeks: QuizHeatmapDay[][];
  activity: Array<{
    quiz_date: string;
    questions_correct: number;
    questions_total: number;
  }>;
};

export async function fetchDailyQuiz() {
  return webFetch<DailyQuizResponse>("/api/quiz/daily");
}

export async function submitDailyQuiz(params: {
  quizId?: string;
  date: string;
  answers: Record<string, string>;
}) {
  return webFetch<DailyQuizSubmitResponse>("/api/quiz/submit", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchQuizHeatmap() {
  return webFetch<QuizHeatmapResponse>("/api/quiz/heatmap");
}
