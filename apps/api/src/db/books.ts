import { pool } from "./pool.js";

export type BookRecord = {
  id: string;
  title: string;
  description: string;
  phase: string;
  formats: string[];
  price_cents: number | null;
  currency: string;
  is_free: boolean;
  created_at: string;
};

export async function listBooks(): Promise<BookRecord[]> {
  const result = await pool.query<BookRecord>(
    "SELECT id, title, description, phase, formats, price_cents, currency, is_free, created_at FROM books ORDER BY created_at DESC"
  );
  return result.rows;
}

export async function findBooksByIds(ids: string[]): Promise<BookRecord[]> {
  const result = await pool.query<BookRecord>(
    "SELECT id, title, description, phase, formats, price_cents, currency, is_free, created_at FROM books WHERE id = ANY($1)",
    [ids]
  );
  return result.rows;
}
