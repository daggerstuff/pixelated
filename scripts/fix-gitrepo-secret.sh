#!/bin/bash
set -e

echo "🔧 Fixing GitRepository Secret"
echo "=============================="
echo ""
echo "The current secret appears to have an expired or invalid GitHub token."
echo ""

# Check if secret exists
if kubectl get secret flux-system -n flux-system &>/dev/null; then
    echo "⚠️  Secret 'flux-system' exists. This will update it."
    echo ""
fi

echo "You need a GitHub Personal Access Token (PAT) with the following scopes:"
echo "  - repo (Full control of private repositories)"
echo "  - read:org (Read org membership - if repo is in an org)"
echo ""
echo "Create one at: https://github.com/settings/tokens"
echo ""

read -p "GitHub Username [pixelatedempathy]: " GITHUB_USERNAME
GITHUB_USERNAME=${GITHUB_USERNAME:-pixelatedempathy}

read -sp "GitHub Personal Access Token: " GITHUB_TOKEN
echo ""
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: Token cannot be empty"
    exit 1
fi

# Delete existing secret
if kubectl get secret flux-system -n flux-system &>/dev/null; then
    echo "Deleting old secret..."
    kubectl delete secret flux-system -n flux-system
fi

# Create new secret
echo "Creating new secret..."
kubectl create secret generic flux-system \
  --from-literal=username="$GITHUB_USERNAME" \
  --from-literal=password="$GITHUB_TOKEN" \
  -n flux-system

echo ""
echo "✅ Secret updated!"
echo ""
echo "Testing authentication..."
echo "Waiting 5 seconds for secret to propagate..."
sleep 5

# Force reconciliation
kubectl annotate gitrepository flux-system -n flux-system fluxcd.io/reconcile=true --overwrite

echo ""
echo "Monitoring GitRepository status (Ctrl+C to exit)..."
echo ""
kubectl get gitrepository flux-system -n flux-system -w

