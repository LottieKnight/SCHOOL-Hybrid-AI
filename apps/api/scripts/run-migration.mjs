import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../.env") });

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-migration.sql>");
  process.exit(1);
}

const sql = readFileSync(resolve(migrationFile), "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log("Migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
