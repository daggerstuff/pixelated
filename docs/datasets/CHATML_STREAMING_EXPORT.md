# ChatML Streaming Export (Release 0)

Streaming exporter writes ChatML JSONL shards directly to S3 (no local files, no full downloads).

## Environment
Set credentials via env or your AWS profile. Required/optional vars:

- `AWS_S3_ENDPOINT` (default: `https://s3.us-east-va.io.cloud.ovh.us`)
- `AWS_S3_BUCKET` (default: `pixel-data`)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or use default AWS creds/profile)
- `CHATML_OUTPUT_PREFIX` (default: `releases/v2026-01-07/chatml`)
- `RELEASE_MANIFEST_KEY` (default: `releases/v2026-01-07/RELEASE_0_UNIFIED_MANIFEST.json`)
- `CHATML_MAX_PER_DATASET` (optional; limit records per dataset for smoke tests)
- `CHATML_MAX_WORKERS` (optional; parallel family exports, default 1)

## Smoke Test (limit 200 records per dataset)
```bash
export AWS_ACCESS_KEY_ID=...   # or rely on configured profile
export AWS_SECRET_ACCESS_KEY=...
export AWS_S3_BUCKET=pixel-data
export AWS_S3_ENDPOINT=https://s3.us-east-va.io.cloud.ovh.us
export CHATML_OUTPUT_PREFIX=releases/v2026-01-07/chatml
export CHATML_MAX_PER_DATASET=200
export CHATML_MAX_WORKERS=2   # optional parallel families
uv run ai/dataset_pipeline/chatml_export_generator.py
```

## Outputs
- Shards: `s3://$AWS_S3_BUCKET/$CHATML_OUTPUT_PREFIX/<family>_chatml-shard-00001.jsonl`
- Summary: `s3://$AWS_S3_BUCKET/$CHATML_OUTPUT_PREFIX/release_0_export_summary.json`

## Behavior
- Streams JSONL via `iter_lines`, converts each record to ChatML, uploads via multipart (8MB parts, >=5MB safe).
- Shard rollover every 250,000 records (configurable in code).
- Minimal logging, no PII content logged.
- Works with boto3 default credential chain when env vars are not set.
