#!/usr/bin/env bash
# rollout-civo.sh
# Restarts the pixelated-empathy deployment on the Civo cluster and verifies
# both replicas converge on the SAME image digest BEFORE declaring success.
#
# Why this exists: a `:latest` + imagePullPolicy:Always deploy lets two
# replicas pull different builds, so each bakes a different dist/ _astro hash
# and the Service round-robins HTML against CSS/JS missing from the other
# pod's image -> 404s. This script surfaces that divergence explicitly and
# only reports success once both pods run the identical digest.
#
# Run it FROM an environment with network reach to the Civo API server
# (the cluster lives on the Civo VPC; this session's box cannot route there).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NAMESPACE="pixelated-empathy"
DEPLOYMENT="pixelated-empathy"
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/civo-pixelated-cluster-kubeconfig}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-180s}"

usage() {
  cat <<EOF
Usage: $0 [--kubeconfig PATH] [--namespace NS] [--deployment NAME] [--timeout DUR]

Restarts the deployment and waits for both replicas to converge on one digest.

  --kubeconfig   Path to the Civo kubeconfig (default: \$KUBECONFIG or
                 ~/civo-pixelated-cluster-kubeconfig)
  --namespace    Target namespace (default: pixelated-empathy)
  --deployment   Deployment name (default: pixelated-empathy)
  --timeout      Rollout wait timeout (default: 180s)

Examples:
  $0
  $0 --kubeconfig /path/to/civo-kubeconfig --timeout 300s
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2;;
    --namespace)   NAMESPACE="$2"; shift 2;;
    --deployment) DEPLOYMENT="$2"; shift 2;;
    --timeout)     WAIT_TIMEOUT="$2"; shift 2;;
    -h|--help)     usage; exit 0;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2;;
  esac
done

export KUBECONFIG="${KUBECONFIG_PATH}"

echo "🔍 Using kubeconfig: ${KUBECONFIG_PATH}"
echo "🔍 Target: deployment/${DEPLOYMENT} in namespace/${NAMESPACE}"

# Pre-flight: cluster reachable? Bounded so we fail fast instead of hanging
# when the Civo API server is unreachable from this environment.
if ! timeout 20 kubectl get deployment "${DEPLOYMENT}" -n "${NAMESPACE}" >/dev/null 2>&1; then
  echo "❌ Cannot reach deployment ${DEPLOYMENT} in ${NAMESPACE}." >&2
  echo "   Check KUBECONFIG (${KUBECONFIG_PATH}) and network reach to the Civo API server." >&2
  echo "   (kubectl timed out after 20s — confirm the cluster is routable from here.)" >&2
  exit 1
fi

echo "🔄 Restarting rollout..."
kubectl rollout restart "deployment/${DEPLOYMENT}" -n "${NAMESPACE}"

echo "⏳ Waiting for rollout to complete (timeout ${WAIT_TIMEOUT})..."
if ! kubectl rollout status "deployment/${DEPLOYMENT}" -n "${NAMESPACE}" --timeout="${WAIT_TIMEOUT}"; then
  echo "❌ Rollout did not complete within ${WAIT_TIMEOUT}." >&2
  exit 1
fi

# Post-flight: assert both replicas run the SAME image digest.
# This is the actual regression guard for the _astro 404 bug.
mapfile -t DIGESTS < <(
  kubectl get pods -n "${NAMESPACE}" \
    -l "app=${DEPLOYMENT}" \
    -o jsonpath='{range .items[*]}{.status.containerStatuses[0].imageID}{"\n"}{end}' \
    2>/dev/null | sort -u
)

if [[ ${#DIGESTS[@]} -eq 0 ]]; then
  echo "❌ No running pods found for app=${DEPLOYMENT}." >&2
  exit 1
fi

echo "🧪 Image digests across replicas:"
for d in "${DIGESTS[@]}"; do
  echo "   ${d}"
done

if [[ ${#DIGESTS[@]} -ne 1 ]]; then
  echo "❌ REPLICAS DIVERGE ON DIFFERENT IMAGE DIGESTS." >&2
  echo "   This is the exact condition that causes _astro/* 404s." >&2
  echo "   Do NOT consider the deploy healthy. Investigate why pods pulled" >&2
  echo "   different builds (stale :latest pull, partial image push, node cache)." >&2
  exit 1
fi

echo "✅ Rollout complete: both replicas on a single digest (${DIGESTS[0]})."
exit 0
