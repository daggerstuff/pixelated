# gdrive-dataset-manager

Indexes a Google Drive (~2TB-scale) into a local pgvector database for semantic
search. Background sync extracts text from docs, PDFs, and spreadsheets,
transcribes audio/video with faster-whisper, embeds chunks with
`all-MiniLM-L6-v2`, and stores them in a dedicated Postgres container.

## Setup

```bash
# 1. Start the pgvector database (password comes from .env)
cd docker
docker compose -f docker-compose.drive-index.yml --env-file ../tools/gdrive-dataset-manager/.env up -d

# 2. Configure (already gitignored)
cp tools/gdrive-dataset-manager/.env.example tools/gdrive-dataset-manager/.env
# edit the CHANGEME values

# 3. Authenticate (interactive browser OAuth, drive.readonly scope)
# If SSH'd in, forward the callback port first: ssh -L 8080:localhost:8080 <user>@<host>
uv run --package gdrive-dataset-manager gdrive-auth login
```

## Usage

```bash
# Smoke test on a small folder before crawling the whole Drive
uv run --package gdrive-dataset-manager gdrive-sync sync --folder-id <FOLDER_ID> --limit 20

# Full crawl (incremental, resumable — safe to re-run; reconciles deletions)
uv run --package gdrive-dataset-manager gdrive-sync sync

# Skip audio/video transcription
uv run --package gdrive-dataset-manager gdrive-sync sync --no-media

# Search
uv run --package gdrive-dataset-manager gdrive-search search "invoice from acme" -n 5
uv run --package gdrive-dataset-manager gdrive-search search "invoice" --fts

# Progress
uv run --package gdrive-dataset-manager gdrive-status status
```

## Notes

- Incremental: files are skipped when `modified_time` matches the indexed row.
- Crash-resumable: per-file transactions; stale `processing` rows reset on
  start.
- Downloads spool to `DRIVE_INDEX_TMPDIR` (capped at
  `DRIVE_INDEX_MAX_DOWNLOAD_BYTES`), never held in memory.
- Media: ffmpeg + faster-whisper `small` int8 on CPU (~2-4x realtime); switch
  `WHISPER_MODEL=base` for speed.
- Audio/video transcription requires `ffmpeg`
  (`sudo apt-get install -y ffmpeg`).
- The clinical `pixelated-postgres` is untouched; this tool uses its own
  container on port 5433.
