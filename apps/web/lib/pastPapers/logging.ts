import { pastPapersOpsLog } from "@/lib/pastPapers/opsLogger";

type LogData = Record<string, unknown> | undefined;

export function isPastPapersDebugEnabled() {
  return process.env.PAST_PAPERS_DEBUG === "1" || process.env.NODE_ENV !== "production";
}

export function pastPapersLog(event: string, data?: LogData) {
  if (!isPastPapersDebugEnabled()) return;
  pastPapersOpsLog("info", event, data);
}

export function pastPapersError(event: string, error: unknown, data?: LogData) {
  const errorPayload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  pastPapersOpsLog("error", event, { ...(data || {}), error: errorPayload });
}
