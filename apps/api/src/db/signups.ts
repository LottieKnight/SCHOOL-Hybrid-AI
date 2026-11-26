import { pool } from "./pool.js";

export type SignupRecord = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  created_at: string;
};

export async function findSignupByEmail(email: string): Promise<SignupRecord | null> {
  const result = await pool.query<SignupRecord>(
    "SELECT id, first_name, last_name, phone, email, created_at FROM signups WHERE email = $1",
    [email]
  );
  return result.rows[0] ?? null;
}

export async function createSignup(
  firstName: string,
  lastName: string,
  phone: string,
  email: string
): Promise<SignupRecord> {
  const result = await pool.query<SignupRecord>(
    "INSERT INTO signups (first_name, last_name, phone, email) VALUES ($1, $2, $3, $4) RETURNING id, first_name, last_name, phone, email, created_at",
    [firstName, lastName, phone, email]
  );
  return result.rows[0];
}
