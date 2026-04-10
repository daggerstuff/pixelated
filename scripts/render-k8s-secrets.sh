#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--output /tmp/secret.yaml] [--namespace name] [--secret-name name] [--dry-run] [--verbose]
Render runtime Kubernetes secrets from environment variables:
  DATABASE_URL, REDIS_URL, JWT_SECRET, API_KEY
EOF
}

output_file="/tmp/pixelated-empathy-secrets.yaml"
namespace="${K8S_NAMESPACE:-pixelated-empathy}"
secret_name="${K8S_SECRET_NAME:-pixelated-empathy-secrets}"
apply_now=1
verbose=0

while [[ "${1:-}" != "" ]]; do
  case "$1" in
    --output)
      output_file="${2:?Missing --output value}"
      shift 2
      ;;
    --namespace)
      namespace="${2:?Missing --namespace value}"
      shift 2
      ;;
    --secret-name)
      secret_name="${2:?Missing --secret-name value}"
      shift 2
      ;;
    --dry-run)
      apply_now=0
      shift
      ;;
    --verbose)
      verbose=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $1" >&2
}

debug() {
  if [[ "$verbose" -eq 1 ]]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [DEBUG] $1" >&2
  fi
}

: "${DATABASE_URL:?Missing DATABASE_URL}"
: "${REDIS_URL:?Missing REDIS_URL}"
: "${JWT_SECRET:?Missing JWT_SECRET}"
: "${API_KEY:?Missing API_KEY}"

if [[ "$DATABASE_URL" != *"://"* || "$DATABASE_URL" != *"@"* ]]; then
  echo "Invalid DATABASE_URL format." >&2
  exit 1
fi

if [[ "$REDIS_URL" != redis*"://"* ]]; then
  echo "Invalid REDIS_URL format." >&2
  exit 1
fi

cat <<EOF > "$output_file"
apiVersion: v1
kind: Secret
metadata:
  name: ${secret_name}
  namespace: ${namespace}
type: Opaque
stringData:
  DATABASE_URL: "${DATABASE_URL}"
  REDIS_URL: "${REDIS_URL}"
  JWT_SECRET: "${JWT_SECRET}"
  API_KEY: "${API_KEY}"
EOF

log "Rendered runtime secret manifest to ${output_file}"

if [[ "$apply_now" -eq 1 ]]; then
  kubectl apply -f "$output_file"
  log "Applied secret ${secret_name} to namespace ${namespace}"
else
  log "Dry run selected; manifest rendered only."
fi

echo "Rendered k8s secret to: $output_file"
