import { pool } from "./pool.js";

export async function upsertPushToken(
  userId: string,
  token: string,
  platform: string,
  deviceId: string | null,
) {
  await pool.query(
    `INSERT INTO push_tokens (user_id, token, platform, device_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, device_id)
     DO UPDATE SET token = EXCLUDED.token, platform = EXCLUDED.platform`,
    [userId, token, platform, deviceId],
  );
}

export async function getTokensForUser(userId: string): Promise<string[]> {
  const result = await pool.query<{ token: string }>(
    `SELECT token FROM push_tokens WHERE user_id = $1`,
    [userId],
  );
  return result.rows.map((r) => r.token);
}

export async function getTokensForUsers(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const result = await pool.query<{ token: string }>(
    `SELECT token FROM push_tokens WHERE user_id = ANY($1)`,
    [userIds],
  );
  return result.rows.map((r) => r.token);
}

export async function deletePushToken(userId: string, deviceId: string) {
  await pool.query(
    `DELETE FROM push_tokens WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId],
  );
}
