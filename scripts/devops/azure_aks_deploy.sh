#!/usr/bin/env bash
set -euo pipefail

APP_ENV_RAW="${APP_ENV:-${APP_ENVIRONMENT:-}}"
SOURCE_BRANCH_NAME="${BUILD_SOURCEBRANCHNAME:-${BUILD_SOURCEBRANCH##*/}}"

# Strip unresolved Azure DevOps variables passed as literal $()
for var in AZURE_SUBSCRIPTION_ID AKS_CLUSTER_NAME AZURE_AKS_CLUSTER_NAME AKS_RESOURCE_GROUP AZURE_AKS_RESOURCE_GROUP AZURE_SUBSCRIPTION_NAME; do
  if [[ "${!var:-}" == '$('* ]]; then
    export "$var"=""
  fi
done
if [ -z "${APP_ENV_RAW}" ]; then
  # The staging branch is currently the live branch. Until a separate staging
  # platform exists, branch-based environment inference must target production.
  case "${SOURCE_BRANCH_NAME}" in
    master|main)
      APP_ENV_RAW="production"
      ;;
    staging|stg|stage)
      APP_ENV_RAW="production"
      ;;
    *)
      APP_ENV_RAW="production"
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
  local candidate

  is_chart_dir() {
    local dir="$1"
    [[ -n "${dir}" && -d "${dir}" && -f "${dir}/Chart.yaml" ]]
  }

  if is_chart_dir "${configured}"; then
    printf '%s' "${configured}"
    return 0
  fi

  if [[ -n "${configured}" && -n "${repo_root}" && "${configured}" != /* ]] && is_chart_dir "${repo_root}/${configured}"; then
    printf '%s' "${repo_root}/${configured}"
    return 0
  fi

  local candidates=()
  if [[ -n "${repo_root}" ]]; then
    candidates+=("${repo_root}/ai/infrastructure/helm/pixelated-empathy")
    candidates+=("${repo_root}/ai/infra/cloud/helm/pixelated-empathy")
    candidates+=("${repo_root}/helm")
  fi
  candidates+=("${PWD}/ai/infrastructure/helm/pixelated-empathy")
  candidates+=("${PWD}/ai/infra/cloud/helm/pixelated-empathy")
  candidates+=("${PWD}/helm")

  for candidate in "${candidates[@]}"; do
    if is_chart_dir "${candidate}"; then
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

get_secret_key_value() {
  local namespace="$1"
  local secret_name="$2"
  local key_name="$3"

  kubectl -n "${namespace}" get secret "${secret_name}" -o "jsonpath={.data.${key_name}}" 2>/dev/null | base64 --decode 2>/dev/null || true
}

fetch_existing_runtime_inputs() {
  local namespace="$1"
  local release_name="$2"
  local app_secret_name="${release_name}-secrets"
  local postgres_secret_name="${release_name}-postgresql"
  local redis_secret_name="${release_name}-redis"

  EXISTING_DATABASE_URL="$(get_secret_key_value "${namespace}" "${app_secret_name}" "database-url")"
  EXISTING_REDIS_URL="$(get_secret_key_value "${namespace}" "${app_secret_name}" "redis-url")"
  EXISTING_JWT_SECRET="$(get_secret_key_value "${namespace}" "${app_secret_name}" "jwt-secret")"
  EXISTING_ENCRYPTION_KEY="$(get_secret_key_value "${namespace}" "${app_secret_name}" "encryption-key")"
  EXISTING_POSTGRES_PASSWORD="$(get_secret_key_value "${namespace}" "${postgres_secret_name}" "postgres-password")"
  EXISTING_REDIS_PASSWORD="$(get_secret_key_value "${namespace}" "${redis_secret_name}" "redis-password")"
}

resolve_runtime_credentials() {
  local release_name="$1"
  local resolved_values=()

  mapfile -d '' -t resolved_values < <(
    printf '%s\0%s\0%s\0%s\0%s\0%s' \
      "${EXISTING_POSTGRES_PASSWORD}" \
      "${EXISTING_DATABASE_URL}" \
      "${EXISTING_REDIS_PASSWORD}" \
      "${EXISTING_REDIS_URL}" \
      "${EXISTING_JWT_SECRET}" \
      "${EXISTING_ENCRYPTION_KEY}" | \
      python3 -c '
from urllib.parse import urlsplit
import secrets
import sys

parts = sys.stdin.buffer.read().split(b"\0")
parts += [b""] * (6 - len(parts))
postgres_secret, database_url, redis_secret, redis_url, jwt_secret, encryption_key = [
    item.decode() for item in parts[:6]
]

def resolve_url_password(url: str):
    if not url:
        return None
    parsed = urlsplit(url)
    if parsed.password is None:
        return ""
    return parsed.password

postgres_password = postgres_secret or resolve_url_password(database_url)
if postgres_password is None:
    postgres_password = secrets.token_urlsafe(32)

redis_password = redis_secret or resolve_url_password(redis_url)
if redis_password is None:
    redis_password = secrets.token_urlsafe(32)

jwt_value = jwt_secret or secrets.token_urlsafe(32)
encryption_value = encryption_key or secrets.token_urlsafe(32)

sys.stdout.buffer.write(postgres_password.encode())
sys.stdout.buffer.write(b"\0")
sys.stdout.buffer.write(redis_password.encode())
sys.stdout.buffer.write(b"\0")
sys.stdout.buffer.write(jwt_value.encode())
sys.stdout.buffer.write(b"\0")
sys.stdout.buffer.write(encryption_value.encode())
'
  )

  POSTGRES_RUNTIME_PASSWORD="${resolved_values[0]}"
  REDIS_RUNTIME_PASSWORD="${resolved_values[1]}"
  APP_JWT_SECRET="${resolved_values[2]}"
  APP_ENCRYPTION_KEY="${resolved_values[3]}"

  APP_DATABASE_URL="postgresql://postgres:${POSTGRES_RUNTIME_PASSWORD}@${release_name}-postgresql:5432/pixelated_empathy"
  APP_REDIS_URL="redis://:${REDIS_RUNTIME_PASSWORD}@${release_name}-redis-master:6379"
}

create_runtime_values_file() {
  local release_name="$1"

  umask 077
  RUNTIME_VALUES_FILE="$(mktemp)"
  chmod 600 "${RUNTIME_VALUES_FILE}"
  cat > "${RUNTIME_VALUES_FILE}" <<EOF
app:
  secrets:
    databaseUrl: "${APP_DATABASE_URL}"
    redisUrl: "${APP_REDIS_URL}"
    jwtSecret: "${APP_JWT_SECRET}"
    encryptionKey: "${APP_ENCRYPTION_KEY}"
postgresql:
  auth:
    postgresPassword: "${POSTGRES_RUNTIME_PASSWORD}"
redis:
  auth:
    password: "${REDIS_RUNTIME_PASSWORD}"
EOF
}

cleanup_runtime_values_file() {
  if [ -n "${RUNTIME_VALUES_FILE:-}" ]; then
    rm -f "${RUNTIME_VALUES_FILE}"
  fi
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
  if [[ "${SKIP_BUILD:-false}" == "true" ]]; then
    echo "##vso[task.logissue type=error]IMAGE_TAG is missing but SKIP_BUILD=true. A valid image tag from a previous build stage is required."
    exit 1
  fi
  IMAGE_TAG="manual-$(date +%Y%m%d%H%M%S)"
fi
IMAGE_FULL="${ACR_LOGIN_SERVER}/${ACR_REPO}:${IMAGE_TAG}"
IMAGE_LATEST="${ACR_LOGIN_SERVER}/${ACR_REPO}:latest"
NAMESPACE="pixelated-empathy-${APP_ENV}"
RELEASE_NAME="pixelated-empathy-${APP_ENV}"
CLUSTER_NAME="${AKS_CLUSTER_NAME:-${AZURE_AKS_CLUSTER_NAME:-}}"
RESOURCE_GROUP="${AKS_RESOURCE_GROUP:-${AZURE_AKS_RESOURCE_GROUP:-}}"

# Normalize alternate variable names so subsequent logic can rely on AKS_*.
AKS_CLUSTER_NAME="${CLUSTER_NAME}"
AKS_RESOURCE_GROUP="${RESOURCE_GROUP}"
export AKS_CLUSTER_NAME AKS_RESOURCE_GROUP
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
  echo " - ai/infrastructure/helm/pixelated-empathy"
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
  echo "AKS cluster variables are required."
  echo "Provide either AKS_CLUSTER_NAME/AKS_RESOURCE_GROUP or AZURE_AKS_CLUSTER_NAME/AZURE_AKS_RESOURCE_GROUP in the variable group."
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
export HELM_EXPERIMENTAL_OCI=1
ACR_TOKEN=$(az acr login --name "${ACR_NAME}" --expose-token --output tsv --query accessToken)
echo "${ACR_TOKEN}" | helm registry login "${ACR_LOGIN_SERVER}" --username "00000000-0000-0000-0000-000000000000" --password-stdin

if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
  echo "📦 Building and pushing ${IMAGE_FULL}"
  docker build -f docker/Dockerfile.production -t "${IMAGE_FULL}" .
  docker push "${IMAGE_FULL}"

  if [ "${PUSH_LATEST}" = "True" ] || [ "${PUSH_LATEST}" = "true" ] || [ "${PUSH_LATEST}" = "1" ]; then
    docker tag "${IMAGE_FULL}" "${IMAGE_LATEST}"
    docker push "${IMAGE_LATEST}"
  fi
else
  echo "⏭️  SKIP_BUILD=true, skipping docker build and push."
fi

echo "🔐 Loading AKS kubeconfig"
az aks get-credentials --resource-group "${RESOURCE_GROUP}" --name "${CLUSTER_NAME}" --overwrite-existing
kubectl cluster-info

echo "📦 Preparing Helm chart for ${NAMESPACE}"
# Moved after context loading to ensure private registry access if needed
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

get_helm_release_status() {
  local release_name="$1"
  local namespace="$2"
  local status_json

  if ! status_json="$(helm -n "${namespace}" status "${release_name}" -o json 2>/dev/null)"; then
    return 1
  fi

  STATUS_JSON="${status_json}" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["STATUS_JSON"])
print(payload.get("info", {}).get("status", ""))
PY
}

clear_stale_pending_release() {
  local release_name="$1"
  local namespace="$2"
  local release_status=""
  local orphaned_resources=()
  local release_secrets=()

  release_status="$(get_helm_release_status "${release_name}" "${namespace}" || true)"
  case "${release_status}" in
    pending-install|pending-upgrade|pending-rollback)
      echo "⚠️  Helm release ${release_name} is stuck in status ${release_status}. Clearing stale release metadata..."
      helm uninstall "${release_name}" -n "${namespace}" --wait --timeout 5m || true

      mapfile -t orphaned_resources < <(kubectl get all -n "${namespace}" -l "app.kubernetes.io/instance=${release_name}" -o name 2>/dev/null || true)
      if [ "${#orphaned_resources[@]}" -gt 0 ]; then
        echo "   Removing orphaned release resources..."
        kubectl delete -n "${namespace}" --ignore-not-found=true "${orphaned_resources[@]}" || true
      fi

      mapfile -t release_secrets < <(kubectl get secret -n "${namespace}" -o name 2>/dev/null | grep "^secret/sh\\.helm\\.release\\.v1\\.${release_name}\\.v" || true)
      if [ "${#release_secrets[@]}" -gt 0 ]; then
        echo "   Removing stale Helm secrets..."
        kubectl delete -n "${namespace}" "${release_secrets[@]}" || true
      fi
      ;;
  esac
}

retire_legacy_staging_release() {
  if [ "${APP_ENV}" != "production" ]; then
    return 0
  fi

  local legacy_namespace="pixelated-empathy-staging"
  local legacy_release="pixelated-empathy-staging"

  if ! helm -n "${legacy_namespace}" status "${legacy_release}" >/dev/null 2>&1; then
    return 0
  fi

  echo "🧹 Retiring legacy staging release ${legacy_release} before live production deploy..."
  clear_stale_pending_release "${legacy_release}" "${legacy_namespace}"
  helm uninstall "${legacy_release}" -n "${legacy_namespace}" --wait --timeout 10m || true

  local stale_cluster_resources=()
  mapfile -t stale_cluster_resources < <(
    kubectl get clusterrole,clusterrolebinding,ingressclass \
      -o go-template='{{range .items}}{{if and (eq (index .metadata.annotations "meta.helm.sh/release-name") "'"${legacy_release}"'") (eq (index .metadata.annotations "meta.helm.sh/release-namespace") "'"${legacy_namespace}"'")}}{{lower .kind}}/{{.metadata.name}}{{"\n"}}{{end}}{{end}}' \
      2>/dev/null
  )
  if [ "${#stale_cluster_resources[@]}" -gt 0 ]; then
    echo "   Removing stale legacy-owned cluster resources..."
    kubectl delete "${stale_cluster_resources[@]}" --ignore-not-found=true
  fi
}

retire_legacy_staging_release
set +e
# Delete statefulsets with cascade=orphan to allow Helm to recreate them if immutable fields changed (e.g. volume templates)
# We use --cascade=orphan to keep the pods running while the controller is replaced by Helm.
echo "🧹 Checking for existing statefulsets to avoid immutable field conflicts..."
clear_stale_pending_release "${RELEASE_NAME}" "${NAMESPACE}"
trap cleanup_runtime_values_file EXIT
fetch_existing_runtime_inputs "${NAMESPACE}" "${RELEASE_NAME}"
resolve_runtime_credentials "${RELEASE_NAME}"
create_runtime_values_file "${RELEASE_NAME}"
for sts in "${RELEASE_NAME}-postgresql" "${RELEASE_NAME}-redis-master" "${RELEASE_NAME}-redis-replicas"; do
  if kubectl get statefulset "$sts" -n "${NAMESPACE}" >/dev/null 2>&1; then
    echo "   Removing statefulset $sts (keeping pods)..."
    kubectl delete statefulset "$sts" -n "${NAMESPACE}" --cascade=orphan --wait=true || true
  fi
done
helm upgrade "${RELEASE_NAME}" "${CHART_DIR}" \
  --install \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  "${HELM_VALUES_ARGS[@]}" \
  --values "${RUNTIME_VALUES_FILE}" \
  --set image.repository="${ACR_LOGIN_SERVER}/${ACR_REPO}" \
  --set image.tag="${IMAGE_TAG}" \
  --set ingress.hosts[0].host="${APP_HOSTNAME}" \
  --set ingress.tls[0].hosts[0]="${APP_HOSTNAME}" \
  --set ingress.tls[0].secretName="pixelated-empathy-${APP_ENV}-tls" \
  --wait \
  --timeout 10m \
  --atomic \
  --force
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
