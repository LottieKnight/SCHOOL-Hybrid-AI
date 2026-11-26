import "server-only";

import { Pool as PgPool } from "pg";
import { PgCompatiblePool, isCloudflareRuntime } from "./pg-d1";

export type UniversityPlanRecord = {
  id: string;
  userId: string;
  fileName: string | null;
  fileKey: string | null;
  extractedText: string;
  uploadedAt: string;
  updatedAt: string;
};

export type PlannerDbClient = {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{
    rows: T[];
    rowCount: number;
    command: string;
    fields: { name: string }[];
  }>;
  release(): void;
};

export type PlannerDbPool = {
  query<T = any>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: T[]; rowCount: number; command: string; fields: { name: string }[] }>;
  connect(): Promise<unknown>;
  on(event: string, cb: (err: Error) => void): unknown;
  end(): Promise<void>;
};

type PlannerPoolGlobal = typeof globalThis & {
  __schoolPlannerPool?: PlannerDbPool;
};

function getDatabaseUrl() {
  const databaseUrl =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    "";
  if (!databaseUrl) {
    throw new Error("No database URL configured (checked POSTGRES_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING).");
  }
  return databaseUrl;
}

function getPool(): PlannerDbPool {
  const globalForPool = globalThis as PlannerPoolGlobal;
  if (!globalForPool.__schoolPlannerPool) {
    if (isCloudflareRuntime()) {
      globalForPool.__schoolPlannerPool = new PgCompatiblePool() as unknown as PlannerDbPool;
      return globalForPool.__schoolPlannerPool;
    }
    const pool = new PgPool({
      connectionString: getDatabaseUrl(),
      max: 25,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      query_timeout: 10000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
    pool.on("error", (err) => {
      console.error("[plannerDb] Unexpected pool error:", err.message);
    });
    globalForPool.__schoolPlannerPool = pool as unknown as PlannerDbPool;
  }
  return globalForPool.__schoolPlannerPool;
}

export async function queryPlannerDb<T>(
  text: string,
  values: readonly unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  return pool.query<T>(text, [...values]);
}

export async function withPlannerDbClient<T>(run: (client: PlannerDbClient) => Promise<T>) {
  const client = (await getPool().connect()) as unknown as PlannerDbClient;
  try {
    return await run(client);
  } finally {
    client.release();
  }
}

function mapUniversityPlanRow(row: Record<string, unknown>): UniversityPlanRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    fileName: row.file_name ? String(row.file_name) : null,
    fileKey: row.file_key ? String(row.file_key) : null,
    extractedText: String(row.extracted_text || ""),
    uploadedAt: String(row.uploaded_at),
    updatedAt: String(row.updated_at),
  };
}

export async function insertUniversityPlan(input: {
  userId: string;
  fileName?: string | null;
  fileKey?: string | null;
  extractedText: string;
}) {
  const result = await queryPlannerDb(
    `
      INSERT INTO university_plans (user_id, file_name, file_key, extracted_text)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, file_name, file_key, extracted_text, uploaded_at, updated_at
    `,
    [input.userId, input.fileName ?? null, input.fileKey ?? null, input.extractedText]
  );

  return mapUniversityPlanRow(result.rows[0] as Record<string, unknown>);
}

export async function getLatestUniversityPlanForUser(userId: string) {
  const result = await queryPlannerDb(
    `
      SELECT id, user_id, file_name, file_key, extracted_text, uploaded_at, updated_at
      FROM university_plans
      WHERE user_id = $1
      ORDER BY uploaded_at DESC
      LIMIT 1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapUniversityPlanRow(result.rows[0] as Record<string, unknown>);
}
