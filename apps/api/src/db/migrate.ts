import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const migrationsDir = fileURLToPath(new URL("../../migrations", import.meta.url));

async function ensureMigrationsTable() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, run_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
  );
}

async function getAppliedMigrations() {
  const result = await pool.query("SELECT id FROM schema_migrations");
  return new Set(result.rows.map((row) => row.id));
}

async function runMigration(fileName: string) {
  const filePath = `${migrationsDir}/${fileName}`;
  const sql = await readFile(filePath, "utf-8");

  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [fileName]);
    await pool.query("COMMIT");
    console.log(`Applied migration ${fileName}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  await ensureMigrationsTable();
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const applied = await getAppliedMigrations();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping ${file}`);
      continue;
    }
    await runMigration(file);
  }

  await pool.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
