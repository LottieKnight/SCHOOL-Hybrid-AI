import { closePool, pool } from "../db/pool.js";
import { decryptMessageBody, encryptMessageBody, isEncryptedMessageBody } from "../lib/messageEncryption.js";

const BATCH_SIZE = 250;

async function main() {
  let encrypted = 0;
  let remaining = 0;

  for (;;) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rows = await client.query<{ id: string; body: string }>(
        `SELECT id, body
         FROM messages
         WHERE body IS NOT NULL
           AND body <> ''
           AND body NOT LIKE 'smsg.v1.%'
         ORDER BY created_at ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1`,
        [BATCH_SIZE],
      );

      if (rows.rows.length === 0) {
        await client.query("COMMIT");
        break;
      }

      for (const row of rows.rows) {
        if (isEncryptedMessageBody(row.body)) continue;
        const plaintext = decryptMessageBody(row.body) ?? row.body;
        const ciphertext = encryptMessageBody(plaintext);
        await client.query("UPDATE messages SET body = $2 WHERE id = $1", [row.id, ciphertext]);
        encrypted += 1;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const count = await pool.query<{ remaining: string }>(
    `SELECT COUNT(*)::text AS remaining
     FROM messages
     WHERE body IS NOT NULL
       AND body <> ''
       AND body NOT LIKE 'smsg.v1.%'`,
  );
  remaining = Number(count.rows[0]?.remaining ?? 0);
  console.log(JSON.stringify({ ok: remaining === 0, encrypted, remaining }));
  if (remaining !== 0) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
