import type { Readable } from "node:stream";

export type StoragePutInput = {
  key: string;
  contentType: string;
  body: Buffer | Readable;
};

export type StoragePutResult = {
  key: string;
  etag?: string;
};

export interface StorageProvider {
  put(input: StoragePutInput): Promise<StoragePutResult>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string): Promise<string>;
  getLocalPath?(key: string): string | null;
}
