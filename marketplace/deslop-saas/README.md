# Deslop SaaS — Dataset Hygiene API

HTTP API for detecting and removing AI-generated slop from JSON/JSONL datasets. Scan for filler phrases, clean datasets, preview changes, and optionally regenerate flagged records with an LLM — all behind a single FastAPI service you can run on any cloud.

Deslop SaaS wraps the [deslop](https://pypi.org/project/deslop-cli/) dataset-hygiene engine in a RESTful API so SaaS platforms can upload a corpus, get a quality receipt, and download a cleaned JSONL file in one round trip.

## Features

- **Pattern-based slop detection** — scan JSON/JSONL for AI clichés, filler phrases, hedging, sycophancy, and fabrication signals.
- **Dataset cleaning** — remove or rewrite slop with weighted, deterministic replacements and punctuation normalization.
- **Preview mode** — see before/after diffs for every field without writing a file.
- **LLM regeneration** — optionally rewrite flagged records through an Ollama or OpenAI-compatible endpoint.
- **Rule packs** — 13+ bundled rule packs (generic-ai, customer-support, clinical, sales, devrel, academic, roleplay, bias, sycophancy, fabrication-signal, …) plus custom `rules.yaml` uploads.
- **Quality reports** — slop density, top patterns, fields affected, and example findings returned as JSON.

## Quickstart

```bash
cd deslop-saas
cp .env.example .env        # optional: configure LLM endpoint
docker-compose up --build
```

The API is now live at `http://localhost:8000`.

```bash
curl -s http://localhost:8000/health
# {"status":"ok","service":"deslop-saas","version":"0.3.0"}
```

### Scan a dataset

```bash
curl -s -X POST http://localhost:8000/scan \
  -F "file=@samples.jsonl" \
  -F "packs=generic-ai,customer-support" | jq
```

### Clean a dataset (downloads cleaned JSONL)

```bash
curl -s -X POST http://localhost:8000/clean \
  -F "file=@samples.jsonl" \
  -F "packs=generic-ai" \
  -o cleaned.jsonl
head -1 cleaned.jsonl
```

## API Reference

All endpoints accept `multipart/form-data` file uploads. JSONL (one JSON object per line) and JSON arrays are both supported.

### `GET /health`

Health check.

```bash
curl -s http://localhost:8000/health
```

### `GET /rules`

List available bundled rule packs and their marker counts.

```bash
curl -s http://localhost:8000/rules | jq
```

### `POST /scan`

Upload a dataset and return a scan report: slop density, top patterns, fields affected, and example findings.

| Form field      | Type    | Required | Description                                   |
| --------------- | ------- | -------- | --------------------------------------------- |
| `file`          | file    | yes      | JSON array or JSONL file                      |
| `packs`         | string  | no       | Comma-separated bundled rule packs            |
| `fields`        | string  | no       | Comma-separated field path filters            |
| `sample`        | integer | no       | Scan only the first N records                 |
| `finding_limit` | integer | no       | Max findings to return (default 200)          |
| `rules`         | string  | no       | Custom `rules.yaml` body (inline upload)      |

```bash
curl -s -X POST http://localhost:8000/scan \
  -F "file=@data.jsonl" \
  -F "packs=generic-ai,academic" \
  -F "fields=messages[].content,response" | jq
```

### `POST /clean`

Upload a dataset, remove/rewrite slop, and return the cleaned JSONL as a downloadable response. Processing stats are returned in `X-*` response headers.

| Form field | Type   | Required | Description                              |
| ---------- | ------ | -------- | ---------------------------------------- |
| `file`     | file   | yes      | JSON array or JSONL file                 |
| `packs`    | string | no       | Comma-separated bundled rule packs       |
| `fields`   | string | no       | Comma-separated field path filters       |
| `rules`    | string | no       | Custom `rules.yaml` body (inline upload) |

```bash
curl -s -X POST http://localhost:8000/clean \
  -F "file=@data.jsonl" \
  -F "packs=generic-ai,customer-support" \
  -D - -o cleaned.jsonl | grep -i 'x-records'
```

### `POST /preview`

Preview the changes deslop would make without writing a file. Returns a list of `{record_id, field_path, before, after}` items.

| Form field | Type    | Required | Description                              |
| ---------- | ------- | -------- | ---------------------------------------- |
| `file`     | file    | yes      | JSON array or JSONL file                 |
| `packs`    | string  | no       | Comma-separated bundled rule packs        |
| `fields`   | string  | no       | Comma-separated field path filters       |
| `limit`    | integer | no       | Max preview items (default 20)           |
| `rules`    | string  | no       | Custom `rules.yaml` body (inline upload) |

```bash
curl -s -X POST http://localhost:8000/preview \
  -F "file=@data.jsonl" \
  -F "packs=generic-ai" \
  -F "limit=5" | jq
```

### `POST /regen`

Regenerate flagged records via an LLM and return the regenerated JSONL. Requires LLM configuration (environment variables or form fields).

| Form field    | Type    | Required | Description                                                        |
| ------------- | ------- | -------- | ------------------------------------------------------------------ |
| `file`        | file    | yes      | JSON array or JSONL file                                           |
| `provider`    | string  | no       | `ollama` (default) or `openai-compatible`                          |
| `endpoint`    | string  | no       | LLM endpoint (defaults to `DESLOP_LLM_ENDPOINT`)                  |
| `model`       | string  | no       | LLM model (defaults to `DESLOP_LLM_MODEL`)                         |
| `all_records` | boolean | no       | Regenerate all records, not only flagged ones (default false)      |
| `packs`       | string  | no       | Comma-separated bundled rule packs                                 |
| `api_key_env` | string  | no       | Env var name for OpenAI-compatible API key (default OPENAI_API_KEY) |
| `rules`       | string  | no       | Custom `rules.yaml` body (inline upload)                           |

```bash
curl -s -X POST http://localhost:8000/regen \
  -F "file=@data.jsonl" \
  -F "provider=ollama" \
  -F "endpoint=http://localhost:11434" \
  -F "model=llama3" \
  -o regen.jsonl
```

## Configuration

Deslop SaaS is configured via environment variables.

| Variable                | Default | Description                                              |
| ----------------------- | ------- | -------------------------------------------------------- |
| `DESLOP_LLM_ENDPOINT`   | _empty_ | LLM endpoint for `/regen` (Ollama or OpenAI-compatible).  |
| `DESLOP_LLM_MODEL`      | _empty_ | LLM model name for `/regen`.                             |
| `OPENAI_API_KEY`        | _empty_ | API key for OpenAI-compatible providers.                 |
| `OLLAMA_API_KEY`        | _empty_ | Optional API key for authenticated Ollama deployments.   |

For local development without Docker:

```bash
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Rule Packs

Deslop ships with bundled rule packs covering common AI-slop genres. Use them via the `packs` form field on `/scan`, `/clean`, `/preview`, and `/regen`.

| Pack                  | Markers | Use case                                                |
| --------------------- | ------: | ------------------------------------------------------- |
| `generic-ai`          |       ~50 | Generic AI clichés, hedge words, marketing buzzwords.   |
| `customer-support`    |       ~30 | Support-bot boilerplate ("rest assured", "we apologize"). |
| `clinical`            |       ~37 | Therapy-speak and self-help jargon.                    |
| `sales`               |       ~36 | Sales/marketing buzzphrases.                           |
| `devrel`              |       ~33 | Developer-relations marketing fluff.                    |
| `academic`            |       ~32 | Stiff academic filler.                                  |
| `roleplay`            |       ~30 | Roleplay action narration.                             |
| `therapy-simulation`  |       ~32 | Simulated-therapist reflection prompts.                |
| `chatbot-assistant`   |       ~35 | Assistant sycophancy ("I'd be happy to", "certainly"). |
| `synthetic-evals`     |       ~16 | Step-by-step eval leakage.                             |
| `bias`                |       ~25 | Stigmatizing / biased phrasing.                         |
| `sycophancy`          |       ~40 | Agreement and caving / backtracking.                   |
| `fabrication-signal`  |       ~18 | Fake-citation fabrication signals.                     |

Run `GET /rules` to get the live marker counts for every pack.

### Custom rules

Pass a custom `rules.yaml` body inline via the `rules` form field on any endpoint. The schema:

```yaml
pools:
  "in today's fast-paced world":
    - ["these days", 0.4]
    - [null, 0.6]
markers:
  - "my new marker"
```

Each pool entry is `[replacement_or_null, weight]`. Markers are additional patterns to detect (and drop) without a replacement.

## License

MIT — see [LICENSE](LICENSE).

## AWS Marketplace

Deslop SaaS is published as a **SaaS product** on the AWS Marketplace. Subscribe through the AWS Marketplace console, then configure your fulfillment endpoint:

1. **Subscribe** to the Deslop SaaS listing in AWS Marketplace.
2. AWS Marketplace redirects new subscribers to the fulfillment URL for this service.
3. The service reads the customer identifier from the AWS Marketplace entitlement/subscription flow and provisions API access.
4. Call the `/health` endpoint to verify connectivity before processing datasets.

### Deployment notes

- The included `Dockerfile` and `docker-compose.yml` run the API on port `8000`.
- For production, deploy the container behind an HTTPS-terminating load balancer (ALB/API Gateway) and front it with authentication tied to AWS Marketplace entitlements.
- Persistent LLM access for `/regen` requires `DESLOP_LLM_ENDPOINT` and `DESLOP_LLM_MODEL`; without them, `/scan`, `/clean`, `/preview`, and `/rules` remain fully functional.
- Metering: integrate the [AWS Marketplace Metering Service](https://docs.aws.amazon.com/marketplace/latest/seller-guide/saas-metering.html) to report per-request or per-record usage against the buyer's subscription.

### Subscription tiers

- **Scan** — `/scan`, `/preview`, `/rules`, `/health` (no LLM required).
- **Clean** — adds `/clean` (pattern-based rewriting).
- **Regen** — adds `/regen` (LLM-backed regeneration, requires LLM endpoint).
