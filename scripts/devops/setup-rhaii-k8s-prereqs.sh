#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: setup-rhaii-k8s-prereqs.sh [options]

Bootstrap common Kubernetes prerequisites for Red Hat AI Inference community
deployments on Civo or OVHcloud.

This script prepares cluster-scoped dependencies only. It does not deploy
`llm-d`, KServe workloads, or Red Hat-supported xKS charts.

Options:
  --provider <civo|ovh>               Target managed Kubernetes provider
  --gpu-operator-namespace <name>     GPU Operator namespace (default: gpu-operator)
  --cert-manager-namespace <name>     cert-manager namespace (default: cert-manager)
  --workload-namespace <name>         Workload namespace to create (default: rhaii-system)
  --cert-manager-version <version>    Optional cert-manager chart version
  --gpu-operator-version <version>    Optional GPU Operator chart version
  --ovh-driver-version <version>      OVH GPU driver version (default: 535.183.01)
  --gateway-api-manifest-url <url>    Optional Gateway API manifest URL to apply
  --skip-cert-manager                 Do not install cert-manager
  --skip-gpu-operator                 Do not install NVIDIA GPU Operator
  --skip-gateway-api                  Do not apply Gateway API manifest
  --dry-run                           Print commands without executing them
  -h, --help                          Show this help

Examples:
  scripts/devops/setup-rhaii-k8s-prereqs.sh --provider civo

  scripts/devops/setup-rhaii-k8s-prereqs.sh \
    --provider ovh \
    --gateway-api-manifest-url https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml
EOF
}

log() {
  printf '[rhaii-k8s] %s\n' "$*"
}

fail() {
  printf '[rhaii-k8s] ERROR: %s\n' "$*" >&2
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

namespace_exists() {
  kubectl get namespace "$1" >/dev/null 2>&1
}

PROVIDER=""
GPU_OPERATOR_NAMESPACE="gpu-operator"
CERT_MANAGER_NAMESPACE="cert-manager"
WORKLOAD_NAMESPACE="rhaii-system"
CERT_MANAGER_VERSION=""
GPU_OPERATOR_VERSION=""
OVH_DRIVER_VERSION="535.183.01"
GATEWAY_API_MANIFEST_URL=""
INSTALL_CERT_MANAGER="true"
INSTALL_GPU_OPERATOR="true"
INSTALL_GATEWAY_API="true"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider)
      PROVIDER="$2"
      shift 2
      ;;
    --gpu-operator-namespace)
      GPU_OPERATOR_NAMESPACE="$2"
      shift 2
      ;;
    --cert-manager-namespace)
      CERT_MANAGER_NAMESPACE="$2"
      shift 2
      ;;
    --workload-namespace)
      WORKLOAD_NAMESPACE="$2"
      shift 2
      ;;
    --cert-manager-version)
      CERT_MANAGER_VERSION="$2"
      shift 2
      ;;
    --gpu-operator-version)
      GPU_OPERATOR_VERSION="$2"
      shift 2
      ;;
    --ovh-driver-version)
      OVH_DRIVER_VERSION="$2"
      shift 2
      ;;
    --gateway-api-manifest-url)
      GATEWAY_API_MANIFEST_URL="$2"
      shift 2
      ;;
    --skip-cert-manager)
      INSTALL_CERT_MANAGER="false"
      shift
      ;;
    --skip-gpu-operator)
      INSTALL_GPU_OPERATOR="false"
      shift
      ;;
    --skip-gateway-api)
      INSTALL_GATEWAY_API="false"
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

if [[ "$PROVIDER" != "civo" && "$PROVIDER" != "ovh" ]]; then
  fail "--provider must be civo or ovh"
fi

command_exists kubectl || fail "kubectl is required"
command_exists helm || fail "helm is required"

if [[ "$INSTALL_GATEWAY_API" == "true" && -z "$GATEWAY_API_MANIFEST_URL" ]]; then
  log "No Gateway API manifest URL provided; skipping Gateway API apply"
  INSTALL_GATEWAY_API="false"
fi

if [[ "$DRY_RUN" != "true" ]]; then
  kubectl cluster-info >/dev/null 2>&1 || fail "kubectl cannot reach the current cluster context"
fi

log "Adding required Helm repositories"
run helm repo add jetstack https://charts.jetstack.io >/dev/null 2>&1 || true
run helm repo add nvidia https://helm.ngc.nvidia.com/nvidia >/dev/null 2>&1 || true
run helm repo update

for namespace in "$GPU_OPERATOR_NAMESPACE" "$CERT_MANAGER_NAMESPACE" "$WORKLOAD_NAMESPACE"; do
  log "Ensuring namespace $namespace exists"
  if [[ "$DRY_RUN" == "true" ]]; then
    run kubectl create namespace "$namespace" --dry-run=client -o yaml
  elif ! namespace_exists "$namespace"; then
    run kubectl create namespace "$namespace"
  else
    log "Namespace $namespace already exists"
  fi
done

if [[ "$INSTALL_CERT_MANAGER" == "true" ]]; then
  log "Installing or upgrading cert-manager"
  cert_manager_args=(
    upgrade --install cert-manager jetstack/cert-manager
    --namespace "$CERT_MANAGER_NAMESPACE"
    --set crds.enabled=true
    --wait
    --timeout 10m
  )

  if [[ -n "$CERT_MANAGER_VERSION" ]]; then
    cert_manager_args+=(--version "$CERT_MANAGER_VERSION")
  fi

  run helm "${cert_manager_args[@]}"
fi

if [[ "$INSTALL_GPU_OPERATOR" == "true" ]]; then
  log "Installing or upgrading NVIDIA GPU Operator for $PROVIDER"
  gpu_operator_args=(
    upgrade --install gpu-operator nvidia/gpu-operator
    --namespace "$GPU_OPERATOR_NAMESPACE"
    --wait
    --timeout 20m
  )

  if [[ -n "$GPU_OPERATOR_VERSION" ]]; then
    gpu_operator_args+=(--version "$GPU_OPERATOR_VERSION")
  fi

  if [[ "$PROVIDER" == "civo" ]]; then
    gpu_operator_args+=(
      --set toolkit.enabled=false
      --set devicePlugin.enabled=true
      --set dcgmExporter.enabled=true
      --set gfd.enabled=true
      --set migManager.enabled=false
    )
  else
    gpu_operator_args+=(
      --set driver.enabled=true
      --set "driver.version=$OVH_DRIVER_VERSION"
      --set toolkit.enabled=true
      --set operator.defaultRuntime=containerd
      --set devicePlugin.enabled=true
      --set dcgmExporter.enabled=true
      --set gfd.enabled=true
      --set migManager.enabled=false
    )
  fi

  run helm "${gpu_operator_args[@]}"
fi

if [[ "$INSTALL_GATEWAY_API" == "true" ]]; then
  log "Applying Gateway API manifest from $GATEWAY_API_MANIFEST_URL"
  run kubectl apply -f "$GATEWAY_API_MANIFEST_URL"
fi

cat <<EOF

Bootstrap complete for provider: $PROVIDER

Validation commands:
  kubectl get nodes -o wide
  kubectl get pods -n $GPU_OPERATOR_NAMESPACE
  kubectl get pods -n $CERT_MANAGER_NAMESPACE

Provider-specific checks:
EOF

if [[ "$PROVIDER" == "civo" ]]; then
  cat <<EOF
  kubectl get nodes -L nvidia.com/gpu.present

Notes:
  - Civo GPU images already include the NVIDIA container toolkit.
  - If you use single-GPU H100 nodes, follow Civo's NVLink workaround before workload rollout.
EOF
else
  cat <<EOF
  kubectl describe nodes | grep -E 'nvidia.com/gpu|allocatable' -n

Notes:
  - OVH GPU quota approval and first node provisioning may delay the rollout window.
  - Recheck OVH guidance if you need to override dcgm-exporter image tags or driver versions.
EOF
fi

cat <<EOF

Next steps:
  1. verify GPU feature-discovery labels and GPU Operator pod health
  2. apply your chosen Gateway API-compatible ingress pattern
  3. continue with upstream llm-d prerequisites and workload manifests
  4. deploy inference services only after these cluster-scoped checks pass
EOF
