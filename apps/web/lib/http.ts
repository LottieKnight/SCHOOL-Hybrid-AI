export type SafeJsonNonJson = {
  __nonJson: true;
  raw: string;
};

export type SafeJsonValue = unknown | SafeJsonNonJson | null;

export async function safeJson<T = any>(res: Response): Promise<T | SafeJsonNonJson | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { __nonJson: true, raw: text.slice(0, 500) };
  }
}

function snippet(value: SafeJsonValue) {
  if (value == null) return "";
  if (typeof value === "object" && value && "__nonJson" in value) {
    return ` ${JSON.stringify({ raw: (value as SafeJsonNonJson).raw })}`;
  }
  try {
    return ` ${JSON.stringify(value).slice(0, 500)}`;
  } catch {
    return "";
  }
}

export class HttpResponseError extends Error {
  status: number;
  payload: SafeJsonValue;

  constructor(response: Response, payload: SafeJsonValue) {
    super(`HTTP ${response.status} ${response.statusText || ""}`.trim() + snippet(payload));
    this.name = "HttpResponseError";
    this.status = response.status;
    this.payload = payload;
  }
}

export async function fetchJsonOrThrow<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ response: Response; data: T | null | SafeJsonNonJson }> {
  const response = await fetch(input, init);
  const data = await safeJson<T>(response);
  if (!response.ok) {
    throw new HttpResponseError(response, data);
  }
  return { response, data };
}
