import path from "node:path";

/** Keep a storage key inside root. Rejects .., absolute paths, and prefix tricks. */
export function confineStoragePath(rootDir: string, key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) return null;
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}
