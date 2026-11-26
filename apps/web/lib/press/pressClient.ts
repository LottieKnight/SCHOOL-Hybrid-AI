import type {
  WorkInput,
  WorkVersionInput,
  WorkKind,
  WorkLayout,
  WorkLicense,
  WorkStatus,
} from "@/lib/press/constants";
import { API_BASE } from "@/lib/apiBase";

/**
 * Browser client for the SCHOOL Press API (Fastify backend).
 * Reads ride on the session cookie (`credentials: "include"`); writes also send
 * the CSRF token, which the API requires for non-safe methods. See
 * docs/product/school-press.md.
 */

export class PressApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(`Press API error ${status}`);
    this.name = "PressApiError";
    this.status = status;
    this.detail = detail;
  }
}

// Snake_case row shapes as returned by the API.
export interface PressWork {
  id: string;
  author_id: string;
  kind: WorkKind;
  layout: WorkLayout;
  title: string;
  slug: string;
  abstract: string | null;
  body_md: string | null;
  discipline_tags: string[];
  license: WorkLicense;
  status: WorkStatus;
  doi: string | null;
  cover_url: string | null;
  cover_storage_key: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PressAuthor {
  user_id: string | null;
  display_name: string;
  affiliation: string | null;
  ord: number;
}

export interface PressVersion {
  id: string;
  work_id: string;
  version: number;
  file_url: string | null;
  storage_key: string | null;
  image_urls: string[];
  changelog: string | null;
  created_at: string;
}

export interface PressReference {
  id: string;
  raw: string;
  doi: string | null;
  ord: number;
}

export interface PressWorkDetail {
  work: PressWork;
  authors: PressAuthor[];
  versions: PressVersion[];
  references: PressReference[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      /* non-JSON */
    }
    throw new PressApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

async function send<T>(
  method: "POST" | "PUT",
  path: string,
  csrfToken: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      /* non-JSON */
    }
    throw new PressApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const pressClient = {
  feed: (layout?: WorkLayout) =>
    get<{ works: PressWork[] }>(`/press/feed${layout ? `?layout=${layout}` : ""}`),

  authorWorks: (username: string) =>
    get<{ works: PressWork[] }>(`/press/authors/${encodeURIComponent(username)}/works`),

  work: (slug: string) => get<PressWorkDetail>(`/press/works/${encodeURIComponent(slug)}`),

  create: (input: WorkInput, csrfToken: string) =>
    send<{ work: PressWork }>("POST", "/press/works", csrfToken, input),

  update: (id: string, input: WorkInput, csrfToken: string) =>
    send<{ work: PressWork }>("PUT", `/press/works/${id}`, csrfToken, input),

  addVersion: (id: string, input: WorkVersionInput, csrfToken: string) =>
    send<{ version: PressVersion }>("POST", `/press/works/${id}/versions`, csrfToken, input),

  publish: (id: string, csrfToken: string) =>
    send<{ work: PressWork }>("POST", `/press/works/${id}/publish`, csrfToken),

  withdraw: (id: string, csrfToken: string) =>
    send<{ work: PressWork }>("POST", `/press/works/${id}/withdraw`, csrfToken),
};
