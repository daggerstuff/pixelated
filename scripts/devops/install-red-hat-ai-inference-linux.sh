#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install-red-hat-ai-inference-linux.sh [options]

Install and launch Red Hat AI Inference on a Linux host using Podman or Docker.

This script automates the standalone container flow documented for Red Hat AI
Inference 3.4. It assumes NVIDIA drivers and a working GPU container runtime are
already installed on the host.

Options:
  --engine <podman|docker>     Container engine to use (default: podman if present, else docker)
  --image <image>              Container image
  --model <model>              Hugging Face model ID to serve
  --port <port>                Host port to expose (default: 8000)
  --cache-dir <dir>            Host cache directory (default: ./rhaii-cache)
  --container-name <name>      Container name (default: rhaii-vllm)
  --tensor-parallel-size <n>   vLLM tensor parallel size (default: 1)
  --hf-token <token>           Hugging Face token (overrides HF_TOKEN env var)
  --registry-user <user>       Optional registry.redhat.io username for non-interactive login
  --registry-password <pass>   Optional registry.redhat.io password/token for non-interactive login
  --skip-login                 Skip registry.redhat.io login attempt
  --dry-run                    Print commands without executing them
  -h, --help                   Show this help

Environment:
  HF_TOKEN                     Hugging Face token if --hf-token is not supplied

Example:
  scripts/devops/install-red-hat-ai-inference-linux.sh \
    --model RedHatAI/Llama-3.2-1B-Instruct-FP8 \
    --tensor-parallel-size 1
EOF
}

log() {
  printf '[rhaii-install] %s\n' "$*"
}

fail() {
  printf '[rhaii-install] ERROR: %s\n' "$*" >&2
  exit 1
}

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ENGINE=""
IMAGE="registry.redhat.io/rhaii/vllm-cuda-rhel9:3.4.0"
MODEL="RedHatAI/Llama-3.2-1B-Instruct-FP8"
PORT="8000"
CACHE_DIR="$(pwd)/rhaii-cache"
CONTAINER_NAME="rhaii-vllm"
TENSOR_PARALLEL_SIZE="1"
HF_TOKEN_VALUE="${HF_TOKEN:-}"
REGISTRY_USER=""
REGISTRY_PASSWORD=""
SKIP_LOGIN="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine)
      ENGINE="$2"
      shift 2
      ;;
    --image)
      IMAGE="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --cache-dir)
      CACHE_DIR="$2"
      shift 2
      ;;
    --container-name)
      CONTAINER_NAME="$2"
      shift 2
      ;;
    --tensor-parallel-size)
      TENSOR_PARALLEL_SIZE="$2"
      shift 2
      ;;
    --hf-token)
      HF_TOKEN_VALUE="$2"
      shift 2
      ;;
    --registry-user)
      REGISTRY_USER="$2"
      shift 2
      ;;
    --registry-password)
      REGISTRY_PASSWORD="$2"
      shift 2
      ;;
    --skip-login)
      SKIP_LOGIN="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

if [[ -z "$ENGINE" ]]; then
  if command_exists podman; then
    ENGINE="podman"
  elif command_exists docker; then
    ENGINE="docker"
  else
    fail "Neither podman nor docker is installed"
  fi
fi

if [[ "$ENGINE" != "podman" && "$ENGINE" != "docker" ]]; then
  fail "--engine must be podman or docker"
fi

command_exists "$ENGINE" || fail "$ENGINE is not installed"
command_exists curl || fail "curl is required"

if [[ -z "$HF_TOKEN_VALUE" ]]; then
  fail "Set HF_TOKEN or pass --hf-token before running this script"
fi

if [[ ! "$PORT" =~ ^[0-9]+$ ]]; then
  fail "--port must be numeric"
fi

if [[ ! "$TENSOR_PARALLEL_SIZE" =~ ^[0-9]+$ ]]; then
  fail "--tensor-parallel-size must be numeric"
fi

if ! command_exists nvidia-smi; then
  fail "nvidia-smi not found. Install NVIDIA drivers before running this script"
fi

GPU_COUNT=$(nvidia-smi --query-gpu=count --format=csv,noheader,nounits | head -n1 | tr -d ' ')
if [[ "$GPU_COUNT" -lt 1 ]]; then
  fail "No NVIDIA GPUs detected"
fi

if [[ "$TENSOR_PARALLEL_SIZE" -gt "$GPU_COUNT" ]]; then
  fail "tensor parallel size $TENSOR_PARALLEL_SIZE exceeds detected GPU count $GPU_COUNT"
fi

mkdir -p "$CACHE_DIR"
chmod 775 "$CACHE_DIR"

if command_exists getenforce; then
  SELINUX_MODE=$(getenforce)
  if [[ "$SELINUX_MODE" != "Disabled" ]]; then
    log "SELinux detected ($SELINUX_MODE); enabling container device access"
    log "WARNING: this persists the container_use_devices SELinux boolean system-wide"
    log "To revert later, run: sudo setsebool -P container_use_devices 0"
    if command_exists sudo; then
      run sudo setsebool -P container_use_devices 1
    else
      run setsebool -P container_use_devices 1
    fi
  fi
fi

if [[ "$SKIP_LOGIN" != "true" ]]; then
  log "Ensuring access to registry.redhat.io"
  if [[ -n "$REGISTRY_USER" && -n "$REGISTRY_PASSWORD" ]]; then
    run "$ENGINE" login registry.redhat.io -u "$REGISTRY_USER" -p "$REGISTRY_PASSWORD"
  else
    log "Interactive login may prompt for registry.redhat.io credentials"
    run "$ENGINE" login registry.redhat.io
  fi
fi

if [[ "$DRY_RUN" != "true" ]]; then
  if ! "$ENGINE" pull --quiet "$IMAGE" >/dev/null 2>&1; then
    fail "Image pull failed. Verify your registry.redhat.io entitlements for $IMAGE"
  fi
fi

log "Pulling image $IMAGE"
run "$ENGINE" pull "$IMAGE"

log "Removing any previous container named $CONTAINER_NAME"
if [[ "$DRY_RUN" != "true" ]]; then
  "$ENGINE" rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

log "Starting Red Hat AI Inference container"
if [[ "$ENGINE" == "podman" ]]; then
  run "$ENGINE" run -d \
    --name "$CONTAINER_NAME" \
    --device nvidia.com/gpu=all \
    --security-opt=label=disable \
    --shm-size=4g \
    --userns=keep-id:uid=1001 \
    -p "$PORT:8000" \
    -e "HUGGING_FACE_HUB_TOKEN=$HF_TOKEN_VALUE" \
    -e "HF_HUB_OFFLINE=0" \
    -v "$CACHE_DIR:/opt/app-root/src/.cache:Z" \
    "$IMAGE" \
    --model "$MODEL" \
    --tensor-parallel-size "$TENSOR_PARALLEL_SIZE"
else
  run "$ENGINE" run -d \
    --name "$CONTAINER_NAME" \
    --gpus all \
    --shm-size=4g \
    -p "$PORT:8000" \
    -e "HUGGING_FACE_HUB_TOKEN=$HF_TOKEN_VALUE" \
    -e "HF_HUB_OFFLINE=0" \
    -v "$CACHE_DIR:/opt/app-root/src/.cache" \
    "$IMAGE" \
    --model "$MODEL" \
    --tensor-parallel-size "$TENSOR_PARALLEL_SIZE"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  log "Dry run complete"
  exit 0
fi

log "Waiting for the OpenAI-compatible endpoint to answer on port $PORT"
READY="false"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/v1/models" >/dev/null 2>&1; then
    READY="true"
    break
  fi
  sleep 5
done

if [[ "$READY" != "true" ]]; then
  "$ENGINE" logs "$CONTAINER_NAME" || true
  fail "Inference service did not become ready within 5 minutes"
fi

log "Running smoke test"
curl -fsS -X POST "http://127.0.0.1:${PORT}/v1/completions" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"What is the capital of France?","max_tokens":32}'

cat <<EOF

Red Hat AI Inference is running.

Container: $CONTAINER_NAME
Image:     $IMAGE
Model:     $MODEL
Endpoint:  http://127.0.0.1:${PORT}/v1

Useful commands:
  $ENGINE logs -f $CONTAINER_NAME
  $ENGINE exec -it $CONTAINER_NAME bash
  $ENGINE rm -f $CONTAINER_NAME
EOF
