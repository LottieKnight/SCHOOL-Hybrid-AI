/**
 * Standalone migration runner for Railway deployments.
 * Run with: npx tsx run-migrations.ts
 * 
 * This script:
 * 1. Connects to the PostgreSQL database via DATABASE_URL
 * 2. Creates the schema_migrations table if it doesn't exist
 * 3. Reads all .sql files from apps/api/migrations/
 * 4. Applies pending migrations in order
 * 5. Tracks applied migrations in schema_migrations table
 */

import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import * as path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL environment variable not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

const migrationsDir = path.join(path.dirname(import.meta.url).replace("file://", ""), "migrations");

async function ensureMigrationsTable() {
  console.log("📋 Creating schema_migrations table if it doesn't exist...");
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, run_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
  );
  console.log("✅ schema_migrations table ready");
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query("SELECT id FROM schema_migrations ORDER BY id");
  return new Set(result.rows.map((row) => row.id));
}

async function runMigration(fileName: string) {
  const filePath = `${migrationsDir}/${fileName}`;
  console.log(`⏳ Applying migration: ${fileName}`);
  
  const sql = await readFile(filePath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [fileName]);
    await client.query("COMMIT");
    console.log(`✅ Applied: ${fileName}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`❌ Failed to apply ${fileName}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log("🚀 Starting database migrations...\n");
    
    // Test connection
    console.log("🔗 Connecting to database...");
    await pool.query("SELECT NOW()");
    console.log("✅ Database connection successful\n");

    // Ensure migrations table exists
    await ensureMigrationsTable();
    console.log();

    // Get list of migration files
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    
    console.log(`📁 Found ${files.length} migration files\n`);

    // Get applied migrations
    const applied = await getAppliedMigrations();
    console.log(`✓ Already applied: ${applied.size} migration(s)\n`);

    // Run pending migrations
    let pendingCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⊘ Skipping (already applied): ${file}`);
      } else {
        await runMigration(file);
        pendingCount++;
      }
    }

    console.log();
    if (pendingCount === 0) {
      console.log("✨ All migrations already applied. Database is up-to-date.");
    } else {
      console.log(`✨ Successfully applied ${pendingCount} new migration(s)`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

main();

