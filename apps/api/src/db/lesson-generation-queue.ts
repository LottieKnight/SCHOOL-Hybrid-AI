import { pool } from "./pool.js";

export type LessonGenerationJobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";

export type LessonGenerationQueueJob = {
  id: string;
  node_id: string | null;
  request: Record<string, unknown>;
  status: LessonGenerationJobStatus;
  error: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
};

function parseRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

export async function listLessonGenerationJobs(limit = 100) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 200) : 100;
  const result = await pool.query(
    `
      SELECT id, node_id, request, status, error, last_error, created_at, updated_at, started_at, completed_at, failed_at
      FROM generation_jobs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows.map((row) => ({
    ...row,
    request: parseRequest(row.request),
  })) as LessonGenerationQueueJob[];
}

export async function enqueueLessonGenerationJobs(
  requests: Array<Record<string, unknown>>
): Promise<LessonGenerationQueueJob[]> {
  if (!requests.length) {
    return [];
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const jobs: LessonGenerationQueueJob[] = [];

    for (const request of requests) {
      const inserted = await client.query(
        `
          INSERT INTO generation_jobs (request, status)
          VALUES ($1::jsonb, 'QUEUED')
          RETURNING id, node_id, request, status, error, last_error, created_at, updated_at, started_at, completed_at, failed_at
        `,
        [JSON.stringify(request)]
      );
      jobs.push({
        ...inserted.rows[0],
        request: parseRequest(inserted.rows[0].request),
      } as LessonGenerationQueueJob);
    }

    await client.query("COMMIT");
    return jobs;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionLessonGenerationJob(jobId: string, action: "processing" | "completed" | "failed" | "retry", errorMessage?: string | null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `
        SELECT id, node_id, request, status, error, last_error, created_at, updated_at, started_at, completed_at, failed_at
        FROM generation_jobs
        WHERE id = $1
        FOR UPDATE
      `,
      [jobId]
    );

    if (!existing.rowCount) {
      throw new Error("Job not found");
    }

    const current = existing.rows[0] as LessonGenerationQueueJob;
    const nowExpr = "NOW()";

    let query = "";
    let values: unknown[] = [jobId];

    if (action === "processing") {
      if (current.status !== "QUEUED") throw new Error("Only queued jobs can be marked processing");
      query = `
        UPDATE generation_jobs
        SET status = 'RUNNING',
            started_at = COALESCE(started_at, ${nowExpr}),
            updated_at = ${nowExpr}
        WHERE id = $1
        RETURNING id, node_id, request, status, error, last_error, created_at, updated_at, started_at, completed_at, failed_at
      `;
    } else if (action === "completed") {
      if (current.status !== "RUNNING") throw new Error("Only running jobs can be marked completed");
      query = `
        UPDATE generation_jobs
        SET status = 'DONE',
            completed_at = ${nowExpr},
            failed_at = NULL,
            error = NULL,
            last_error = NULL,
            updated_at = ${nowExpr}
        WHERE id = $1
        RETURNING id, node_id, request, status, error, last_error, created_at, updated_at, started_at, completed_at, failed_at
      `;
    } else if (action === "failed") {
      if (current.status !== "RUNNING") throw new Error("Only running jobs can be marked failed");
      values = [jobId, (errorMessage ?? "Job failed").trim() || "Job failed"];
      query = `
        UPDATE generation_jobs
        SET status = 'FAILED',
            failed_at = ${nowExpr},
            error = $2,
            last_error = $2,
            updated_at = ${nowExpr}
        WHERE id = $1
        RETURNING id, node_id, request, status, error, last_error, created_at, updated_at, started_at, completed_at, failed_at
      `;
    } else {
      if (current.status !== "FAILED") throw new Error("Only failed jobs can be retried");
      query = `
        UPDATE generation_jobs
        SET status = 'QUEUED',
            failed_at = NULL,
            completed_at = NULL,
            started_at = NULL,
            error = NULL,
            last_error = NULL,
            updated_at = ${nowExpr}
        WHERE id = $1
        RETURNING id, node_id, request, status, error, last_error, created_at, updated_at, started_at, completed_at, failed_at
      `;
    }

    const updated = await client.query(query, values);
    await client.query("COMMIT");
    return {
      ...updated.rows[0],
      request: parseRequest(updated.rows[0].request),
    } as LessonGenerationQueueJob;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
