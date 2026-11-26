import { createHash, randomBytes } from "node:crypto";
import { pool } from "./pool.js";

export type TokenType = "email_verification" | "password_reset" | "email_change" | "parental_consent";

const TTL: Record<TokenType, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
  email_change: 24 * 60 * 60 * 1000,
  parental_consent: 7 * 24 * 60 * 60 * 1000, // 7 days — parents may not check email immediately
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createAuthToken(
  userId: string,
  type: TokenType,
  metadata?: string
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TTL[type]);

  // Invalidate any existing unused tokens of the same type for this user.
  await pool.query(
    `DELETE FROM auth_tokens WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL`,
    [userId, type]
  );

  await pool.query(
    `INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, type, expiresAt, metadata ?? null]
  );

  return raw;
}

export async function consumeAuthToken(
  raw: string,
  type: TokenType
): Promise<{ userId: string; metadata: string | null } | null> {
  const tokenHash = hashToken(raw);
  const result = await pool.query<{ user_id: string; id: string; metadata: string | null }>(
    `UPDATE auth_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
       AND token_type = $2
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING id, user_id, metadata`,
    [tokenHash, type]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.user_id, metadata: row.metadata };
}
