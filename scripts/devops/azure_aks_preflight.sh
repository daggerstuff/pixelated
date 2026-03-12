#!/usr/bin/env bash
set -euo pipefail

AZURE_CLI_BIN="${AZURE_CLI_BIN:-/usr/bin/az}"
if ! command -v "${AZURE_CLI_BIN}" >/dev/null 2>&1; then
  echo "##vso[task.logissue type=error]Azure CLI not found at ${AZURE_CLI_BIN}."
  exit 1
fi

echo "##[section]Azure CLI diagnostics"
echo "Azure CLI location: ${AZURE_CLI_BIN}"
echo "Azure CLI version:"
"${AZURE_CLI_BIN}" --version | head -n 20
echo "Active cloud:"
"${AZURE_CLI_BIN}" cloud show --query name -o tsv

echo "Active account summary:"
if ! "${AZURE_CLI_BIN}" account show --query "{id:id, name:name, tenantId:tenantId}" -o table; then
  echo "##vso[task.logissue type=error]Azure CLI is authenticated but unable to read active account context."
  echo "This usually means the bound service connection points to a subscription that does not exist in the current cloud or tenant."
  echo "Verify AZURE_SUBSCRIPTION in DevOps points to the correct service connection and subscription."
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
  echo "Attempting explicit subscription switch..."
  if ! "${AZURE_CLI_BIN}" account set --subscription "${AZURE_SUBSCRIPTION_ID}"; then
    echo "##vso[task.logissue type=error]Could not switch to AZURE_SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID}."
    echo "If this is intended, verify that this subscription exists in cloud 'AzureCloud' and belongs to the same tenant."
    echo "If the value is not needed, clear AZURE_SUBSCRIPTION_ID from variable group to avoid accidental mismatch."
    exit 1
  fi
  CURRENT_SUBSCRIPTION_ID=$("${AZURE_CLI_BIN}" account show --query "id" -o tsv)
  echo "Now using subscription: ${CURRENT_SUBSCRIPTION_ID}"
fi
