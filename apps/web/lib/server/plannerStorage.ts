import "server-only";

import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { LocalStorageProvider } from "@/lib/storage/LocalStorageProvider";
import { S3StorageProvider } from "@/lib/storage/S3StorageProvider";
import type { StorageProvider } from "@/lib/storage/StorageProvider";
import { sanitizePlannerFileName } from "@/lib/plannerUploadValidation";

let cachedProvider: StorageProvider | null = null;

function resolvePlannerLocalRoot() {
  const override = process.env.PLANNER_STORAGE_ROOT;
  if (override) return override;

  const cwd = process.cwd();
  const dataRoot = path.join(cwd, "data");
  if (existsSync(dataRoot)) {
    return path.join(dataRoot, "planner-uploads");
  }

  return path.join(cwd, "planner-uploads");
}

export function getPlannerStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;

  const mode = process.env.PLANNER_STORAGE || process.env.PAST_PAPERS_STORAGE || "local";
  if (mode === "s3") {
    cachedProvider = new S3StorageProvider(process.env.S3_BUCKET || "");
    return cachedProvider;
  }

  cachedProvider = new LocalStorageProvider(resolvePlannerLocalRoot());
  return cachedProvider;
}

export async function storePlannerFile(input: {
  userId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}) {
  const provider = getPlannerStorageProvider();
  const safeName = sanitizePlannerFileName(input.fileName) || `planner-upload-${Date.now()}.bin`;
  const key = `university-plans/${input.userId}/${Date.now()}-${randomUUID()}-${safeName}`;

  await provider.put({
    key,
    contentType: input.contentType,
    body: input.body,
  });

  return { key };
}
