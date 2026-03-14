#!/usr/bin/env bash
set -euo pipefail

APP_ENV_RAW="${APP_ENV:-${APP_ENVIRONMENT:-}}"
if [ -z "${APP_ENV_RAW}" ]; then
  BRANCH_NAME="${BUILD_SOURCEBRANCHNAME:-${BUILD_SOURCEBRANCH##*/}}"
  case "${BRANCH_NAME}" in
    master|main)
      APP_ENV_RAW="production"
      ;;
    staging|stg|stage)
      APP_ENV_RAW="staging"
      ;;
    *)
      APP_ENV_RAW="staging"
      ;;
  esac
fi
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

resolve_values_file() {
  local chart_dir="$1"
  local app_env="$2"
  local candidates=()

  case "${app_env}" in
    production)
      candidates+=("${chart_dir}/values-production.yaml")
      candidates+=("${chart_dir}/values-prod.yaml")
      ;;
    staging)
      candidates+=("${chart_dir}/values-staging.yaml")
      candidates+=("${chart_dir}/values-stage.yaml")
      ;;
    dev|development)
      candidates+=("${chart_dir}/values-dev.yaml")
      candidates+=("${chart_dir}/values-development.yaml")
      ;;
  esac

  candidates+=("${chart_dir}/values-${app_env}.yaml")
  candidates+=("${chart_dir}/values.yaml")
  candidates+=("${chart_dir}/values-training.yaml")

  local values_file
  for values_file in "${candidates[@]}"; do
    if [[ -f "${values_file}" ]]; then
      printf '%s' "${values_file}"
      return 0
    fi
  done

  echo "No Helm values file found in ${chart_dir} for environment ${app_env}. Tried:" >&2
  for values_file in "${candidates[@]}"; do
    echo "  - ${values_file}" >&2
  done

  return 1
}
STAGING_HOSTNAME="${APP_HOSTNAME_STAGING:-staging.pixelatedempathy.com}"
PRODUCTION_HOSTNAME="${APP_HOSTNAME_PRODUCTION:-pixelatedempathy.com}"
IMAGE_TAG="${BUILD_BUILDID:-}"
POSTGRESQL_IMAGE_TAG="${POSTGRESQL_IMAGE_TAG:-latest}"
REDIS_IMAGE_TAG="${REDIS_IMAGE_TAG:-latest}"
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
verify_remote_image() {
  local repository="$1"
  local tag="$2"
  local image_ref="${repository}:${tag}"

  if ! docker manifest inspect "${image_ref}" >/dev/null 2>&1; then
    echo "##vso[task.logissue type=error]Image not found or inaccessible: ${image_ref}"
    echo "Verify the repository and tag exist, and that Azure DevOps agents can reach docker.io."
    return 1
  fi
}

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

if ! ENV_VALUES="$(resolve_values_file "${CHART_DIR}" "${APP_ENV}")"; then
  echo "##vso[task.logissue type=error]Helm values file not found for environment ${APP_ENV} in chart directory ${CHART_DIR}."
  exit 1
fi

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

echo "📄 Using chart directory: ${CHART_DIR}"
echo "📄 Using values file: ${ENV_VALUES}"
echo "📄 Database image pinning: postgres=${POSTGRESQL_IMAGE_TAG}, redis=${REDIS_IMAGE_TAG}"

HELM_VALUES_ARGS=(
  --values "${ENV_VALUES}"
)

if [ "${APP_ENV}" != "training" ]; then
  HELM_VALUES_ARGS+=(
    --set "training.enabled=false"
    --set "postgresql.image.repository=bitnami/postgresql"
    --set "postgresql.image.tag=${POSTGRESQL_IMAGE_TAG}"
    --set "postgresql.image.pullPolicy=IfNotPresent"
    --set "redis.image.repository=bitnami/redis"
    --set "redis.image.tag=${REDIS_IMAGE_TAG}"
    --set "redis.image.pullPolicy=IfNotPresent"
  )

  verify_remote_image "docker.io/bitnami/postgresql" "${POSTGRESQL_IMAGE_TAG}"
  verify_remote_image "docker.io/bitnami/redis" "${REDIS_IMAGE_TAG}"
fi

if [ -f "${CHART_DIR}/values-cost-effective.yaml" ]; then
  HELM_VALUES_ARGS+=(
    --values "${CHART_DIR}/values-cost-effective.yaml"
  )
fi

set +e
helm upgrade "${RELEASE_NAME}" "${CHART_DIR}" \
  --install \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  "${HELM_VALUES_ARGS[@]}" \
  --set image.repository="${ACR_LOGIN_SERVER}/${ACR_REPO}" \
  --set image.tag="${IMAGE_TAG}" \
  --set ingress.hosts[0].host="${APP_HOSTNAME}" \
  --set ingress.tls[0].hosts[0]="${APP_HOSTNAME}" \
  --set ingress.tls[0].secretName="pixelated-empathy-${APP_ENV}-tls" \
  --wait \
  --timeout 30m \
  --atomic
HELM_EXIT_CODE=$?
set -e

if [ "${HELM_EXIT_CODE}" -ne 0 ]; then
  echo "❌ Helm upgrade failed with exit code ${HELM_EXIT_CODE}"
  echo "📄 Helm status:"
  helm status "${RELEASE_NAME}" --namespace "${NAMESPACE}" || true
  echo "📄 Pods:"
  kubectl -n "${NAMESPACE}" get pods -o wide || true
  echo "📄 Services:"
  kubectl -n "${NAMESPACE}" get services || true
  echo "📄 Events:"
  kubectl -n "${NAMESPACE}" get events --sort-by=.lastTimestamp --field-selector type!=Normal || true
  exit "${HELM_EXIT_CODE}"
fi

kubectl -n "${NAMESPACE}" get pods -l app.kubernetes.io/instance="${RELEASE_NAME}"

echo "📄 DNS target info:"
if [ "${APP_ENV}" = "production" ]; then
  INGRESS_NGINX_IP="$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
  if [ -n "${INGRESS_NGINX_IP}" ]; then
    echo "Pixelated production ingress (DNS for pixelatedempathy.com): ${INGRESS_NGINX_IP}"
  fi

  PROD_INGRESS_HOST="$(kubectl -n "${NAMESPACE}" get ingress "${RELEASE_NAME}" -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || true)"
  if [ -z "${PROD_INGRESS_HOST}" ]; then
    echo "##vso[task.logissue type=error]Production ingress object was not created or has no hostname rule."
    echo "Run an explicit production deploy and verify the release chart templates include ingress resources."
    exit 1
  fi
  echo "Production ingress host in namespace ${NAMESPACE}: ${PROD_INGRESS_HOST}"

  if [ -z "${INGRESS_NGINX_IP}" ]; then
    echo "##vso[task.logissue type=error]No public IP found on ingress-nginx controller in ingress-nginx namespace."
    exit 1
  fi
fi
INGRESS_CADDY_IP="$(kubectl -n "${NAMESPACE}" get svc "${RELEASE_NAME}-caddy-ingress-controller" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
if [ -n "${INGRESS_CADDY_IP}" ]; then
  echo "Namespace ${NAMESPACE} caddy ingress controller IP: ${INGRESS_CADDY_IP}"
fi

