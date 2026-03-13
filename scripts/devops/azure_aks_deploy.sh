#!/usr/bin/env bash
set -euo pipefail

APP_ENV_RAW="${APP_ENV:-${APP_ENVIRONMENT:-staging}}"
APP_ENV="$(printf '%s' "${APP_ENV_RAW}" | tr '[:upper:]' '[:lower:]')"
case "${APP_ENV}" in
  production|prod)
    APP_ENV="production"
    ;;
  staging|stage|stg)
    APP_ENV="staging"
    ;;
esac

resolve_chart_dir() {
  local configured="${CHART_DIR:-}"
  local repo_root="${BUILD_SOURCESDIRECTORY:-${BUILD_SOURCES_DIR:-${BUILD_SOURCES_DIRECTORY:-${SYSTEM_DEFAULTWORKINGDIRECTORY:-}}}}"

  if [[ -n "${configured}" && -d "${configured}" ]]; then
    printf '%s' "${configured}"
    return 0
  fi

  if [[ -n "${configured}" && -n "${repo_root}" && "${configured}" != /* && -d "${repo_root}/${configured}" ]]; then
    printf '%s' "${repo_root}/${configured}"
    return 0
  fi

  local candidates=()
  if [[ -n "${repo_root}" ]]; then
    candidates+=("${repo_root}/ai/infra/cloud/helm/pixelated-empathy")
    candidates+=("${repo_root}/helm")
  fi
  candidates+=("${PWD}/ai/infra/cloud/helm/pixelated-empathy")
  candidates+=("${PWD}/helm")

  for candidate in "${candidates[@]}"; do
    if [[ -d "${candidate}" ]]; then
      printf '%s' "${candidate}"
      return 0
    fi
  done

  return 1
}
STAGING_HOSTNAME="${APP_HOSTNAME_STAGING:-staging.pixelatedempathy.com}"
PRODUCTION_HOSTNAME="${APP_HOSTNAME_PRODUCTION:-pixelatedempathy.com}"
IMAGE_TAG="${BUILD_BUILDID:-}"
if [ -n "${BUILD_SOURCEVERSION:-}" ]; then
  IMAGE_TAG="${BUILD_SOURCEVERSION:0:7}"
fi
if [ -z "${IMAGE_TAG}" ]; then
  IMAGE_TAG="manual-$(date +%Y%m%d%H%M%S)"
fi
IMAGE_FULL="${ACR_LOGIN_SERVER}/${ACR_REPO}:${IMAGE_TAG}"
IMAGE_LATEST="${ACR_LOGIN_SERVER}/${ACR_REPO}:latest"
NAMESPACE="pixelated-empathy-${APP_ENV}"
RELEASE_NAME="pixelated-empathy-${APP_ENV}"
CLUSTER_NAME="${AKS_CLUSTER_NAME}"
RESOURCE_GROUP="${AKS_RESOURCE_GROUP}"
PUSH_LATEST="${PUSH_LATEST:-false}"

if ! CHART_DIR="$(resolve_chart_dir)"; then
  echo "##vso[task.logissue type=error]Helm chart directory not found."
  echo "CHART_DIR was: ${CHART_DIR:-<unset>}"
  echo "Working directory: ${PWD}"
  echo "Repo root (BUILD_SOURCESDIRECTORY-like): ${BUILD_SOURCESDIRECTORY:-${SYSTEM_DEFAULTWORKINGDIRECTORY:-<unset>}}"
  echo "Expected one of:"
  echo " - ai/infra/cloud/helm/pixelated-empathy"
  echo " - helm"
  exit 1
fi

ENV_VALUES="${CHART_DIR}/values-${APP_ENV}.yaml"

if [ -n "${AKS_CLUSTER_NAME:-}" ] && [ -n "${AKS_RESOURCE_GROUP:-}" ]; then
  CLUSTER_READY=true
else
  echo "AKS_CLUSTER_NAME and AKS_RESOURCE_GROUP are both required."
  echo "Set them in the variable group before running this pipeline."
  exit 1
fi

case "${APP_ENV}" in
  production)
    APP_HOSTNAME="${PRODUCTION_HOSTNAME}"
    ;;
  staging)
    APP_HOSTNAME="${STAGING_HOSTNAME}"
    ;;
  *)
    APP_HOSTNAME="${APP_HOSTNAME:-${PRODUCTION_HOSTNAME}}"
    ;;
esac

if [ "${APP_ENV}" = "production" ] && [ ! -f "$ENV_VALUES" ]; then
  ENV_VALUES="${CHART_DIR}/values.yaml"
fi

if [ ! -f "$ENV_VALUES" ]; then
  echo "⚠️  No environment values file found at ${ENV_VALUES}, using values.yaml."
  ENV_VALUES="${CHART_DIR}/values.yaml"
fi

echo "🔐 Logging into Azure and ACR"
az acr login --name "${ACR_NAME}"

echo "📦 Building and pushing ${IMAGE_FULL}"
docker build -f docker/Dockerfile.production -t "${IMAGE_FULL}" .
docker push "${IMAGE_FULL}"

if [ "${PUSH_LATEST}" = "True" ] || [ "${PUSH_LATEST}" = "true" ] || [ "${PUSH_LATEST}" = "1" ]; then
  docker tag "${IMAGE_FULL}" "${IMAGE_LATEST}"
  docker push "${IMAGE_LATEST}"
fi

echo "🔐 Loading AKS kubeconfig"
az aks get-credentials --resource-group "${RESOURCE_GROUP}" --name "${CLUSTER_NAME}" --overwrite-existing
kubectl cluster-info

echo "📦 Deploying Helm chart to ${NAMESPACE}"
helm dependency update "${CHART_DIR}"

helm upgrade "${RELEASE_NAME}" "${CHART_DIR}" \
  --install \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  --values "${ENV_VALUES}" \
  --values "${CHART_DIR}/values-cost-effective.yaml" \
  --set image.repository="${ACR_LOGIN_SERVER}/${ACR_REPO}" \
  --set image.tag="${IMAGE_TAG}" \
  --set ingress.hosts[0].host="${APP_HOSTNAME}" \
  --set ingress.tls[0].hosts[0]="${APP_HOSTNAME}" \
  --set ingress.tls[0].secretName="pixelated-empathy-${APP_ENV}-tls" \
  --wait \
  --timeout 15m \
  --atomic

kubectl -n "${NAMESPACE}" get pods -l app.kubernetes.io/instance="${RELEASE_NAME}"

