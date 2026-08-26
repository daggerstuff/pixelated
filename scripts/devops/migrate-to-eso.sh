#!/usr/bin/env bash
# Migrate file-based secrets to External Secrets Operator (ESO)
# Usage: ./scripts/devops/migrate-to-eso.sh [--install] [--verify]
#
# This script:
#   1. (optional) Installs ESO via Helm
#   2. Applies SecretStore and ExternalSecret CRDs
#   3. Waits for ExternalSecret to sync
#   4. Verifies no secrets are committed to git
#   5. Removes tracked secret files from git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K8S_DIR="$REPO_ROOT/infra/k8s/base"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[migrate-to-eso]${NC} $*"; }
warn() { echo -e "${YELLOW}[migrate-to-eso] WARN:${NC} $*"; }
err() { echo -e "${RED}[migrate-to-eso] ERROR:${NC} $*" >&2; }

INSTALL_ESO=false
VERIFY_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) INSTALL_ESO=true; shift ;;
    --verify) VERIFY_ONLY=true; shift ;;
    *) err "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ "$VERIFY_ONLY" == "true" ]]; then
  log "Verifying no secrets committed to git..."
  TRACKED=$(git -C "$REPO_ROOT" ls-files "config/secrets/" | grep -v '.example\|.gitignore\|README.md' || true)
  if [[ -n "$TRACKED" ]]; then
    err "Tracked secret files found:"
    echo "$TRACKED"
    exit 1
  fi
  log "No tracked secrets found. OK."
  exit 0
fi

if [[ "$INSTALL_ESO" == "true" ]]; then
  log "Installing External Secrets Operator..."
  helm repo add external-secrets https://charts.external-secrets.io || true
  helm repo update
  helm upgrade --install external-secrets external-secrets/external-secrets \
    -n external-secrets --create-namespace \
    -f "$K8S_DIR/eso-install.yaml"
  log "Waiting for ESO pods to be ready..."
  kubectl -n external-secrets wait --for=condition=Ready pod -l app.kubernetes.io/name=external-secrets --timeout=120s
fi

log "Applying SecretStore manifests..."
kubectl apply -f "$K8S_DIR/secret-store.yaml"

log "Applying ExternalSecret CRDs..."
kubectl apply -f "$K8S_DIR/external-secrets.yaml"

log "Waiting for ExternalSecret to sync..."
kubectl -n pixelated-empathy wait --for=condition=Ready externalsecret/pixelated-empathy-secrets --timeout=60s

log "Verifying synced secret..."
kubectl -n pixelated-empathy get secret pixelated-empathy-secrets -o jsonpath='{.data}' | head -c 100
echo ""

log "Removing tracked secret files from git..."
git -C "$REPO_ROOT" rm --cached config/secrets/auth0-client-id config/secrets/auth0-client-secret config/secrets/auth0-domain config/secrets/auth0-management-client-id config/secrets/auth0-management-client-secret config/secrets/db-password config/secrets/encryption-key config/secrets/jwt-secret config/secrets/redis-password 2>/dev/null || warn "Secret files already untracked"

log "Running security scan..."
bash "$REPO_ROOT/scripts/devops/security-scan.sh" || warn "Security scan reported issues (review manually)"

log "Migration complete. Verify with: $0 --verify"
