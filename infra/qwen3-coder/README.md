# Qwen Coder for Claude Code Open (OpenAI-compatible)

This directory provides a ready-to-run setup to host a local OpenAI-compatible endpoint backed by Qwen Coder via Ollama + LiteLLM.

- API: http://<server-ip>:8080/v1 (OpenAI-compatible)
- Default model alias: `qwen3-coder` (mapped to `ollama/qwen3-coder:latest`)
- Auth: Single header `Authorization: Bearer <LITELLM_MASTER_KEY>`

## Prereqs
- Docker + Docker Compose installed
- Ports 8080 (public) and 11434 (loopback) available

## Quick start

1. Copy env file and set a strong key
   ```sh
   cp .env.example .env
   sed -i 's/replace-with-strong-random-string/$(openssl rand -hex 24)/' .env
   ```

2. Start services
   ```sh
   docker compose up -d
   ```

3. Pull the model on first use (one-time, big download). Using host Ollama:
   ```sh
   # Pull Qwen3 Coder model
   ollama pull qwen3-coder:latest
   ```

4. Test the API (optional)
   ```sh
   curl -s http://localhost:8080/v1/models -H "Authorization: Bearer $(grep LITELLM_MASTER_KEY .env | cut -d= -f2)" | jq
   curl -s http://localhost:8080/v1/chat/completions \
     -H "Authorization: Bearer $(grep LITELLM_MASTER_KEY .env | cut -d= -f2)" \
     -H 'Content-Type: application/json' \
     -d '{"model": "qwen3-coder", "messages": [{"role": "user", "content": "Write a Python function to add two numbers."}]}' | jq
   ```

## Configure Claude Code Open

In Claude Code Open settings, add a custom provider with:
- Endpoint: `http://<server-ip>:8080/v1`
- API Key: the same `LITELLM_MASTER_KEY`
- Model: `qwen3-coder`

Notes:
- You can map to other variants by editing `litellm.config.yaml` and pulling the corresponding Ollama tags.

## Operations
- Logs: `docker logs -f litellm` (Ollama runs on the host, check `journalctl -u ollama` or `ollama serve` logs on the VPS)
- Stop: `docker compose down`
- Update images: `docker compose pull && docker compose up -d`

## Security
- Only port 8080 is exposed publicly. Ensure host firewall only allows your IPs.
- Rotate `LITELLM_MASTER_KEY` if compromised.

Notes
- On Linux, the LiteLLM container reaches host Ollama via the Docker bridge gateway `http://172.17.0.1:11434` (configured in `litellm.config.yaml`).
