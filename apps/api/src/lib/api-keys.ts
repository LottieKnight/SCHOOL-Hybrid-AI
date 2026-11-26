// apps/api/src/lib/api-keys.ts
//
// API key lifecycle management for institutional integrations.
//
// Raw API keys are shown to the caller exactly once at creation and are stored
// only as a SHA-256 hash. This library handles:
//   - key generation & hashing
//   - creation / listing / rotation / revocation
//   - authentication (resolving a presented key to an institution principal)
//   - scope-based permission mapping

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { FastifyBaseLogger } from "fastify";
import { pool } from "../db/pool.js";
import { Permission } from "./rbac/roles.js";

const KEY_PREFIX = "schl";
const FULL_KEY_LENGTH = 48; // base62 raw key length after prefix

function base62(bytes: Buffer): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let num = BigInt("0x" + bytes.toString("hex"));
  let out = "";
  const base = BigInt(chars.length);
  while (num > 0n) {
    out = chars[Number(num % base)] + out;
    num = num / base;
  }
  return out.padStart(FULL_KEY_LENGTH, "0");
}

/** Hash a raw key so it can be safely stored and compared. */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Scoped permission strings an API key may carry. */
export type ApiKeyScope =
  | "read:users"
  | "write:users"
  | "read:learners"
  | "write:learners"
  | "read:analytics"
  | "read:content"
  | "write:content"
  | "read:webhooks"
  | "write:webhooks"
  | "read:institution"
  | "write:institution"
  | "scim:provisioning";

const SCOPE_TO_PERMISSION: Record<ApiKeyScope, Permission> = {
  "read:users": "institution:manage_users",
  "write:users": "institution:manage_users",
  "read:learners": "institution:manage_users",
  "write:learners": "institution:manage_users",
  "read:analytics": "analytics:institution",
  "read:content": "content:create",
  "write:content": "content:create",
  "read:webhooks": "webhooks:manage",
  "write:webhooks": "webhooks:manage",
  "read:institution": "institution:read",
  "write:institution": "institution:write",
  "scim:provisioning": "institution:manage_users",
};

export function scopesToPermissions(scopes: string[]): string[] {
  const permSet = new Set<string>();
  for (const s of scopes) {
    const p = SCOPE_TO_PERMISSION[s as ApiKeyScope];
    if (p) permSet.add(p);
  }
  return [...permSet];
}

export type ApiKeyRecord = {
  id: string;
  institution_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ApiKeyPrincipal = {
  keyId: string;
  institutionId: string;
  userId: string;
  email: string;
  permissions: string[];
  rateLimit: number;
};

/**
 * Create a new API key. Returns the full raw key (only visible once).
 */
export async function createApiKey(params: {
  institutionId: string;
  name: string;
  scopes: ApiKeyScope[];
  rateLimit?: number;
  expiresAt?: Date | null;
}): Promise<{ record: ApiKeyRecord; rawKey: string }> {
  const rawKey = `${KEY_PREFIX}_${base62(randomBytes(32))}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 9); // e.g. "schl_AbC..."
  const ofacCheck = rawKey; // (placeholder for future compliance)

  const result = await pool.query<ApiKeyRecord>(
    `INSERT INTO api_keys
       (institution_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, institution_id, name, key_prefix, scopes, rate_limit, status,
               last_used_at, expires_at, created_at`,
    [
      params.institutionId,
      params.name,
      keyHash,
      keyPrefix,
      params.scopes,
      params.rateLimit ?? 60,
      params.expiresAt ?? null,
    ]
  );
  void ofacCheck;

  return { record: result.rows[0], rawKey };
}

export async function listApiKeys(institutionId: string): Promise<ApiKeyRecord[]> {
  const result = await pool.query<ApiKeyRecord>(
    `SELECT id, institution_id, name, key_prefix, scopes, rate_limit, status,
            last_used_at, expires_at, created_at
     FROM api_keys
     WHERE institution_id = $1
     ORDER BY created_at DESC`,
    [institutionId]
  );
  return result.rows;
}

export async function getApiKeyById(id: string, institutionId: string): Promise<ApiKeyRecord | null> {
  const result = await pool.query<ApiKeyRecord>(
    `SELECT id, institution_id, name, key_prefix, scopes, rate_limit, status,
            last_used_at, expires_at, created_at
     FROM api_keys
     WHERE id = $1 AND institution_id = $2`,
    [id, institutionId]
  );
  return result.rows[0] ?? null;
}

/**
 * Revoke an API key (soft-delete by status flip).
 */
export async function revokeApiKey(id: string, institutionId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE api_keys SET status = 'revoked', revoked_at = NOW()
     WHERE id = $1 AND institution_id = $2 AND status = 'active'`,
    [id, institutionId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Rotate an API key: revoke the old key and mint a new one with the same
 * scopes/rate limit. Returns the new raw key.
 */
export async function rotateApiKey(
  id: string,
  institutionId: string
): Promise<{ rawKey: string; record: ApiKeyRecord } | null> {
  const existing = await getApiKeyById(id, institutionId);
  if (!existing || existing.status !== "active") return null;
  await revokeApiKey(id, institutionId);
  return createApiKey({
    institutionId,
    name: existing.name,
    scopes: existing.scopes as ApiKeyScope[],
    rateLimit: existing.rate_limit,
    expiresAt: existing.expires_at ? new Date(existing.expires_at) : null,
  });
}

/**
 * Resolve a presented raw API key to a principal. Returns null on invalid /
 * revoked / expired keys.
 */
export async function authenticateApiKey(
  rawKey: string,
  log?: FastifyBaseLogger
): Promise<ApiKeyPrincipal | null> {
  const keyHash = hashApiKey(rawKey);
  const result = await pool.query<{
    id: string;
    institution_id: string;
    scopes: string[];
    rate_limit: number;
    status: string;
    expires_at: string | null;
  }>(
    `SELECT id, institution_id, scopes, rate_limit, status, expires_at
     FROM api_keys
     WHERE key_hash = $1`,
    [keyHash]
  );

  const row = result.rows[0];
  if (!row) return null;
  if (row.status !== "active") return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  // Look up an authoritative user email + institution name for logging.
  const userResult = await pool.query<{ email: string }>(
    `SELECT email FROM users WHERE institution_id = $1 LIMIT 1`,
    [row.institution_id]
  );
  const email = userResult.rows[0]?.email ?? "";

  // bump last_used_at (fire and forget)
  void pool.query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [row.id]);

  log?.info({ keyId: row.id, institutionId: row.institution_id }, "api key authenticated");

  return {
    keyId: row.id,
    institutionId: row.institution_id,
    userId: row.institution_id, // API key principal is institution-scoped
    email,
    permissions: scopesToPermissions(row.scopes),
    rateLimit: row.rate_limit,
  };
}

export function generateKeyId(): string {
  return randomUUID();
}
