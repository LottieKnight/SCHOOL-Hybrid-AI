// apps/api/src/db/scoped-query.ts
//
// Transaction-scoped query helper that sets the Postgres session config used by
// Row-Level Security policies (`app.institution_id` and `request.user_id`).
//
// Because the application uses connection pooling (`pg.Pool`), a `SET` on one
// connection is not visible on another. To make RLS effective and deterministic
// we run each scoped operation inside its own transaction using a dedicated
// client acquired from the pool, setting the config with `set_config(..., true)`
// (transaction-local scope) before running the SQL.
//
// Usage:
//   await scopedQuery(
//     { institutionId: '...', userId: '...' },
//     (client) => client.query("SELECT * FROM api_keys WHERE ..."),
//   );

import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { pool } from "./pool.js";

export type TenantContext = {
  institutionId?: string | null;
  userId?: string | null;
};

/**
 * Run `work` against a dedicated client with the tenant context applied via
 * transaction-local `set_config`. The work function receives the client and
 * must return a query result (or array of results).
 */
export async function scopedQuery<T extends QueryResultRow = QueryResultRow>(
  ctx: TenantContext,
  work: (client: PoolClient) => Promise<QueryResult<T> | QueryResult<T>[]>
): Promise<QueryResult<T> | QueryResult<T>[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (ctx.institutionId) {
      await client.query(
        "SELECT set_config('app.institution_id', $1, true)",
        [ctx.institutionId]
      );
    }
    if (ctx.userId) {
      await client.query(
        "SELECT set_config('request.user_id', $1, true)",
        [ctx.userId]
      );
    }
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
