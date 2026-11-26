import { createHash } from "node:crypto";
import { pool } from "./pool.js";

function hashSessionId(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function upsertActiveSession(input: {
  userId: string;
  sessionId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const sessionHash = hashSessionId(input.sessionId);
  const result = await pool.query(
    `INSERT INTO auth_session_events (user_id, session_hash, user_agent, ip_address, is_active, created_at, revoked_at)
     VALUES ($1, $2, $3, $4, true, NOW(), NULL)
     ON CONFLICT (session_hash)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       user_agent = EXCLUDED.user_agent,
       ip_address = EXCLUDED.ip_address,
       is_active = true,
       revoked_at = NULL
     RETURNING id, user_id, session_hash, user_agent, ip_address, is_active, created_at, revoked_at`,
    [input.userId, sessionHash, input.userAgent ?? null, input.ipAddress ?? null]
  );
  return result.rows[0] ?? null;
}

export async function revokeSessionById(input: { userId: string; sessionId: string }) {
  const sessionHash = hashSessionId(input.sessionId);
  const result = await pool.query(
    `UPDATE auth_session_events
     SET is_active = false,
         revoked_at = NOW()
     WHERE user_id = $1
       AND session_hash = $2
     RETURNING id`,
    [input.userId, sessionHash]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function revokeAllSessionsForUser(userId: string) {
  const result = await pool.query(
    `UPDATE auth_session_events
     SET is_active = false,
         revoked_at = NOW()
     WHERE user_id = $1
       AND is_active = true`,
    [userId]
  );
  return result.rowCount;
}

export async function listActiveSessionsForUser(userId: string) {
  const result = await pool.query<{
    id: string;
    user_agent: string | null;
    ip_address: string | null;
    created_at: string;
  }>(
    `SELECT id, user_agent, ip_address, created_at
     FROM auth_session_events
     WHERE user_id = $1
       AND is_active = true
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  );
  return result.rows;
}
