const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE ??
  "https://api.openai.com/v1";

const EMBEDDING_MODEL = "text-embedding-3-small";

type EmbeddingsApiResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  const response = await fetch(
    `${OPENAI_API_BASE}/embeddings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Embedding API error: ${response.status}`
    );
  }

  const data = (await response.json()) as EmbeddingsApiResponse;
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding API returned no embedding vector.");
  }
  return embedding;
}

export async function semanticSearch(
  query: string,
  entityType: string,
  grade?: number,
  limit: number = 10
): Promise<Array<{
  entity_id: string;
  content_text: string;
  similarity: number;
}>> {
  const embedding = await generateEmbedding(query);

  const response = await fetch(
    "/api/search/semantic",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embedding,
        entityType,
        grade,
        limit,
      }),
    }
  );

  if (!response.ok) return [];
  return response.json();
}
