import { pool } from "./pool.js";

const REFERRAL_BONUS_CREDITS = 50;
const REFEREE_WELCOME_CREDITS = 25;

// Unambiguous charset: no 0/O, 1/I/L
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = Array.from(
      { length: CODE_LENGTH },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join("");
    const { rows } = await pool.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = $1) AS exists",
      [code]
    );
    if (!rows[0]?.exists) return code;
  }
  throw new Error("Failed to generate a unique referral code after 20 attempts.");
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await pool.query<{ code: string }>(
    "SELECT code FROM referral_codes WHERE user_id = $1",
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0].code;

  const code = await generateUniqueCode();
  await pool.query(
    "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
    [userId, code]
  );
  // Re-fetch in case of race condition on the unique index
  const result = await pool.query<{ code: string }>(
    "SELECT code FROM referral_codes WHERE user_id = $1",
    [userId]
  );
  return result.rows[0].code;
}

export async function findReferralCodeOwner(code: string): Promise<string | null> {
  const { rows } = await pool.query<{ user_id: string }>(
    "SELECT user_id FROM referral_codes WHERE code = $1",
    [code.toUpperCase().trim()]
  );
  return rows[0]?.user_id ?? null;
}

export async function recordReferral(
  referrerId: string,
  refereeId: string,
  code: string
): Promise<void> {
  await pool.query(
    `INSERT INTO referrals (referrer_id, referee_id, code, bonus_credited_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (referee_id) DO NOTHING`,
    [referrerId, refereeId, code]
  );
}

export async function getReferralStats(userId: string): Promise<{
  count: number;
  creditsEarned: number;
  bonusPerReferral: number;
}> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM referrals WHERE referrer_id = $1 AND bonus_credited_at IS NOT NULL",
    [userId]
  );
  const count = parseInt(rows[0]?.count ?? "0", 10);
  return {
    count,
    creditsEarned: count * REFERRAL_BONUS_CREDITS,
    bonusPerReferral: REFERRAL_BONUS_CREDITS,
  };
}

export { REFERRAL_BONUS_CREDITS, REFEREE_WELCOME_CREDITS };
