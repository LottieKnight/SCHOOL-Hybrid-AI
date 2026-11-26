import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import type { StorageProvider, StoragePutInput, StoragePutResult } from "./StorageProvider";
import { pastPapersOpsLog } from "../pastPapers/opsLogger";
import { confineStoragePath } from "./confineStoragePath";

export class LocalStorageProvider implements StorageProvider {
  private rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir || path.join(process.cwd(), "data", "past-papers");
  }

  private resolvePath(key: string) {
    const resolved = confineStoragePath(this.rootDir, key);
    if (!resolved) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const filePath = this.resolvePath(input.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (Buffer.isBuffer(input.body)) {
      await fs.writeFile(filePath, input.body);
      pastPapersOpsLog("info", "storage.local.put", {
        key: input.key,
        bytes: input.body.byteLength,
        contentType: input.contentType,
      });
      return { key: input.key };
    }

    const stream = input.body as Readable;
    await pipeline(stream, createWriteStream(filePath));
    pastPapersOpsLog("info", "storage.local.put", {
      key: input.key,
      bytes: null,
      contentType: input.contentType,
    });
    return { key: input.key };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    const safeKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
    const encodedPath = safeKey
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    // In this app, /api/* may be proxied to the backend service. Use static public
    // file URLs for local storage so links remain reachable in all environments.
    const url = `/past-papers/${encodedPath}`;
    pastPapersOpsLog("info", "storage.local.signed_url", { key, url });
    return url;
  }

  getLocalPath(key: string): string | null {
    return confineStoragePath(this.rootDir, key);
  }
}
