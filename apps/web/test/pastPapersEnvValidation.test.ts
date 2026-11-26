import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validatePastPapersEnv } from "../lib/pastPapers/envValidation";

const ORIGINAL_ENV = {
  PAST_PAPERS_DATABASE_URL: process.env.PAST_PAPERS_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_INGEST_TOKEN: process.env.ADMIN_INGEST_TOKEN,
  PAST_PAPERS_STORAGE: process.env.PAST_PAPERS_STORAGE,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("validatePastPapersEnv", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setEnv(ORIGINAL_ENV);
  });

  it("accepts DATABASE_URL as a fallback when PAST_PAPERS_DATABASE_URL is absent", () => {
    setEnv({
      PAST_PAPERS_DATABASE_URL: undefined,
      DATABASE_URL: "postgres://example/db",
      ADMIN_INGEST_TOKEN: undefined,
      PAST_PAPERS_STORAGE: undefined,
      S3_BUCKET: undefined,
      S3_REGION: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
    });

    const result = validatePastPapersEnv({ force: true });
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("fails when neither database URL is configured", () => {
    setEnv({
      PAST_PAPERS_DATABASE_URL: undefined,
      DATABASE_URL: undefined,
      ADMIN_INGEST_TOKEN: undefined,
      PAST_PAPERS_STORAGE: undefined,
      S3_BUCKET: undefined,
      S3_REGION: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
    });

    const result = validatePastPapersEnv({ force: true });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "PAST_PAPERS_DATABASE_URL",
          severity: "error",
        }),
      ])
    );
  });
});
