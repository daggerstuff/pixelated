CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS drive_files (
  file_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  modified_time TIMESTAMPTZ,
  md5 TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'indexed', 'error', 'skipped')),
  error TEXT,
  chunks_count INTEGER NOT NULL DEFAULT 0,
  indexed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_files_status ON drive_files (status);
CREATE INDEX IF NOT EXISTS idx_drive_files_last_seen ON drive_files (last_seen_at);

CREATE TABLE IF NOT EXISTS file_chunks (
  id BIGSERIAL PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES drive_files (file_id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(384),
  UNIQUE (file_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_file_chunks_embedding
  ON file_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_file_chunks_fts
  ON file_chunks USING gin (to_tsvector('english', chunk_text));
