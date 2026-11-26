DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension unavailable; falling back to float8[] embeddings storage.';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'vector'
  ) THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        content_text TEXT NOT NULL,
        embedding vector(1536),
        model TEXT DEFAULT ''text-embedding-3-small'',
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(entity_type, entity_id)
      )
    ';

    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector
      ON embeddings
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    ';
  ELSE
    EXECUTE '
      CREATE TABLE IF NOT EXISTS embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        content_text TEXT NOT NULL,
        embedding DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
        model TEXT DEFAULT ''text-embedding-3-small'',
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(entity_type, entity_id)
      )
    ';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_embeddings_type
  ON embeddings(entity_type);
