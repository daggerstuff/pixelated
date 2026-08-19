from __future__ import annotations

from dataclasses import dataclass

from .config import Config
from .db import Database
from .embed import embed_texts

FTS_CANDIDATES = 20


@dataclass(frozen=True)
class SearchResult:
    file_name: str
    file_id: str
    chunk_index: int
    score: float
    text: str


def vector_search(db: Database, cfg: Config, query: str, limit: int, use_fts: bool = False) -> list[SearchResult]:
    query_vector = embed_texts([query], cfg.embedding_model)[0]
    with db.pool.connection() as conn:
        vector_rows = conn.execute(
            """
            SELECT f.name, c.file_id, c.chunk_index, 1 - (c.embedding <=> %s::vector) AS score, c.chunk_text
            FROM file_chunks c
            JOIN drive_files f ON f.file_id = c.file_id
            ORDER BY c.embedding <=> %s::vector
            LIMIT %s
            """,
            (query_vector, query_vector, limit),
        ).fetchall()

    results = [
        SearchResult(file_name=r[0], file_id=r[1], chunk_index=r[2], score=float(r[3]), text=r[4]) for r in vector_rows
    ]
    if not use_fts:
        return results

    seen = {(r.file_id, r.chunk_index) for r in results}
    with db.pool.connection() as conn:
        fts_rows = conn.execute(
            """
            SELECT f.name, c.file_id, c.chunk_index,
                   ts_rank(to_tsvector('english', c.chunk_text), plainto_tsquery('english', %s)) AS score,
                   c.chunk_text
            FROM file_chunks c
            JOIN drive_files f ON f.file_id = c.file_id
            WHERE to_tsvector('english', c.chunk_text) @@ plainto_tsquery('english', %s)
            ORDER BY score DESC
            LIMIT %s
            """,
            (query, query, FTS_CANDIDATES),
        ).fetchall()
    for r in fts_rows:
        if (r[1], r[2]) not in seen:
            results.append(SearchResult(file_name=r[0], file_id=r[1], chunk_index=r[2], score=float(r[3]), text=r[4]))
    return results[: limit + FTS_CANDIDATES]
