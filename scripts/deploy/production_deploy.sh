#!/usr/bin/env bash
set -euo pipefail

# Production deployment script using Helm
# Requirements: kubectl, helm, access to cluster context

usage() {
  cat <<EOF
Usage: $0 -r <release> -n <namespace> -i <image> -t <tag> [-f <values.yaml>] [--set key=val]...

Options:
  -r, --release        Helm release name (e.g., pixelated)
  -n, --namespace      Kubernetes namespace (e.g., production)
  -i, --image          Image repository (e.g., ghcr.io/pixelated/ai-service)
  -t, --tag            Image tag (e.g., sha-abcdef)
  -f, --values         Additional values file (defaults to helm/values-production.yaml)
  --set                Additional Helm set values (can be repeated)
  --wait               Wait for rollout to complete
  --timeout            Rollout timeout (default 5m)

Examples:
  $0 -r pixelated -n production -i ghcr.io/pixelated/ai-service -t $(git rev-parse --short HEAD) --wait
EOF
}

REL=""
NS=""
IMG=""
TAG=""
VALUES="helm/values-production.yaml"
SET_ARGS=()
WAIT=false
TIMEOUT="5m"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -r|--release) REL="$2"; shift 2;;
    -n|--namespace) NS="$2"; shift 2;;
    -i|--image) IMG="$2"; shift 2;;
    -t|--tag) TAG="$2"; shift 2;;
    -f|--values) VALUES="$2"; shift 2;;
    --set) SET_ARGS+=("--set" "$2"); shift 2;;
    --wait) WAIT=true; shift;;
    --timeout) TIMEOUT="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

if [[ -z "$REL" || -z "$NS" || -z "$IMG" || -z "$TAG" ]]; then
  echo "Missing required args"; usage; exit 1
fi

# Ensure namespace exists
kubectl get ns "$NS" >/dev/null 2>&1 || kubectl create namespace "$NS"

# Install/upgrade
helm upgrade --install "$REL" ./helm \
  --namespace "$NS" \
  -f "$VALUES" \
  --set image.repository="$IMG" \
  --set image.tag="$TAG" \
  ${SET_ARGS[@]:-}

if $WAIT; then
  echo "Waiting for rollout..."
  kubectl rollout status deploy/"$REL" -n "$NS" --timeout="$TIMEOUT" || {
    echo "Rollout failed" >&2
    kubectl get pods -n "$NS" -o wide
    kubectl describe deploy/"$REL" -n "$NS"
    exit 1
  }
fi

echo "Deployment completed: release=$REL namespace=$NS image=$IMG:$TAG"
