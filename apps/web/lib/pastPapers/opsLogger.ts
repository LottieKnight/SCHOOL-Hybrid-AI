type LogLevel = "info" | "warn" | "error";

type LogData = Record<string, unknown> | undefined;

function sanitizeData(data: LogData): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("authorization")
    ) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function pastPapersOpsLog(level: LogLevel, event: string, data?: LogData) {
  const payload = {
    timestamp: new Date().toISOString(),
    subsystem: "past-papers",
    level,
    event,
    ...(sanitizeData(data) || {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}
