import { pool } from "./pool.js";
import { decryptPhone, encryptPhone, hashPhone, isKeyConfigured } from "../lib/phoneEncryption.js";

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  verification_level: string;
  trial_started_at: string;
  trial_ends_at: string;
  plan_type: string;
  plan_status: string;
  plan_expires_at: string | null;
  created_at: string;
  password_reset_token: string | null;
  password_reset_expires: string | null;
  date_of_birth: string | null;
  is_minor: boolean;
  parental_consent_given_at: string | null;
  institution_id: string | null;
  permissions: string[];
  external_id: string | null;
};

const USER_COLS = "id, email, password_hash, first_name, last_name, phone, phone_number, role, is_email_verified, is_phone_verified, verification_level, trial_started_at, trial_ends_at, plan_type, plan_status, plan_expires_at, created_at, password_reset_token, password_reset_expires, date_of_birth, is_minor, parental_consent_given_at, institution_id, permissions, external_id";

type RawUserRow = UserRecord & { phone_number: string | null };

function resolvePhone(raw: RawUserRow): UserRecord {
  if (raw.phone_number && isKeyConfigured()) {
    try { raw.phone = decryptPhone(raw.phone_number); } catch { /* keep plaintext phone */ }
  }
  const { phone_number: _pn, ...rest } = raw;
  return rest as UserRecord;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<RawUserRow>(`SELECT ${USER_COLS} FROM users WHERE email = $1`, [email]);
  return result.rows[0] ? resolvePhone(result.rows[0]) : null;
}

/** Find a user provisioned by an external SCIM source of truth, scoped to an institution. */
export async function findUserByExternalId(institutionId: string, externalId: string): Promise<UserRecord | null> {
  const result = await pool.query<RawUserRow>(
    `SELECT ${USER_COLS} FROM users WHERE institution_id = $1 AND external_id = $2`,
    [institutionId, externalId]
  );
  return result.rows[0] ? resolvePhone(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<RawUserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] ? resolvePhone(result.rows[0]) : null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  firstName: string,
  lastName: string,
  phone: string,
  role: string,
  dateOfBirth?: string | null,
  externalId?: string | null
): Promise<UserRecord> {
  const isMinor = dateOfBirth ? calculateIsMinor(dateOfBirth) : false;
  const encPhone = isKeyConfigured() ? encryptPhone(phone) : null;
  const phoneHash = isKeyConfigured() ? hashPhone(phone) : null;
  const result = await pool.query<RawUserRow>(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, phone_number, phone_number_hash, role, date_of_birth, is_minor, trial_started_at, trial_ends_at, plan_type, plan_status, external_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW() + INTERVAL '14 days', 'trial', 'trialing', $11)
     RETURNING ${USER_COLS}`,
    [email, passwordHash, firstName, lastName, encPhone ? "" : phone, encPhone, phoneHash, role, dateOfBirth ?? null, isMinor, externalId ?? null]
  );
  return resolvePhone(result.rows[0]);
}

function calculateIsMinor(dateOfBirth: string): boolean {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear() -
    (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate()) ? 1 : 0);
  return age < 18;
}

export async function updateUserPlan(
  id: string,
  planType: string,
  planStatus: string,
  planExpiresAt: Date | null
): Promise<UserRecord | null> {
  const result = await pool.query<RawUserRow>(
    `UPDATE users SET plan_type = $2, plan_status = $3, plan_expires_at = $4 WHERE id = $1 RETURNING ${USER_COLS}`,
    [id, planType, planStatus, planExpiresAt]
  );
  return result.rows[0] ? resolvePhone(result.rows[0]) : null;
}

export async function softDeleteUser(userId: string, anonymisedEmail: string, unguessableHash: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET email = $2,
         first_name = 'Deleted',
         last_name = 'Account',
         phone = '',
         phone_number = NULL,
         phone_number_hash = NULL,
         password_hash = $3
     WHERE id = $1`,
    [userId, anonymisedEmail, unguessableHash]
  );
}

export async function setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await pool.query(
    "UPDATE users SET password_reset_token = $2, password_reset_expires = $3 WHERE id = $1",
    [userId, tokenHash, expiresAt]
  );
}

export async function applyPasswordReset(userId: string, newPasswordHash: string): Promise<void> {
  await pool.query(
    "UPDATE users SET password_hash = $2, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1",
    [userId, newPasswordHash]
  );
}

export function touchLastActiveAt(userId: string): void {
  void pool.query("UPDATE users SET last_active_at = NOW() WHERE id = $1", [userId]);
}

export async function updateVerification(userId: string, fields: Partial<Pick<UserRecord, "is_email_verified" | "is_phone_verified" | "verification_level">>) {
  const updates: string[] = [];
  const values: any[] = [];
  let index = 1;
  const mapping: Record<string, string> = {
    is_email_verified: "is_email_verified",
    is_phone_verified: "is_phone_verified",
    verification_level: "verification_level",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (fields[key as keyof typeof fields] !== undefined) {
      updates.push(`${column} = $${index}`);
      values.push((fields as any)[key]);
      index += 1;
    }
  }

  if (!updates.length) {
    return findUserById(userId);
  }

  values.push(userId);
  const result = await pool.query<RawUserRow>(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${index} RETURNING ${USER_COLS}`,
    values
  );
  return result.rows[0] ? resolvePhone(result.rows[0]) : null;
}
