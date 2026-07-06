"""Memory CRUD and search commands."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from foresight_mcp import (
    MemoryAction,
    MemoryUpdateOptions,
    SearchOptions,
    manage_memories,
    reinforce_memory,
    search_memories,
    store_memory,
)
from foresight_mcp.server import init_db

from foresight_cli.utils import config as cfg, output as out

app = typer.Typer(help="Store, retrieve, search, and manage memories.")


def _init_and_user(user_id_override: str | None = None):
    """Initialize DB backend and resolve user ID."""
    init_db()
    from foresight_mcp.server import _initialize_backend

    _initialize_backend()
    return cfg.get_user_id(user_id_override)


@app.command()
def store(
    content: str = typer.Argument(..., help="Memory content to store"),
    scope: str = typer.Option("session", "--scope", "-s", help="Memory scope (session/arc/trait/fact)"),
    retention: str = typer.Option(
        "short_term", "--retention", "-r", help="Retention (ephemeral/short_term/long_term/permanent)"
    ),
    category: str = typer.Option("fact", "--category", "-c", help="Category label"),
    importance: float = typer.Option(0.5, "--importance", "-i", min=0.0, max=1.0, help="Importance (0.0–1.0)"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Store a new memory."""
    _init_and_user(user_id)
    result = store_memory(
        content=content,
        scope=scope,
        retention=retention,
        category=category,
        importance=importance,
    )
    out.done(f"Memory stored: {result}")


@app.command()
def get(
    memory_id: str = typer.Argument(..., help="Memory ID to retrieve"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Retrieve a specific memory by ID."""
    _init_and_user(user_id)
    result = search_memories(options=SearchOptions(query_type="id", memory_id=memory_id))
    if out.get_settings().mode == "agent":
        out.print_json(result)
    else:
        out.result_block(result, title=f"Memory {memory_id}")


@app.command("list")
def list_memories(
    limit: int = typer.Option(20, "--limit", "-l", help="Number of memories"),
    offset: int = typer.Option(0, "--offset", "-o", help="Offset"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """List all memories (latest first)."""
    _init_and_user(user_id)
    result = search_memories(options=SearchOptions(query_type="list", limit=limit, offset=offset))
    from foresight_cli.utils.output import _stdout_console

    _stdout_console.print(result)


@app.command()
def query(
    query_text: str = typer.Argument(..., help="Search query"),
    limit: int = typer.Option(10, "--limit", "-l", help="Number of results"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Search memories by content keyword."""
    _init_and_user(user_id)
    result = search_memories(options=SearchOptions(query_type="keyword", query=query_text, limit=limit))

    if isinstance(result, list):
        rows = []
        for m in result:
            mid = m.get("memory_id", m.get("id", "?"))
            content = str(m.get("content", ""))[:80]
            score = m.get("score", m.get("relevance", ""))
            rows.append([mid, str(score), content])

        out.print_table(["ID", "Score", "Content (truncated)"], rows, title=f"Search: {query_text}")
    else:
        out.print_json(result)


@app.command()
def update(
    memory_id: str = typer.Argument(..., help="Memory ID"),
    content: str | None = typer.Option(None, "--content", "-c", help="New content"),
    category: str | None = typer.Option(None, "--category", help="New category"),
    scope: str | None = typer.Option(None, "--scope", help="New scope"),
    retention: str | None = typer.Option(None, "--retention", help="New retention"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Update an existing memory."""
    _init_and_user(user_id)
    result = manage_memories(
        options=MemoryAction(
            action="update",
            memory_id=memory_id,
            updates=MemoryUpdateOptions(
                content=content,
                category=category,
                scope=scope,
                retention=retention,
            ),
        ),
    )
    out.done(f"Updated {memory_id}: {result}")


@app.command()
def delete(
    memory_id: str = typer.Argument(..., help="Memory ID"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Delete a memory by ID."""
    _init_and_user(user_id)
    result = manage_memories(options=MemoryAction(action="delete", memory_id=memory_id))
    out.warn(f"Deleted {memory_id}: {result}")


@app.command()
def reinforce(
    memory_id: str = typer.Argument(..., help="Memory ID to reinforce"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Boost a memory's strength without retrieving it."""
    _init_and_user(user_id)
    result = reinforce_memory(memory_id=memory_id, user_id=cfg.get_user_id(user_id))
    out.done(f"Reinforced {memory_id}: {result}")


@app.command()
def search(
    query_text: str = typer.Argument(..., help="Search query"),
    mode: str = typer.Option("keyword", "--mode", "-m", help="Search mode: keyword, semantic, hybrid"),
    limit: int = typer.Option(10, "--limit", "-l", help="Number of results"),
    category: str | None = typer.Option(None, "--category", "-c", help="Filter by category"),
    min_score: float = typer.Option(0.0, "--min-score", help="Minimum relevance score"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Advanced search across memories with filters."""
    _init_and_user(user_id)

    if mode == "semantic":
        try:
            from foresight_mcp import semantic_search_memories

            result = semantic_search_memories(query=query_text, limit=limit, min_score=min_score)
        except ImportError:
            out.error("Semantic search requires embedding support. Use --mode keyword (default).")
            raise typer.Exit(1)
    else:
        result = search_memories(options=SearchOptions(query_type="keyword", query=query_text, limit=limit))

    if isinstance(result, list):
        if category:
            result = [m for m in result if m.get("category") == category]

        rows = []
        for m in result:
            mid = m.get("memory_id", m.get("id", "?"))
            cat = m.get("category", "-")
            content = str(m.get("content", ""))[:80]
            score = m.get("score", m.get("relevance", "-"))
            rows.append([mid, cat, str(score), content])

        out.print_table(
            ["ID", "Category", "Score", "Content (truncated)"], rows, title=f"Search ({mode}): {query_text}"
        )
    else:
        out.print_json(result)


@app.command()
def export(
    output: str = typer.Argument(..., help="Output file path (.json or .jsonl)"),
    limit: int = typer.Option(0, "--limit", "-l", help="Max memories (0 = all)"),
    category: str | None = typer.Option(None, "--category", "-c", help="Filter by category"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Export memories to a JSON/JSONL file."""
    _init_and_user(user_id)

    all_memories = search_memories(
        options=SearchOptions(query_type="list", limit=limit if limit > 0 else 10_000, offset=0)
    )

    if not isinstance(all_memories, list):
        out.error("Failed to retrieve memories for export.")
        raise typer.Exit(1)

    if len(all_memories) == 0:
        out.warn("No memories found to export.")

    if category:
        all_memories = [m for m in all_memories if m.get("category") == category]

    if limit > 0:
        all_memories = all_memories[:limit]

    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.suffix == ".jsonl":
        path.write_text("\n".join(json.dumps(m, default=str) for m in all_memories))
    else:
        path.write_text(__import__("json").dumps(all_memories, indent=2, default=str))

    out.done(f"Exported {len(all_memories)} memories to {path}")


@app.command("import")
def import_memories(
    input_file: str = typer.Argument(..., help="Input file path (.json or .jsonl)"),
    scope: str = typer.Option("session", "--scope", "-s", help="Default scope for imported memories"),
    retention: str = typer.Option("short_term", "--retention", "-r", help="Default retention"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Validate without importing"),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override"),
):
    """Import memories from a JSON/JSONL file."""
    _init_and_user(user_id)
    path = Path(input_file)

    if not path.exists():
        out.error(f"File not found: {input_file}")
        raise typer.Exit(1)

    raw = path.read_text()
    if path.suffix == ".jsonl":
        items = [json.loads(line) for line in raw.strip().split("\n") if line.strip()]
    else:
        items = json.loads(raw)
        if isinstance(items, dict):
            items = [items]

    if not isinstance(items, list):
        out.error("Invalid format: expected a list of memories.")
        raise typer.Exit(1)

    if dry_run:
        out.info(f"Would import {len(items)} memories (dry run)")
        return

    imported = 0
    for item in items:
        content = item.get("content", item.get("text", ""))
        if not content:
            continue
        store_memory(
            content=content,
            scope=item.get("scope", scope),
            retention=item.get("retention", retention),
            category=item.get("category", "fact"),
            importance=item.get("importance", 0.5),
        )
        imported += 1

    out.done(f"Imported {imported} memories from {path}")
