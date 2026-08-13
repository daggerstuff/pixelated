# Agent Fleet Deployment

Three deployment options for the 8-agent Pixelated Empathy fleet.

## Prerequisites

- Node.js 24.x (agents use Eve framework)
- Each agent must be built: `cd agents/<agent>-agent && pnpm exec eve build`
- Cloudflare Workers AI credentials (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_KEY`)
- Foresight MCP server running and reachable (streamable HTTP at `/mcp`)
- MongoDB for session-agent persistence

## Port Assignments

| Agent    | Port |
|----------|------|
| supervisor | 2000 |
| advisor    | 2005 |
| content    | 2010 |
| eve        | 2015 |
| intake     | 2020 |
| pipeline   | 2025 |
| qa         | 2030 |
| session    | 2035 |

## Option 1: systemd (bare-metal / VM)

Best for single-server deployment on standard Linux hosts.

```bash
# 1. Build all agents
for agent in supervisor advisor content eve intake pipeline qa session; do
  cd agents/${agent}-agent && pnpm exec eve build && cd ../..
done

# 2. Create env file with credentials
sudo bash agents/deploy/systemd/install.sh  # creates /opt/pixelated/agents.env
sudo nano /opt/pixelated/agents.env          # fill in real credentials

# 3. Install and start services
sudo bash agents/deploy/systemd/install.sh

# 4. Start all services
for u in pixelated-{supervisor,advisor,content,eve,intake,pipeline,qa,session}-agent; do
  sudo systemctl start $u
done

# 5. Verify
sudo systemctl status pixelated-*-agent
curl http://127.0.0.1:2000/eve/v1/health
```

Uninstall:
```bash
sudo bash agents/deploy/systemd/install.sh --uninstall
```

## Option 2: Docker Compose

Best for isolated, reproducible deployments.

```bash
# 1. Create env file
cp agents/deploy/.env.agents.example agents/deploy/.env.agents
nano agents/deploy/.env.agents  # fill in credentials

# 2. Build and start all services
docker compose -f agents/deploy/docker-compose.yaml up -d --build

# 3. Check health
curl http://127.0.0.1:2000/eve/v1/health

# 4. View logs
docker compose -f agents/deploy/docker-compose.yaml logs -f

# 5. Stop
docker compose -f agents/deploy/docker-compose.yaml down
```

## Option 3: Kubernetes

Best for multi-node, auto-scaling, or managed cloud deployments.

```bash
# 1. Build and push all images
make -f Makefile.agents push-all

# 2. Create namespace and secrets
#    Edit agents/k8s/namespace-secrets.yaml with real values, then:
kubectl apply -f agents/k8s/namespace-secrets.yaml

# 3. Deploy all agents
make -f Makefile.agents deploy-k8s

# 4. Verify
kubectl get pods -n pixelated-empathy
kubectl port-forward -n pixelated-empathy svc/supervisor-agent 8080:80
curl http://127.0.0.1:8080/eve/v1/health
```

## Health Check

All agents expose `GET /eve/v1/health` returning:
```json
{"ok": true, "status": "ready", "workflowId": "workflow//eve//workflowEntry"}
```

## Session API

All agents accept conversational sessions via:
- `POST /eve/v1/session` — create a session (requires HTTP Basic auth)
- `GET /eve/v1/session/:sessionId/stream` — SSE stream of session events

## Scheduled Agents

Three agents have cron schedules (handled automatically on Vercel; on
bare-metal/k8s, point the host scheduler at the POST endpoint):

| Agent    | Schedule        | Endpoint                                |
|----------|-----------------|-----------------------------------------|
| qa       | `30 23 * * *`   | `POST /eve/v1/dev/schedules/daily-review` |
| advisor  | `0 9 * * 1`     | `POST /eve/v1/dev/schedules/weekly-review` |
| pipeline | `0 9 * * 1`     | `POST /eve/v1/dev/schedules/weekly-train` |

Example crontab entry:
```cron
30 23 * * *  curl -s -u admin:secret -X POST http://127.0.0.1:2030/eve/v1/dev/schedules/daily-review
 0  9 * * 1  curl -s -u admin:secret -X POST http://127.0.0.1:2005/eve/v1/dev/schedules/weekly-review
 0  9 * * 1  curl -s -u admin:secret -X POST http://127.0.0.1:2025/eve/v1/dev/schedules/weekly-train
```
