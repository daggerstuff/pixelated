#!/bin/bash
set -euo pipefail

# Blue-Green Deployment Script for Pixelated Empathy
# Usage: ./scripts/devops/blue-green-deploy.sh [options]
#
# Workflow:
#   1. Determine active slot (blue or green) from Service selector
#   2. Deploy new image to the INACTIVE slot
#   3. Wait for rollout to complete (pods Ready)
#   4. Run health checks against the inactive slot's pods
#   5. If healthy → switch Service selector to the new slot
#   6. If unhealthy → abort, keep traffic on current slot
#   7. Keep old slot running for instant rollback (within 5-min window)
#
# Rollback:
#   ./scripts/devops/blue-green-deploy.sh --rollback
#   Switches Service selector back to the previous slot.
#
# Health check: uses scripts/devops/health-check-comprehensive.sh if available,
# falls back to kubectl rollout status + /health endpoint probing.

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-pixelated-empathy}"
SERVICE_NAME="${SERVICE_NAME:-pixelated-empathy}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"  # 5 minutes
ROLLBACK_WINDOW="${ROLLBACK_WINDOW:-300}"  # 5-minute rollback window
DEPLOYMENT_PREFIX="${DEPLOYMENT_PREFIX:-pixelated-empathy}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

get_active_slot() {
  local slot
  slot=$(kubectl get service "${SERVICE_NAME}" -n "${NAMESPACE}" \
    -o jsonpath='{.spec.selector.slot}' 2>/dev/null || echo "")
  if [[ -z "${slot}" ]]; then
    log_error "Could not determine active slot from Service '${SERVICE_NAME}'"
    log_error "Service selector must include a 'slot' key (blue or green)"
    exit 1
  fi
  echo "${slot}"
}

get_inactive_slot() {
  local active="$1"
  if [[ "${active}" == "blue" ]]; then
    echo "green"
  else
    echo "blue"
  fi
}

get_deployment_name() {
  local slot="$1"
  echo "${DEPLOYMENT_PREFIX}-${slot}"
}

switch_traffic() {
  local target_slot="$1"
  local deployment
  deployment=$(get_deployment_name "${target_slot}")
  log_info "Switching Service '${SERVICE_NAME}' to slot: ${target_slot}"
  kubectl patch service "${SERVICE_NAME}" -n "${NAMESPACE}" \
    --type=json \
    -p="[{\"op\":\"replace\",\"path\":\"/spec/selector/slot\",\"value\":\"${target_slot}\"}]"
  log_success "Traffic switched to ${target_slot} (${deployment})"
}

wait_for_rollout() {
  local deployment="$1"
  log_info "Waiting for rollout of ${deployment} to complete (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."
  if ! kubectl rollout status deployment "${deployment}" -n "${NAMESPACE}" \
      --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
    log_error "Rollout of ${deployment} failed or timed out"
    return 1
  fi
  log_success "Rollout of ${deployment} complete"
}

run_health_checks() {
  local slot="$1"
  local deployment
  deployment=$(get_deployment_name "${slot}")

  log_info "Running health checks against ${deployment} (slot: ${slot})..."

  # 1. Check all pods are Ready
  local ready_pods
  ready_pods=$(kubectl get deployment "${deployment}" -n "${NAMESPACE}" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

  if [[ "${ready_pods}" == "0" ]] || [[ -z "${ready_pods}" ]]; then
    log_error "No ready pods in ${deployment}"
    return 1
  fi

  log_success "${ready_pods} pod(s) Ready in ${deployment}"

  # 2. Try comprehensive health check script if available
  local health_script="scripts/devops/health-check-comprehensive.sh"
  if [[ -x "${health_script}" ]]; then
    log_info "Running comprehensive health check script..."
    if bash "${health_script}"; then
      log_success "Comprehensive health checks passed"
      return 0
    else
      log_error "Comprehensive health checks failed"
      return 1
    fi
  fi

  # 3. Fallback: probe /health on each pod via port-forward
  log_info "Probing ${HEALTH_PATH} on pods in ${deployment}..."
  local pods
  pods=$(kubectl get pods -n "${NAMESPACE}" \
    -l "app=${DEPLOYMENT_PREFIX},slot=${slot}" \
    -o jsonpath='{.items[*].metadata.name}')

  if [[ -z "${pods}" ]]; then
    log_error "No pods found for slot ${slot}"
    return 1
  fi

  local all_healthy=true
  for pod in ${pods}; do
    local healthy
    healthy=$(kubectl exec "${pod}" -n "${NAMESPACE}" -- \
      curl -s -o /dev/null -w '%{http_code}' \
      "http://localhost:4321${HEALTH_PATH}" 2>/dev/null || echo "000")

    if [[ "${healthy}" == "200" ]]; then
      log_success "Pod ${pod}: healthy (200)"
    else
      log_error "Pod ${pod}: unhealthy (${healthy})"
      all_healthy=false
    fi
  done

  if [[ "${all_healthy}" == "false" ]]; then
    log_error "Health checks failed for slot ${slot}"
    return 1
  fi

  log_success "All health checks passed for slot ${slot}"
  return 0
}

update_image() {
  local slot="$1"
  local tag="${2:-${IMAGE_TAG}}"
  local deployment
  deployment=$(get_deployment_name "${slot}")

  log_info "Updating ${deployment} to image pixelatedempathy/api:${tag}"
  kubectl set image deployment "${deployment}" \
    "${DEPLOYMENT_PREFIX}=pixelatedempathy/api:${tag}" \
    -n "${NAMESPACE}"
}

scale_slot() {
  local slot="$1"
  local replicas="$2"
  local deployment
  deployment=$(get_deployment_name "${slot}")
  kubectl scale deployment "${deployment}" -n "${NAMESPACE}" --replicas="${replicas}"
}

# ---------------------------------------------------------------------------
# Main: Deploy
# ---------------------------------------------------------------------------

deploy() {
  log_info "=== Blue-Green Deploy ==="
  log_info "Namespace: ${NAMESPACE}"
  log_info "Service:   ${SERVICE_NAME}"
  log_info "Image tag: ${IMAGE_TAG}"
  echo ""

  # 1. Determine active and inactive slots
  local active_slot inactive_slot
  active_slot=$(get_active_slot)
  inactive_slot=$(get_inactive_slot "${active_slot}")

  log_info "Active slot:   ${active_slot}"
  log_info "Target slot:   ${inactive_slot}"
  echo ""

  # 2. Deploy new image to the inactive slot
  update_image "${inactive_slot}" "${IMAGE_TAG}"

  # 3. Wait for rollout
  if ! wait_for_rollout "$(get_deployment_name "${inactive_slot}")"; then
    log_error "Deployment to ${inactive_slot} failed. Traffic remains on ${active_slot}."
    exit 1
  fi

  # 4. Run health checks
  if ! run_health_checks "${inactive_slot}"; then
    log_error "Health checks failed for ${inactive_slot}. Aborting deploy."
    log_error "Traffic remains on ${active_slot}."
    exit 1
  fi

  # 5. Switch traffic
  switch_traffic "${inactive_slot}"

  # 6. Keep old slot running for rollback window
  log_info "Previous slot (${active_slot}) kept running for ${ROLLBACK_WINDOW}s rollback window."
  log_info "To rollback: ./scripts/devops/blue-green-deploy.sh --rollback"
  log_success "Blue-green deploy complete! Active slot: ${inactive_slot}"
}

# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------

rollback() {
  log_info "=== Blue-Green Rollback ==="

  local active_slot previous_slot
  active_slot=$(get_active_slot)
  previous_slot=$(get_inactive_slot "${active_slot}")

  log_info "Current active slot: ${active_slot}"
  log_info "Rolling back to:     ${previous_slot}"

  # Verify previous slot still has pods
  local prev_ready
  prev_ready=$(kubectl get deployment "$(get_deployment_name "${previous_slot}")" \
    -n "${NAMESPACE}" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

  if [[ "${prev_ready}" == "0" ]] || [[ -z "${prev_ready}" ]]; then
    log_error "Previous slot (${previous_slot}) has no ready pods. Cannot rollback."
    exit 1
  fi

  switch_traffic "${previous_slot}"
  log_success "Rollback complete! Active slot: ${previous_slot}"
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

status() {
  log_info "=== Blue-Green Status ==="
  local active_slot
  active_slot=$(get_active_slot)
  local inactive_slot
  inactive_slot=$(get_inactive_slot "${active_slot}")

  echo ""
  echo "Service:        ${SERVICE_NAME} (ns: ${NAMESPACE})"
  echo "Active slot:    ${active_slot}"
  echo "Inactive slot:  ${inactive_slot}"
  echo ""

  for slot in blue green; do
    local deployment ready total
    deployment=$(get_deployment_name "${slot}")
    ready=$(kubectl get deployment "${deployment}" -n "${NAMESPACE}" \
      -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    total=$(kubectl get deployment "${deployment}" -n "${NAMESPACE}" \
      -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    local image
    image=$(kubectl get deployment "${deployment}" -n "${NAMESPACE}" \
      -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")

    local marker=""
    if [[ "${slot}" == "${active_slot}" ]]; then
      marker=" ← ACTIVE"
    fi

    echo "  ${slot}${marker}:"
    echo "    Deployment: ${deployment}"
    echo "    Replicas:   ${ready}/${total} ready"
    echo "    Image:      ${image}"
  done
}

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

case "${1:-deploy}" in
  deploy|--deploy|"")
    deploy
    ;;
  rollback|--rollback)
    rollback
    ;;
  status|--status)
    status
    ;;
  *)
    echo "Usage: $0 {deploy|rollback|status}"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy new image to inactive slot, health check, switch traffic"
    echo "  rollback  Switch traffic back to the previous slot"
    echo "  status    Show current blue-green deployment status"
    echo ""
    echo "Environment variables:"
    echo "  NAMESPACE           K8s namespace (default: pixelated-empathy)"
    echo "  SERVICE_NAME        K8s service name (default: pixelated-empathy)"
    echo "  IMAGE_TAG           Image tag to deploy (default: latest)"
    echo "  HEALTH_CHECK_TIMEOUT  Rollout wait timeout in seconds (default: 300)"
    echo "  ROLLBACK_WINDOW     Seconds to keep old slot for rollback (default: 300)"
    exit 1
    ;;
esac
