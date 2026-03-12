#!/usr/bin/env bash
set -euo pipefail

AZURE_CLI_BIN="${AZURE_CLI_BIN:-/usr/bin/az}"
AZURE_CLI_MIN_VERSION="${AZURE_CLI_MIN_VERSION:-2.30.0}"
export AZURE_CORE_ONLY_SHOW_ERRORS="${AZURE_CORE_ONLY_SHOW_ERRORS:-true}"
if ! command -v "${AZURE_CLI_BIN}" >/dev/null 2>&1; then
  echo "##vso[task.logissue type=error]Azure CLI not found at ${AZURE_CLI_BIN}."
  exit 1
fi

version_ge() {
  local candidate="$1"
  local minimum="$2"

  [[ "$(printf '%s\n%s\n' "${minimum}" "${candidate}" | sort -V | head -n 1)" == "${minimum}" ]]
}

echo "Checking Azure CLI runtime compatibility..."
AZURE_CLI_VERSION_LINE=$("${AZURE_CLI_BIN}" --version | head -n 1)
AZURE_CLI_VERSION="$("${AZURE_CLI_BIN}" --version | sed -n '1,6p' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)"

if ! version_ge "${AZURE_CLI_VERSION}" "${AZURE_CLI_MIN_VERSION}"; then
  echo "##vso[task.logissue type=error]Unsupported Azure CLI version."
  echo "Found: ${AZURE_CLI_VERSION_LINE}"
  echo "Minimum required: ${AZURE_CLI_MIN_VERSION}"
  echo "Reason: AzureCLI@2 task diagnostics can fail or mis-parse CLI output on very old versions."
  echo "Action: run this job on a modern Microsoft-hosted agent (ubuntu-24.04/ubuntu-latest) or update agent tooling."
  exit 1
fi

echo "##[section]Azure CLI diagnostics"
echo "Azure CLI location: ${AZURE_CLI_BIN}"
echo "Azure CLI version:"
"${AZURE_CLI_BIN}" --version | sed -n '1,20p'

echo "Ensuring active cloud is AzureCloud..."
if ! "${AZURE_CLI_BIN}" cloud set -n AzureCloud >/dev/null; then
  echo "##vso[task.logissue type=error]Unable to switch Azure CLI cloud to AzureCloud."
  exit 1
fi

CURRENT_CLOUD_NAME=$("${AZURE_CLI_BIN}" cloud show --query name -o tsv)
echo "Active cloud: ${CURRENT_CLOUD_NAME}"
if [[ "${CURRENT_CLOUD_NAME}" != "AzureCloud" ]]; then
  echo "##vso[task.logissue type=error]After forcing cloud selection, active cloud is still ${CURRENT_CLOUD_NAME}."
  echo "Fix this by ensuring Azure CLI cloud environment is configured for AzureCloud."
  exit 1
fi

echo "Active account summary:"
if ! "${AZURE_CLI_BIN}" account show --query "{id:id, name:name, tenantId:tenantId}" -o table; then
  echo "##vso[task.logissue type=error]Azure CLI is authenticated but unable to read active account context."
  echo "This usually means the bound service connection points to a subscription that does not exist in the current cloud/tenant."
  echo "Verify AZURE_SUBSCRIPTION in Azure DevOps points to the correct service connection and subscription."
  exit 1
fi

CURRENT_SUBSCRIPTION_ID=$("${AZURE_CLI_BIN}" account show --query "id" -o tsv)
CURRENT_TENANT_ID=$("${AZURE_CLI_BIN}" account show --query "tenantId" -o tsv)
if [[ -z "${CURRENT_SUBSCRIPTION_ID}" || -z "${CURRENT_TENANT_ID}" ]]; then
  echo "##vso[task.logissue type=error]Failed to read required subscription metadata from Azure account context."
  exit 1
fi

echo "Active subscription: ${CURRENT_SUBSCRIPTION_ID}"
echo "Active tenant: ${CURRENT_TENANT_ID}"

if [[ -n "${AZURE_SUBSCRIPTION_ID:-}" && "${CURRENT_SUBSCRIPTION_ID}" != "${AZURE_SUBSCRIPTION_ID}" ]]; then
  echo "⚠️  AZURE_SUBSCRIPTION_ID (${AZURE_SUBSCRIPTION_ID}) differs from active subscription (${CURRENT_SUBSCRIPTION_ID})."
  echo "Attempting automatic subscription resolution by subscription id..."
  if "${AZURE_CLI_BIN}" account set --subscription "${AZURE_SUBSCRIPTION_ID}" >/dev/null; then
    CURRENT_SUBSCRIPTION_ID=$("${AZURE_CLI_BIN}" account show --query "id" -o tsv)
    if [[ "${CURRENT_SUBSCRIPTION_ID}" != "${AZURE_SUBSCRIPTION_ID}" ]]; then
      echo "##vso[task.logissue type=error]Could not switch to ${AZURE_SUBSCRIPTION_ID}. Active subscription remains ${CURRENT_SUBSCRIPTION_ID}."
      exit 1
    fi
    CURRENT_TENANT_ID=$("${AZURE_CLI_BIN}" account show --query "tenantId" -o tsv)
    echo "Now using subscription: ${CURRENT_SUBSCRIPTION_ID}"
    echo "Tenant: ${CURRENT_TENANT_ID}"
    echo "✅ Subscription override applied."
  else
    echo "Subscription ${AZURE_SUBSCRIPTION_ID} is not reachable in this CLI session."
  fi
fi

if [[ "${CURRENT_SUBSCRIPTION_ID}" == "${AZURE_SUBSCRIPTION_ID:-$CURRENT_SUBSCRIPTION_ID}" ]] && [[ -n "${AZURE_SUBSCRIPTION_ID:-}" ]]; then
  echo "✅ Subscription is already aligned with AZURE_SUBSCRIPTION_ID."
  echo "✅ Preflight complete."
  exit 0
fi

echo "Resolving best-match subscription automatically..."
RESOLVED_SUBSCRIPTION_ID=""

if [[ -n "${AZURE_SUBSCRIPTION_NAME:-}" ]]; then
  RESOLVED_SUBSCRIPTION_ID=$("${AZURE_CLI_BIN}" account list --all --query "[?name=='${AZURE_SUBSCRIPTION_NAME}'].id | [0]" -o tsv)
  if [[ -n "${RESOLVED_SUBSCRIPTION_ID}" ]]; then
    echo "Found subscription by AZURE_SUBSCRIPTION_NAME=${AZURE_SUBSCRIPTION_NAME}: ${RESOLVED_SUBSCRIPTION_ID}"
  fi
fi

if [[ -z "${RESOLVED_SUBSCRIPTION_ID}" && -n "${AKS_RESOURCE_GROUP:-}" && -n "${AKS_CLUSTER_NAME:-}" ]]; then
  SUBSCRIPTION_IDS=$("${AZURE_CLI_BIN}" account list --all --query "[].id" -o tsv | tr '\r' '\n')
  for SUBSCRIPTION_ID in ${SUBSCRIPTION_IDS}; do
    if [[ -z "${SUBSCRIPTION_ID}" ]]; then
      continue
    fi

    if "${AZURE_CLI_BIN}" aks show --subscription "${SUBSCRIPTION_ID}" --resource-group "${AKS_RESOURCE_GROUP}" --name "${AKS_CLUSTER_NAME}" >/dev/null 2>&1; then
      RESOLVED_SUBSCRIPTION_ID="${SUBSCRIPTION_ID}"
      echo "Matched AKS cluster ${AKS_CLUSTER_NAME} in resource group ${AKS_RESOURCE_GROUP} to subscription ${RESOLVED_SUBSCRIPTION_ID}"
      break
    fi
  done
fi

if [[ -z "${RESOLVED_SUBSCRIPTION_ID}" ]]; then
  SUBSCRIPTION_COUNT=$("${AZURE_CLI_BIN}" account list --all --query "length(@)" -o tsv)
  if [[ "${SUBSCRIPTION_COUNT}" -eq 1 ]]; then
    RESOLVED_SUBSCRIPTION_ID=$("${AZURE_CLI_BIN}" account list --all --query "[0].id" -o tsv)
    echo "Only one subscription is available; auto-selecting ${RESOLVED_SUBSCRIPTION_ID}"
  fi
fi

if [[ -n "${RESOLVED_SUBSCRIPTION_ID}" ]]; then
  echo "Attempting to switch to auto-resolved subscription ${RESOLVED_SUBSCRIPTION_ID}..."
  if ! "${AZURE_CLI_BIN}" account set --subscription "${RESOLVED_SUBSCRIPTION_ID}" >/dev/null; then
    echo "##vso[task.logissue type=error]Failed to switch to resolved subscription ${RESOLVED_SUBSCRIPTION_ID}."
    exit 1
  fi
  CURRENT_SUBSCRIPTION_ID=$("${AZURE_CLI_BIN}" account show --query "id" -o tsv)
  if [[ "${CURRENT_SUBSCRIPTION_ID}" != "${RESOLVED_SUBSCRIPTION_ID}" ]]; then
    echo "##vso[task.logissue type=error]Subscription switch verification failed. Expected ${RESOLVED_SUBSCRIPTION_ID}, got ${CURRENT_SUBSCRIPTION_ID}."
    exit 1
  fi
  CURRENT_TENANT_ID=$("${AZURE_CLI_BIN}" account show --query "tenantId" -o tsv)
  echo "✅ Switched to subscription: ${CURRENT_SUBSCRIPTION_ID}"
  echo "Active tenant: ${CURRENT_TENANT_ID}"
  exit 0
fi

echo "##vso[task.logissue type=error]Automatic subscription resolution failed."
echo "Azure CLI can currently see:"
"${AZURE_CLI_BIN}" account list --all --output table
if [[ -n "${AKS_RESOURCE_GROUP:-}" && -n "${AKS_CLUSTER_NAME:-}" ]]; then
  echo "Could not locate AKS cluster ${AKS_CLUSTER_NAME} in resource group ${AKS_RESOURCE_GROUP} under any accessible subscription."
fi
echo "Please validate service connection permissions and subscription mappings."
exit 1
