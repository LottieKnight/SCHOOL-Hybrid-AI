import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

type SemanticSearchRequest = {
  embedding?: unknown;
  entityType?: unknown;
  grade?: unknown;
  limit?: unknown;
};

type SemanticSearchRow = {
  entity_id: string;
  content_text: string;
  similarity: number;
  embedding?: number[] | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEmbeddingVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "number");
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SemanticSearchRequest;
  try {
    body = (await request.json()) as SemanticSearchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isEmbeddingVector(body.embedding) || typeof body.entityType !== "string" || !body.entityType.trim()) {
    return NextResponse.json({ error: "Body must include embedding and entityType." }, { status: 400 });
  }

  const entityType = body.entityType.trim();
  const queryEmbedding = body.embedding;
  const grade = typeof body.grade === "number" && Number.isFinite(body.grade) ? Math.round(body.grade) : null;
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(25, Math.max(1, Math.round(body.limit)))
      : 10;

  try {
    const extensionCheck = await queryPlannerDb<{ installed: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = 'vector'
        ) AS installed
      `
    );

    const vectorInstalled = Boolean(extensionCheck.rows[0]?.installed);

    if (vectorInstalled) {
      const vectorLiteral = `[${queryEmbedding.join(",")}]`;
      const result = await queryPlannerDb<SemanticSearchRow>(
        `
          SELECT
            e.entity_id::text AS entity_id,
            e.content_text,
            1 - (e.embedding <=> $2::vector) AS similarity
          FROM embeddings e
          LEFT JOIN topics t
            ON e.entity_type = 'topic'
           AND t.id = e.entity_id
          WHERE e.entity_type = $1
            AND (
              $3::int IS NULL
              OR e.entity_type <> 'topic'
              OR t.grade = $3
            )
          ORDER BY e.embedding <=> $2::vector
          LIMIT $4
        `,
        [entityType, vectorLiteral, grade, limit]
      );

      return NextResponse.json(
        result.rows.map((row) => ({
          entity_id: row.entity_id,
          content_text: row.content_text,
          similarity: Number(row.similarity),
        }))
      );
    }

    const fallbackLimit = Math.max(limit * 20, 100);
    const result = await queryPlannerDb<SemanticSearchRow>(
      `
        SELECT
          e.entity_id::text AS entity_id,
          e.content_text,
          e.embedding
        FROM embeddings e
        LEFT JOIN topics t
          ON e.entity_type = 'topic'
         AND t.id = e.entity_id
        WHERE e.entity_type = $1
          AND (
            $2::int IS NULL
            OR e.entity_type <> 'topic'
            OR t.grade = $2
          )
        ORDER BY e.created_at DESC
        LIMIT $3
      `,
      [entityType, grade, fallbackLimit]
    );

    const ranked = result.rows
      .map((row) => ({
        entity_id: row.entity_id,
        content_text: row.content_text,
        similarity: cosineSimilarity(queryEmbedding, Array.isArray(row.embedding) ? row.embedding : []),
      }))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, limit);

    return NextResponse.json(ranked);
  } catch {
    return NextResponse.json({ error: "Semantic search failed." }, { status: 500 });
  }
}
