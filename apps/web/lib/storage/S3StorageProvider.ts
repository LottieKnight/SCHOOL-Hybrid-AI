import type { StorageProvider, StoragePutInput, StoragePutResult } from "./StorageProvider";
import { pastPapersOpsLog } from "../pastPapers/opsLogger";

export class S3StorageProvider implements StorageProvider {
  private bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  async put(_input: StoragePutInput): Promise<StoragePutResult> {
    pastPapersOpsLog("error", "storage.s3.not_configured.put", { bucket: this.bucket || null });
    throw new Error("S3StorageProvider not configured. Set PAST_PAPERS_STORAGE=s3 and S3_* env vars.");
  }

  async exists(_key: string): Promise<boolean> {
    pastPapersOpsLog("error", "storage.s3.not_configured.exists", { bucket: this.bucket || null });
    throw new Error("S3StorageProvider not configured.");
  }

  async getSignedUrl(_key: string): Promise<string> {
    pastPapersOpsLog("error", "storage.s3.not_configured.signed_url", { bucket: this.bucket || null });
    throw new Error("S3StorageProvider not configured.");
  }
}
