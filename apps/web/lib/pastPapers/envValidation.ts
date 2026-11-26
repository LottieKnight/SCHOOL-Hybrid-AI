import { pastPapersOpsLog } from "./opsLogger";

export type PastPapersEnvIssue = {
  key: string;
  severity: "error" | "warn";
  message: string;
};

export type PastPapersEnvValidationResult = {
  ok: boolean;
  checkedAtIso: string;
  issues: PastPapersEnvIssue[];
};

export type PastPapersEnvValidationOptions = {
  force?: boolean;
  requireAdminToken?: boolean;
};

let cachedValidation: PastPapersEnvValidationResult | null = null;
let lastLoggedSignature = "";

function hasValue(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim().length > 0);
}

function validateStorageIssues(): PastPapersEnvIssue[] {
  const mode = (process.env.PAST_PAPERS_STORAGE || "local").toLowerCase();
  const issues: PastPapersEnvIssue[] = [];
  if (mode !== "s3") {
    return issues;
  }

  const required = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  for (const key of required) {
    if (!hasValue(key)) {
      issues.push({
        key,
        severity: "error",
        message: `${key} is required when PAST_PAPERS_STORAGE=s3.`,
      });
    }
  }
  return issues;
}

export function validatePastPapersEnv(options: PastPapersEnvValidationOptions = {}): PastPapersEnvValidationResult {
  const force = options.force ?? false;
  const requireAdminToken = options.requireAdminToken ?? false;
  if (cachedValidation && !force) return cachedValidation;

  const issues: PastPapersEnvIssue[] = [];
  if (requireAdminToken && !hasValue("ADMIN_INGEST_TOKEN")) {
    issues.push({
      key: "ADMIN_INGEST_TOKEN",
      severity: "error",
      message: "ADMIN_INGEST_TOKEN is missing.",
    });
  }

  const hasDb = hasValue("PAST_PAPERS_DATABASE_URL") || hasValue("DATABASE_URL");
  if (!hasDb) {
    issues.push({
      key: "PAST_PAPERS_DATABASE_URL",
      severity: "error",
      message: "Neither PAST_PAPERS_DATABASE_URL nor DATABASE_URL is configured.",
    });
  }

  issues.push(...validateStorageIssues());

  const result: PastPapersEnvValidationResult = {
    ok: issues.length === 0,
    checkedAtIso: new Date().toISOString(),
    issues,
  };
  cachedValidation = result;

  const signature = JSON.stringify(
    issues.map((issue) => ({ key: issue.key, severity: issue.severity, message: issue.message }))
  );
  if (signature !== lastLoggedSignature) {
    if (issues.length > 0) {
      pastPapersOpsLog("error", "env.validation.failed", {
        ok: false,
        issueCount: issues.length,
        issues,
      });
    } else {
      pastPapersOpsLog("info", "env.validation.ok", { ok: true });
    }
    lastLoggedSignature = signature;
  }

  return result;
}
