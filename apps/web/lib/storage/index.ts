import { existsSync } from "node:fs";
import path from "node:path";
import { LocalStorageProvider } from "./LocalStorageProvider";
import { S3StorageProvider } from "./S3StorageProvider";
import type { StorageProvider } from "./StorageProvider";
import { pastPapersOpsLog } from "../pastPapers/opsLogger";

let cachedProvider: StorageProvider | null = null;

function resolveLocalRoot(): string {
  const override = process.env.PAST_PAPERS_STORAGE_ROOT;
  if (override) return override;

  const cwd = process.cwd();
  const directPublic = path.join(cwd, "public");
  if (existsSync(directPublic)) {
    return path.join(directPublic, "past-papers");
  }

  const monorepoPublic = path.join(cwd, "apps", "web", "public");
  if (existsSync(monorepoPublic)) {
    return path.join(monorepoPublic, "past-papers");
  }

  return path.join(cwd, "data", "past-papers");
}

export function getStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;
  const mode = process.env.PAST_PAPERS_STORAGE || "local";
  if (mode === "s3") {
    const bucket = process.env.S3_BUCKET || "";
    pastPapersOpsLog("info", "storage.provider.selected", { mode: "s3", bucketConfigured: Boolean(bucket) });
    cachedProvider = new S3StorageProvider(bucket);
    return cachedProvider;
  }
  const localRoot = resolveLocalRoot();
  pastPapersOpsLog("info", "storage.provider.selected", { mode: "local", localRoot });
  cachedProvider = new LocalStorageProvider(localRoot);
  return cachedProvider;
}
