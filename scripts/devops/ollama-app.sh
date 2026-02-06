#!/usr/bin/env bash
set -euo pipefail

OVH_REGION="${OVH_REGION:-US-EAST-VA}"
APP_NAME="${APP_NAME:-pixelated-ollama}"
GPU_MODEL="${GPU_MODEL:-L4}"
GPU_COUNT="${GPU_COUNT:-1}"
CPU_COUNT="${CPU_COUNT:-4}"
MEMORY_SIZE="${MEMORY_SIZE:-16Gi}"
PORT="${PORT:-11434}"
REPLICAS="${REPLICAS:-1}"
PRELOAD_MODELS="${PRELOAD_MODELS:-kimi:k2,qwen3-coder:14b,glm-4:9b}"
VOLUME_REF="${OLLAMA_VOLUME:-pixelated-ollama-cache@$OVH_REGION:/models:rw}"

# Map GPU model names to OVH flavor IDs
get_flavor() {
  case "${GPU_MODEL,,}" in
    l4) echo "l4-1-gpu" ;;
    l40s) echo "l40s-1-gpu" ;;
    a100|a100-80gb) echo "a100-1-gpu" ;;
    h100) echo "h100-1-gpu" ;;
    *) echo "l4-1-gpu" ;; # default
  esac
}

find_app_id() {
  # Try to find app ID by name (in spec.name), label, or direct ID match
  ovhai app list --output json 2>/dev/null | jq -r --arg name "$APP_NAME" '.[] | select((.spec.name // "") == $name or .id == $name or (.spec.labels."app" // "") == $name) | .id' | head -1
}
IMAGE_TAG="${IMAGE_TAG:-pixelated-ollama:latest}"
# Note: CI/CD builds with both Build.BuildNumber and 'latest' tags
# Default to 'latest' for convenience, override with IMAGE_TAG if needed
DOCKERFILE="${DOCKERFILE:-ai/ovh/Dockerfile.ollama}"

log() {
  printf '[ollama-cli] %s\n' "$1"
}

ensure_cli() {
  for cmd in ovhai jq; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "Missing dependency: $cmd" >&2
      exit 1
    fi
  done
  if ! ovhai me >/dev/null 2>&1; then
    echo "ovhai CLI is not authenticated. Run: ovhai login" >&2
    exit 1
  fi
}

registry_url() {
  # Parse table output: skip header, get last field (URL) from first data row
  ovhai registry list | tail -n +2 | awk '{print $NF}'
}

# Note: Image building should be done via CI/CD (e.g., Azure Pipelines)
# This function is kept for reference but requires docker locally
build_image() {
  echo "Error: Local Docker builds are not supported." >&2
  echo "Build the image via CI/CD (Azure Pipelines) or OVH's remote build service." >&2
  echo "Then provide the full image URL to 'deploy' command." >&2
  exit 1
}

deploy_app() {
  ensure_cli
  local image="${1:-}"
  if [ -z "$image" ]; then
    # Auto-construct from registry + default tag
    local registry="$(registry_url)"
    if [ -n "$registry" ]; then
      image="$registry/$IMAGE_TAG"
      log "No image URL provided, using: $image"
    else
      echo "Error: Image URL required and unable to determine registry." >&2
      echo "Example: scripts/ovh/ollama-app.sh deploy <registry-url>/pixelated-ollama:latest" >&2
      exit 1
    fi
  elif [[ "$image" != *"/"* ]]; then
    # If only tag provided (e.g., "pixelated-ollama:latest"), prepend registry
    local registry="$(registry_url)"
    if [ -n "$registry" ]; then
      image="$registry/$image"
      log "Constructed full image URL: $image"
    else
      echo "Error: Unable to determine registry. Provide full image URL." >&2
      exit 1
    fi
  fi

  local existing_id="$(find_app_id)"
  if [ -n "$existing_id" ]; then
    log "App ${APP_NAME} (ID: $existing_id) exists; redeploying"
    ovhai app stop "$existing_id" || true
    ovhai app delete "$existing_id" || true
    sleep 5
  fi

  local flavor="$(get_flavor)"
  log "Creating app ${APP_NAME} in ${OVH_REGION}"
  log "  Image: $image"
  log "  Flavor: $flavor (GPU: $GPU_COUNT)"
  log "  Replicas: $REPLICAS"
  
  ovhai app run \
    --name "$APP_NAME" \
    --label "app=$APP_NAME" \
    --flavor "$flavor" \
    --gpu "$GPU_COUNT" \
    --replicas "$REPLICAS" \
    --volume "$VOLUME_REF" \
    --env "OLLAMA_PRELOAD_MODELS=$PRELOAD_MODELS" \
    --env "OLLAMA_MODELS=/models" \
    --env "OLLAMA_ORIGINS=*" \
    --default-http-port "$PORT" \
    "$image"

  log "App deployed. Use 'ovhai app get ${APP_NAME}' for status."
}

start_app() {
  ensure_cli
  local app_id="$(find_app_id)"
  if [ -z "$app_id" ]; then
    echo "App ${APP_NAME} not found" >&2
    exit 1
  fi
  ovhai app start "$app_id"
}

stop_app() {
  ensure_cli
  local app_id="$(find_app_id)"
  if [ -z "$app_id" ]; then
    echo "App ${APP_NAME} not found" >&2
    exit 1
  fi
  ovhai app stop "$app_id"
}

status_app() {
  ensure_cli
  local app_id="$(find_app_id)"
  if [ -z "$app_id" ]; then
    echo "App ${APP_NAME} not found" >&2
    exit 1
  fi
  ovhai app get "$app_id"
}

delete_app() {
  ensure_cli
  local app_id="$(find_app_id)"
  if [ -z "$app_id" ]; then
    echo "App ${APP_NAME} not found" >&2
    exit 1
  fi
  ovhai app delete "$app_id"
}

show_registry() {
  ensure_cli
  local registry="$(registry_url)"
  if [ -n "$registry" ]; then
    echo "$registry"
  else
    echo "No registry found" >&2
    exit 1
  fi
}

usage() {
  cat <<EOF
Manage the Pixelated Ollama OVH app.

Commands:
  registry            Show your OVH registry URL
  deploy [image-url]  Deploy or redeploy the OVH app (image must be pre-built via CI/CD)
                      If no URL provided, auto-constructs from registry + pixelated-ollama:latest
  start               Start the existing app
  stop                Stop the app to save credits
  status              Show current status and URL
  delete              Delete the app entirely

Note: Docker images are built via CI/CD (Azure Pipelines), not locally.
      Default tag: pixelated-ollama:latest (matches CI/CD pattern)

Environment overrides:
  APP_NAME, GPU_MODEL, GPU_COUNT, CPU_COUNT, MEMORY_SIZE, REPLICAS
  PRELOAD_MODELS, OLLAMA_VOLUME, IMAGE_TAG, OVH_REGION

Examples:
  scripts/ovh/ollama-app.sh deploy                    # Uses registry + pixelated-ollama:latest
  scripts/ovh/ollama-app.sh deploy pixelated-ollama:latest  # Auto-adds registry
  scripts/ovh/ollama-app.sh deploy <full-registry-url>/pixelated-ollama:latest
EOF
}

main() {
  case "${1:-}" in
    registry) show_registry ;;
    deploy) deploy_app "${2:-}" ;;
    start) start_app ;;
    stop) stop_app ;;
    status) status_app ;;
    delete) delete_app ;;
    -h|--help|"") usage ;;
    *)
      echo "Unknown command: ${1:-}" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"

