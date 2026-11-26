import { apiClient } from "./client";

export type MobileUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  studyType?: "school" | "university" | null;
  grade?: number | null;
  phase?: string | null;
  institutionName?: string | null;
  institutionShortName?: string | null;
  course?: string | null;
};

export type AuthAccess = {
  isLocked?: boolean;
  canStudy?: boolean;
  canAskAi?: boolean;
};

type AuthEnvelope = {
  token?: string;
  csrfToken?: string;
  user: MobileUser;
  access?: AuthAccess;
};

export async function login(input: { email: string; password: string }) {
  const response = await apiClient.post<AuthEnvelope>("/auth/login", input);
  return response.data;
}

export async function register(input: Record<string, unknown>) {
  const response = await apiClient.post<AuthEnvelope>("/auth/register", input);
  return response.data;
}

export async function fetchSession() {
  const response = await apiClient.get<AuthEnvelope>("/auth/session");
  return response.data;
}

export async function logout() {
  const response = await apiClient.post<{ ok: boolean }>("/auth/logout");
  return response.data;
}
