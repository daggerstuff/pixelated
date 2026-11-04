# Agent Fleet Deployment

How the 8-agent Pixelated Empathy fleet is deployed. There are two supported
homes: **Docker Compose on a fleet host** (the default) and **systemd on a
bare-metal host**. The retired AWS EKS deployment is not an option — the
Kubernetes manifests and their secret template have been removed.

## Prerequisites

- Docker Engine with Compose v2 for the Compose path, or Node.js 24.x plus
  systemd for the bare-metal path
- Cloudflare Workers AI credentials (`CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_AI_API_KEY`)
- Foresight MCP server reachable over streamable HTTP at `/mcp`
- MongoDB for session-agent persistence

## Port Assignments

Every agent listens on container port `2000`. The host port map below is what
callers outside the Compose network use, and what
`agents/px.config.json` points at:

| Agent      | Host port |
| ---------- | --------- |
| supervisor | 2000      |
| advisor    | 2005      |
| content    | 2010      |
| eve        | 2015      |
| intake     | 2020      |
| pipeline   | 2025      |
| qa         | 2030      |
| session    | 2035      |

## Option 1: Docker Compose (default)

Images are published to Docker Hub by `.github/workflows/build-images.yml` on a
green `staging` CI run, so the host does not need a checkout to deploy.

```bash
# 1. Create the env file
cp agents/deploy/.env.agents.example agents/deploy/.env.agents
$EDITOR agents/deploy/.env.agents   # fill in credentials

# 2. Validate the Compose file (no credentials needed — see below)
make -f Makefile.agents check

# 3. Pull and start the fleet
make -f Makefile.agents pull
make -f Makefile.agents deploy

# 4. Check health
curl http://127.0.0.1:2000/eve/v1/health

# 5. View logs
docker compose -f agents/deploy/docker-compose.yaml logs -f

# 6. Stop
make -f Makefile.agents down
```

`docker compose config` refuses to parse the file when a service `env_file` is
missing, and `.env.agents` stays **required** on purpose — making it optional
would let agents boot without auth. `make -f Makefile.agents check` therefore
validates against a temporary copy of the committed example when
`.env.agents` is absent, and deletes the copy afterwards.

To run an unreleased change instead of the published images, build from the
checkout — every service declares both `image` and `build`, so the same
commands work:

```bash
docker compose -f agents/deploy/docker-compose.yaml up -d --build
```

Pin a different tag (for example a staging build) by exporting
`AGENT_IMAGE_TAG=staging` or passing `make -f Makefile.agents deploy TAG=staging`.
`AGENT_IMAGE_PREFIX` overrides the registry/namespace.

### Publishing images

```bash
make -f Makefile.agents build-all   # build all 8 locally
make -f Makefile.agents push-all    # build + push to docker.io/pixelatedempathy
```

## Option 2: systemd (bare-metal / VM)

Best for a single host without a container runtime.

```bash
# 1. Build all agents
for agent in supervisor advisor content eve intake pipeline qa session; do
  (cd agents/${agent}-agent && pnpm exec eve build)
done

# 2. Install services (creates /opt/pixelated/agents.env)
sudo bash agents/deploy/systemd/install.sh
sudo nano /opt/pixelated/agents.env   # fill in real credentials

# 3. Start all services
for u in pixelated-{supervisor,advisor,content,eve,intake,pipeline,qa,session}-agent; do
  sudo systemctl start $u
done

# 4. Verify
sudo systemctl status 'pixelated-*-agent'
curl http://127.0.0.1:2000/eve/v1/health
```

Uninstall:

```bash
sudo bash agents/deploy/systemd/install.sh --uninstall
```

## Pointing clients at the fleet

`agents/px.config.json` holds the endpoints `px` talks to, and they default to
the local port map above (`http://127.0.0.1:<port>`). Two environment
overrides change where they resolve, applied in this order:

| Variable        | Effect                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `PX_FLEET_HOST` | Swaps the hostname on every agent endpoint, keeping each agent's port. |
| `PX_LOCAL=1`    | Points every agent at `http://localhost:${PX_LOCAL_PORT:-2000}`.       |

So a remote fleet host needs no config edit:

```bash
PX_FLEET_HOST=agents.example.com px config   # endpoints resolve to that host
```

## Health Check

All agents expose `GET /eve/v1/health` returning:

```json
{ "ok": true, "status": "ready", "workflowId": "workflow//eve//workflowEntry" }
```

## Session API

All agents accept conversational sessions via:

- `POST /eve/v1/session` — create a session (requires HTTP Basic auth)
- `GET /eve/v1/session/:sessionId/stream` — SSE stream of session events

Inbound auth has no default credential: when `EVE_AUTH_USERNAME` /
`EVE_AUTH_PASSWORD` are unset, requests answer `401` and the supervisor sends
no `Authorization` header to its subagents. On Vercel the fleet uses
`vercelOidc()` instead.

## Scheduled Agents

Three agents have cron schedules (handled automatically on Vercel; on a Compose
or systemd host, point the host scheduler at the POST endpoint):

| Agent    | Schedule      | Endpoint                                   |
| -------- | ------------- | ------------------------------------------ |
| qa       | `30 23 * * *` | `POST /eve/v1/dev/schedules/daily-review`  |
| advisor  | `0 9 * * 1`   | `POST /eve/v1/dev/schedules/weekly-review` |
| pipeline | `0 9 * * 1`   | `POST /eve/v1/dev/schedules/weekly-train`  |

Example crontab entry:

```cron
30 23 * * *  curl -s -u "$EVE_AUTH_USERNAME:$EVE_AUTH_PASSWORD" -X POST http://127.0.0.1:2030/eve/v1/dev/schedules/daily-review
 0  9 * * 1  curl -s -u "$EVE_AUTH_USERNAME:$EVE_AUTH_PASSWORD" -X POST http://127.0.0.1:2005/eve/v1/dev/schedules/weekly-review
 0  9 * * 1  curl -s -u "$EVE_AUTH_USERNAME:$EVE_AUTH_PASSWORD" -X POST http://127.0.0.1:2025/eve/v1/dev/schedules/weekly-train
```
