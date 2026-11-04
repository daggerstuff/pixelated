# Docker assets (`infra/docker/`)

Compose stacks, service Dockerfiles, and observability config used for local development,
training, and optional infra overlays. Production app images for CI publish use
**`infra/Dockerfile`** at the repo root (see `.github/workflows/build-images.yml`), not
files in this directory unless noted below.

## Compose entrypoints

| File | Purpose |
| ---- | ------- |
| `docker-compose.yml` | Base stack (shared services) |
| `docker-compose.dev.yml` | Local development overrides |
| `docker-compose.prod.yml` / `docker-compose.production.yml` | Production-oriented stacks |
| `docker-compose.backend.yml` | Backend API and related services |
| `docker-compose.db.yml` | PostgreSQL and database tooling |
| `docker-compose.monitoring.yml` | Prometheus, Grafana, Loki, Alertmanager, etc. |
| `docker-compose.*.yml` | Feature-specific overlays (NeMo, Milvus, Qdrant, Celery, Playwright, …) |

Run from this directory, for example:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

See `README.playwright.md` for the Playwright test image stack.

## Service Dockerfiles (this directory)

| Dockerfile | Typical use |
| ---------- | ----------- |
| `backend.Dockerfile` | Backend API service |
| `pe.Dockerfile` | Pixelated Empathy web/app build context |
| `Dockerfile.prod` / `Dockerfile.production` | Production-oriented image builds |
| `Dockerfile.playwright` | Playwright E2E runner |
| `ai-service.Dockerfile`, `bias-detection.Dockerfile`, `celery.Dockerfile` | AI and worker services |
| `express-api.Dockerfile`, `websocket-server.Dockerfile`, `worker.Dockerfile` | Supporting services |
| `axolotl-train.Dockerfile`, `training-server.Dockerfile` | Training workloads |
| `journal-research-api/Dockerfile`, `journal-research-mcp-server/Dockerfile` | Journal research sidecars |

## Supporting config

Subdirectories (`prometheus/`, `grafana/`, `traefik/`, `caddy/`, `postgres/`, `logstash/`,
etc.) hold configuration consumed by the compose files above. Scripts live under
`scripts/` (for example bucket init and build helpers).

## Security

Do not pass real secrets as plain compose environment values in shared files. Prefer
BuildKit secret mounts for image builds where supported (`infra/Dockerfile` documents
the production publish path).
