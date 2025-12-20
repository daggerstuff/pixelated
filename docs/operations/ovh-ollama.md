## OVH Ollama On-Demand Staging Server

This guide covers the recommended way to keep multiple Ollama models (Kimi K2, Qwen3-Coder, GLM-4/6, etc.) available on OVHcloud **without** paying for a 24/7 instance. This is a **staging/inference** setup (not for training).

**Important:** These scripts run from your local machine (no GPU required) to manage a **remote** OVH AI Deploy instance. The Ollama service runs entirely on OVH's infrastructure. We rely on **OVH AI Deploy** so the container (and billing) can be started/stopped with a single CLI command.

### Architecture at a Glance

- **Container image** (`ai/ovh/Dockerfile.ollama`) installs `ollama`, exposes port `11434`, and runs the `ollama-entrypoint.sh` helper to preload any models listed in `OLLAMA_PRELOAD_MODELS`.
- **Persistent cache** lives in an OVH Object Storage bucket (e.g. `swift://pixelated-ollama-cache`). The bucket is mounted into the app as `/var/lib/ollama`, so pulled models survive restarts.
- **Controller script** (`scripts/ovh/ollama-app.sh`) wraps the `ovhai` CLI to build/push the image, deploy the app, and start/stop it on demand.

When the app is **stopped** (`ovhai app stop pixelated-ollama`), OVH stops billing for GPU/CPU/RAM, leaving only the tiny storage cost.

### Prerequisites

**Local machine (no GPU or Docker needed):**
1. `ovhai` and `jq` installed locally
2. `ovhai login` completed (authenticated to your OVH account)
3. OVHcloud Public Cloud project in `US-EAST-VA` (or set `OVH_REGION`)
4. Docker image built via CI/CD (Azure Pipelines) and pushed to OVH registry

**Remote OVH setup (one-time):**
4. An OVH Object Storage bucket to hold the Ollama cache:

```bash
ovhai storage bucket create \
  --name pixelated-ollama-cache \
  --region US-EAST-VA
```

> The script defaults to mounting `pixelated-ollama-cache@US-EAST-VA:/var/lib/ollama:rw`. Adjust `OLLAMA_VOLUME` if you use a different bucket or region.

### Build the Ollama Image (via CI/CD)

Docker images are built via CI/CD (Azure Pipelines), not locally. The `ai/ovh/Dockerfile.ollama` is used by your CI/CD pipeline to build and push the image to your OVH registry.

**Note:** No local Docker required. The image URL from your registry will be used in the deploy step.

### Deploy (or Redeploy) the App

```bash
# Provide the full image URL from your registry (built via CI/CD)
PRELOAD_MODELS="kimi:k2,qwen3-coder:14b,glm-4:9b" \
scripts/ovh/ollama-app.sh deploy <registry-url>/pixelated-ollama:latest
```

**Defaults:** L4 GPU, 4 CPU, 16Gi RAM (lightweight staging)

Key flags passed to `ovhai app create`:

- `--gpu-model L4 --gpu 1` (defaults to L4 for staging; override `GPU_MODEL`/`GPU_COUNT` if needed).
- `--volume pixelated-ollama-cache@REGION:/var/lib/ollama:rw` to persist weights.
- `--env OLLAMA_PRELOAD_MODELS=...` so the entrypoint downloads the requested variants once.
- `--port 11434` exposes the standard Ollama HTTP endpoint. OVH returns a public HTTPS URL you can share or front with Caddy/Tailscale.

> The deploy command stops and deletes any existing app of the same name before recreating it so model caches are re-used cleanly.

### Start / Stop to Control Spend

```bash
# Bring the service online (cold start ≈ 2–3 minutes)
scripts/ovh/ollama-app.sh start

# Check status + public URL
scripts/ovh/ollama-app.sh status

# Shut it down when you’re done (no GPU spend while stopped)
scripts/ovh/ollama-app.sh stop
```

Use `scripts/ovh/ollama-app.sh delete` if you want to remove the app entirely.

### Exposing the Endpoint Securely

OVH AI Deploy assigns a public HTTPS URL with JWT-protected admin endpoints. For additional security:

- Set `OVHAI_BASIC_AUTH_USER` / `OVHAI_BASIC_AUTH_PASSWORD` environment variables on the app to require HTTP basic auth.
- Or front the endpoint with your existing `Caddyfile`, `nginx-advanced.conf`, or a Tailscale funnel by running a tiny sidecar container that proxies to `localhost:11434`.

### Auto-Shutdown Ideas

- **GitHub Action / Cron**: call `scripts/ovh/ollama-app.sh stop` every night via a workflow that first runs `ovhai login --token $OVH_TOKEN`.
- **Slack command**: existing ops bots can shell out to the script to start/stop on demand.
- **Usage watchdog**: poll `/api/ps` on the Ollama endpoint; if no active sessions for N minutes, invoke the stop command.

### Customizing Models & Resources

**Defaults (staging-optimized):** L4 GPU, 4 CPU, 16Gi RAM. Suitable for inference/testing, not training.

- Override `PRELOAD_MODELS` at deploy time with a comma-separated list. You can mix quantizations, e.g. `PRELOAD_MODELS="qwen2.5-coder:7b-q4,kimi:k1,glm-4:9b-q5"`.
- For heavier workloads, change hardware by setting `GPU_MODEL` to `L40S`, `A100-80GB`, `H100`, etc., and adjust `CPU_COUNT`/`MEMORY_SIZE` to match OVH quotas.
- Use `OLLAMA_VOLUME="pixelated-ollama-cache@US-WEST-OR:/var/lib/ollama:rw"` to mount a bucket from another region if you spin up a secondary deployment closer to end users.

With this flow you can keep multiple heavyweight models cached, fire up the service only when you need it, and shut it down minutes later without losing the downloads.

