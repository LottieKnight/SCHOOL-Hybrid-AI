// apps/api/src/db/bursaryCodes.ts
import { pool } from "./pool.js";
import { randomBytes } from "node:crypto";

export type BursaryCodeRow = {
  code: string;
  sponsor_name: string;
  sponsor_email: string | null;
  seats_total: number;
  seats_redeemed: number;
  plan_tier: string;
  expires_at: Date | null;
  active: boolean;
  created_at: Date;
};

function generateCode(): string {
  // Human-friendly, unambiguous: 4 groups of 4 base32-ish chars, uppercase.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if ((i + 1) % 4 === 0 && i < 15) out += "-";
  }
  return out; // e.g. "ABCD-EFGH-JKLM-NPQR"
}

export async function issueBursaryCodes(input: {
  sponsorName: string;
  sponsorEmail?: string | null;
  count: number;
  seatsPerCode?: number;
  expiresAt?: Date | null;
  createdBy?: string | null;
}): Promise<string[]> {
  const codes: string[] = [];
  const seatsPerCode = input.seatsPerCode && input.seatsPerCode > 0 ? input.seatsPerCode : 1;
  const count = Math.min(Math.max(input.count, 1), 500);
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await pool.query(
      `INSERT INTO bursary_codes
        (code, sponsor_name, sponsor_email, seats_total, plan_tier, expires_at, created_by)
       VALUES ($1, $2, $3, $4, 'bursary', $5, $6)
       ON CONFLICT (code) DO NOTHING`,
      [code, input.sponsorName, input.sponsorEmail ?? null, seatsPerCode, input.expiresAt ?? null, input.createdBy ?? null]
    );
    codes.push(code);
  }
  return codes;
}

export async function getBursaryCode(code: string): Promise<BursaryCodeRow | null> {
  const res = await pool.query<BursaryCodeRow>(
    `SELECT * FROM bursary_codes WHERE code = $1`,
    [code.trim().toUpperCase()]
  );
  return res.rows[0] ?? null;
}

export async function canRedeem(code: string): Promise<{ ok: boolean; reason?: string; row?: BursaryCodeRow }> {
  const row = await getBursaryCode(code);
  if (!row) return { ok: false, reason: "Code not found." };
  if (!row.active) return { ok: false, reason: "This code is no longer active." };
  if (row.expires_at && row.expires_at.getTime() < Date.now())
    return { ok: false, reason: "This code has expired." };
  if (row.seats_redeemed >= row.seats_total)
    return { ok: false, reason: "All seats for this code have been claimed." };
  return { ok: true, row };
}

export async function redeemBursaryCode(code: string, userId: string): Promise<{ ok: boolean; reason?: string }> {
  const check = await canRedeem(code);
  if (!check.ok || !check.row) return { ok: false, reason: check.reason };

  // Prevent double-claiming the same code by the same user.
  const dup = await pool.query(
    `SELECT 1 FROM bursary_code_redemptions WHERE code = $1 AND user_id = $2`,
    [code.trim().toUpperCase(), userId]
  );
  if (dup.rows.length > 0) return { ok: false, reason: "You have already redeemed this code." };

  await pool.query(
    `INSERT INTO bursary_code_redemptions (code, user_id) VALUES ($1, $2)`,
    [code.trim().toUpperCase(), userId]
  );
  await pool.query(
    `UPDATE bursary_codes SET seats_redeemed = seats_redeemed + 1, updated_at = now() WHERE code = $1`,
    [code.trim().toUpperCase()]
  );
  return { ok: true };
}

export async function listBursaryCodes(createdBy?: string): Promise<BursaryCodeRow[]> {
  const res = await pool.query<BursaryCodeRow>(
    `SELECT * FROM bursary_codes
     ${createdBy ? "WHERE created_by = $1" : ""}
     ORDER BY created_at DESC LIMIT 200`,
    createdBy ? [createdBy] : []
  );
  return res.rows;
}
