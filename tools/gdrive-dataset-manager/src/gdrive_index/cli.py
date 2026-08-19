from __future__ import annotations

import logging
from typing import Annotated

import typer

from .auth import load_credentials
from .config import load_config
from .db import connect
from .search import vector_search
from .sync import SyncEngine

app = typer.Typer(
    name="gdrive-index",
    help="Index Google Drive into pgvector and search it. Subcommands: sync, search, status, login, init-db.",
    no_args_is_help=True,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@app.command()
def sync(
    folder_id: Annotated[str | None, typer.Option(help="Restrict crawl to one folder (non-recursive)")] = None,
    limit: Annotated[int | None, typer.Option(help="Stop after N listed files (smoke testing)")] = None,
    no_media: Annotated[bool, typer.Option(help="Skip audio/video transcription")] = False,
) -> None:
    """Crawl Google Drive and index files into pgvector (incremental, resumable)."""
    cfg = load_config()
    db = connect(cfg.dsn)
    try:
        engine = SyncEngine(cfg, db, include_media=not no_media)
        engine.run(folder_id=folder_id, limit=limit)
    finally:
        db.close()


@app.command()
def search(
    query: Annotated[str, typer.Argument(help="Natural-language query")],
    limit: Annotated[int, typer.Option("--limit", "-n")] = 5,
    fts: Annotated[bool, typer.Option(help="Blend full-text search candidates with vector results")] = False,
) -> None:
    """Semantic search over indexed Drive content."""
    cfg = load_config()
    db = connect(cfg.dsn)
    try:
        results = vector_search(db, cfg, query, limit, use_fts=fts)
        if not results:
            typer.echo("No results.")
            raise typer.Exit(1)
        for i, result in enumerate(results, 1):
            typer.echo(f"\n[{i}] {result.file_name} (chunk {result.chunk_index}, score {result.score:.3f})")
            typer.echo(result.text[:500])
    finally:
        db.close()


@app.command()
def status() -> None:
    """Show indexing progress counts."""
    cfg = load_config()
    db = connect(cfg.dsn)
    try:
        with db.pool.connection() as conn:
            by_status = conn.execute(
                "SELECT status, count(*) FROM drive_files GROUP BY status ORDER BY status"
            ).fetchall()
            chunks = conn.execute("SELECT count(*) FROM file_chunks").fetchone()
        for row_status, count in by_status:
            typer.echo(f"{row_status}: {count}")
        typer.echo(f"chunks: {chunks[0]}")
    finally:
        db.close()


@app.command()
def login() -> None:
    """Run the OAuth flow for drive.readonly and store the working token."""
    cfg = load_config()
    creds = load_credentials(cfg)
    typer.echo(f"Authenticated. Scopes: {sorted(creds.scopes or [])}")
    typer.echo(f"Token stored under {cfg.state_dir}")


@app.command(name="init-db")
def init_db() -> None:
    """Create/verify the pgvector schema."""
    cfg = load_config()
    db = connect(cfg.dsn)
    db.close()
    typer.echo("Schema ready.")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
