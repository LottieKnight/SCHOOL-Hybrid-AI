import type { ProviderType, SortBy } from "@/lib/bursary/constants";
import { API_BASE } from "@/lib/apiBase";

/**
 * Browser client for the public Bursary Finder API (Fastify backend).
 * Reads only — no auth or CSRF required (prospective students aren't signed in).
 */

export class BursaryApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`Bursary API error ${status}`);
    this.name = "BursaryApiError";
    this.status = status;
  }
}

// Snake_case row shape as returned by the API (matchBursaries → BursaryMatchRecord).
export interface BursaryMatch {
  id: string;
  title: string;
  provider: string;
  provider_type: ProviderType;
  seta_name: string | null;
  fields_of_study: string[];
  year_levels: string[];
  needs_based: boolean;
  merit_based: boolean;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  description: string | null;
  requirements: string[];
  link: string;
  match_score: number;
}

export interface MatchResponse {
  bursaries: BursaryMatch[];
  total: number;
  limit: number;
  offset: number;
}

export interface BursaryFacets {
  total: number;
  providerTypes: Array<{ provider_type: ProviderType; count: number }>;
}

export interface MatchParams {
  field?: string;
  year?: string;
  needsAid?: boolean;
  providerType?: ProviderType | "";
  sortBy?: SortBy;
  limit?: number;
  offset?: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    throw new BursaryApiError(res.status);
  }
  return (await res.json()) as T;
}

function buildQuery(params: MatchParams): string {
  const q = new URLSearchParams();
  if (params.field) q.set("field", params.field);
  if (params.year) q.set("year", params.year);
  if (params.needsAid) q.set("needsAid", "true");
  if (params.providerType) q.set("providerType", params.providerType);
  if (params.sortBy) q.set("sortBy", params.sortBy);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const bursaryClient = {
  match: (params: MatchParams = {}) => get<MatchResponse>(`/bursaries/match${buildQuery(params)}`),
  facets: () => get<BursaryFacets>("/bursaries/facets"),
};
