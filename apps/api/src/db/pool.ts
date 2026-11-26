import { Pool } from "pg";
import { config } from "../config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  query_timeout: 8000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

export async function closePool() {
  await pool.end();
}
