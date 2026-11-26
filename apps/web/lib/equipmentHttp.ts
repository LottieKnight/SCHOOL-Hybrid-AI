export type EquipmentSafeJsonNonJson = {
  __nonJson: true;
  rawSnippet: string;
};

export async function safeJson(res: Response): Promise<unknown | EquipmentSafeJsonNonJson | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, rawSnippet: text.slice(0, 500) };
  }
}

function payloadSnippet(payload: unknown) {
  if (payload == null) return "";
  try {
    return ` ${JSON.stringify(payload).slice(0, 500)}`;
  } catch {
    return "";
  }
}

export class EquipmentHttpError extends Error {
  status: number;
  payload: unknown;

  constructor(res: Response, payload: unknown) {
    super(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}` + payloadSnippet(payload));
    this.name = "EquipmentHttpError";
    this.status = res.status;
    this.payload = payload;
  }
}

export async function fetchEquipmentJsonOrThrow<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T | EquipmentSafeJsonNonJson | null> {
  const res = await fetch(input, init);
  const payload = await safeJson(res);
  if (!res.ok) {
    throw new EquipmentHttpError(res, payload);
  }
  return payload as T | EquipmentSafeJsonNonJson | null;
}

