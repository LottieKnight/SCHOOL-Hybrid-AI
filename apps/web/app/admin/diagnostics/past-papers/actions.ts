"use server";

import type { PastPapersIntegrityCheck, PastPapersSourceConnectivity } from "@/lib/pastPapers/diagnostics";
import { runPastPapersIntegrityChecks, runPastPapersSourceConnectivityCheck } from "@/lib/pastPapers/diagnostics";

export type IntegrityActionState = {
  ran: boolean;
  ok: boolean | null;
  ranAtIso: string | null;
  checks: PastPapersIntegrityCheck[];
  error: string | null;
};

export type ConnectivityActionState = {
  ran: boolean;
  result: PastPapersSourceConnectivity | null;
  error: string | null;
};

export async function runPastPapersIntegrityAction(_prev: IntegrityActionState): Promise<IntegrityActionState> {
  if (process.env.NODE_ENV !== "development") {
    return {
      ran: true,
      ok: false,
      ranAtIso: new Date().toISOString(),
      checks: [],
      error: "Diagnostics are available in development only.",
    };
  }

  try {
    const report = await runPastPapersIntegrityChecks(1);
    return {
      ran: true,
      ok: report.ok,
      ranAtIso: report.ranAtIso,
      checks: report.checks,
      error: null,
    };
  } catch (error) {
    return {
      ran: true,
      ok: false,
      ranAtIso: new Date().toISOString(),
      checks: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runPastPapersConnectivityAction(
  _prev: ConnectivityActionState
): Promise<ConnectivityActionState> {
  if (process.env.NODE_ENV !== "development") {
    return {
      ran: true,
      result: null,
      error: "Diagnostics are available in development only.",
    };
  }

  try {
    const result = await runPastPapersSourceConnectivityCheck();
    return {
      ran: true,
      result,
      error: null,
    };
  } catch (error) {
    return {
      ran: true,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
