import { dbQueryDurationSeconds } from "./registry.js";

/**
 * Times a database query and records it into the db_query_duration_seconds
 * histogram. Works with any promise-returning query function.
 *
 *   const rows = await timeDbQuery("select", "users", () => pool.query(sql));
 */
export async function timeDbQuery<T>(
  operation: string,
  table: string,
  run: () => Promise<T>,
): Promise<T> {
  const endTimer = dbQueryDurationSeconds.startTimer({ operation, table });
  try {
    const result = await run();
    endTimer({ status: "ok" });
    return result;
  } catch (error) {
    endTimer({ status: "error" });
    throw error;
  }
}

/**
 * Lower-level helper for callers that cannot wrap their query in a closure.
 * Returns a function to call when the query finishes.
 */
export function startDbTimer(operation: string, table: string) {
  const endTimer = dbQueryDurationSeconds.startTimer({ operation, table });
  return (status: "ok" | "error" = "ok") => endTimer({ status });
}
