import type {
  ResearchNoticingOutcomeInput,
  ResearchRecallResponseInput,
  ResearchTrialEventInput,
} from "@saedu/shared";
import { API_BASE } from "@/lib/apiBase";

/**
 * Thin browser client for the research telemetry API (Fastify backend).
 * In deployed environments API_BASE is the same-origin `/api` rewrite, so the
 * session cookie rides along; `credentials: "include"` covers the localhost
 * direct-to-:4000 case too. See docs/research/attention-study-telemetry.md.
 */

export class ResearchApiError extends Error {
  status: number;
  detail: unknown;
  code?: string;
  constructor(status: number, detail: unknown) {
    super(`Research API error ${status}`);
    this.name = "ResearchApiError";
    this.status = status;
    this.detail = detail;
    if (detail && typeof detail === "object" && "code" in detail) {
      this.code = String((detail as { code?: unknown }).code ?? "");
    }
  }
}

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)saedu_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      // non-JSON error body — ignore
    }
    throw new ResearchApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export interface ConsentResponse {
  consent: { id: string; consent_version: string };
  alreadyEnrolled?: boolean;
}

export interface SessionResponse {
  session: { id: string; stimulus_version: string };
}

export const researchClient = {
  grantConsent: (
    studyCode: string,
    body: { consentVersion?: string; scope?: Record<string, unknown>; guardianEmail?: string }
  ) => post<ConsentResponse>(`/research/${studyCode}/consent`, body),

  startSession: (
    studyCode: string,
    body: {
      condition?: string;
      isPractice?: boolean;
      primaryTask?: string;
      device?: Record<string, unknown>;
    }
  ) => post<SessionResponse>(`/research/${studyCode}/sessions`, body),

  sendEvents: (sessionId: string, events: ResearchTrialEventInput[]) =>
    post<{ inserted: number }>(`/research/sessions/${sessionId}/events`, { events }),

  recordNoticing: (sessionId: string, outcome: ResearchNoticingOutcomeInput) =>
    post<{ ok: true }>(`/research/sessions/${sessionId}/noticing`, outcome),

  recordRecall: (sessionId: string, response: ResearchRecallResponseInput) =>
    post<{ ok: true }>(`/research/sessions/${sessionId}/recall`, response),

  completeSession: (
    sessionId: string,
    body: {
      reportedPassCount?: number | null;
      actualPassCount?: number | null;
      qualityFlags?: Record<string, unknown>;
    }
  ) => post<{ session: unknown }>(`/research/sessions/${sessionId}/complete`, body),

  withdraw: (consentId: string, reason?: string) =>
    post<{ withdrawn: true }>(`/research/consent/${consentId}/withdraw`, { reason }),
};
