/**
 * One-time migration: encrypt plaintext phone values left by rows created before
 * migration 076_phone_number_encryption.sql was applied.
 *
 * Handles two cases:
 *   A) Rows where phone != '' and phone_number IS NULL — legacy registration path
 *      stored the number in `phone`; migrates it to `phone_number` (encrypted).
 *   B) Rows where phone_number IS NOT NULL and phone_number_hash IS NULL and
 *      phone_number doesn't look encrypted — adds the missing HMAC hash.
 *
 * Run immediately after applying migration 076:
 *   DATABASE_URL=<prod_url> PHONE_ENCRYPTION_KEY=<key> npx tsx scripts/encrypt-existing-phone-numbers.ts
 *
 * Safe to re-run: encrypted rows (containing ":") and rows with a hash are skipped.
 */

import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { Pool } from "pg";

function getKey(): Buffer {
  const hex = process.env.PHONE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("PHONE_ENCRYPTION_KEY must be a 64-char hex string.");
  return Buffer.from(hex, "hex");
}

function encryptPhone(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function hashPhone(plaintext: string): string {
  return createHmac("sha256", getKey()).update(plaintext).digest("hex");
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Case A: legacy rows where phone was stored in the `phone` column.
  const { rows: legacyRows } = await pool.query<{ id: string; phone: string }>(
    "SELECT id, phone FROM users WHERE phone != '' AND phone_number IS NULL"
  );
  console.log(`Case A (phone → phone_number migration): ${legacyRows.length} rows`);

  let migratedA = 0;
  let duplicatesA = 0;
  for (const row of legacyRows) {
    if (row.phone.includes(":")) {
      console.log(`  Skipping ${row.id} — phone column appears already encrypted.`);
      continue;
    }
    try {
      await pool.query(
        "UPDATE users SET phone = '', phone_number = $2, phone_number_hash = $3 WHERE id = $1",
        [row.id, encryptPhone(row.phone), hashPhone(row.phone)]
      );
      migratedA++;
    } catch (err: any) {
      if (err?.code === "23505") {
        // Duplicate phone number — another account already holds this phone.
        // Clear it so the unique constraint is satisfied.
        console.warn(`  Duplicate phone on ${row.id} — clearing phone field (duplicate of an already-encrypted number).`);
        await pool.query("UPDATE users SET phone = '' WHERE id = $1", [row.id]);
        duplicatesA++;
      } else {
        throw err;
      }
    }
  }
  console.log(`  Migrated: ${migratedA}, duplicates cleared: ${duplicatesA}`);

  // Case B: rows that already have phone_number set but are missing the hash.
  const { rows: hashlessRows } = await pool.query<{ id: string; phone_number: string }>(
    "SELECT id, phone_number FROM users WHERE phone_number IS NOT NULL AND phone_number_hash IS NULL"
  );
  console.log(`Case B (add missing hash): ${hashlessRows.length} rows`);

  let migratedB = 0;
  for (const row of hashlessRows) {
    if (row.phone_number.includes(":")) {
      console.log(`  Skipping ${row.id} — phone_number appears encrypted, cannot hash ciphertext.`);
      continue;
    }
    await pool.query(
      "UPDATE users SET phone_number_hash = $2 WHERE id = $1",
      [row.id, hashPhone(row.phone_number)]
    );
    migratedB++;
  }
  console.log(`  Updated: ${migratedB}`);

  console.log(`\nDone. A=${migratedA} migrated, B=${migratedB} hashed.`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
