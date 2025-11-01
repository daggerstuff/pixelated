#!/bin/bash
set -e

echo "🔍 Flux Deployment Diagnostic Script"
echo "===================================="
echo ""

# Check kubectl access
echo "1️⃣ Checking kubectl access..."
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ ERROR: Cannot access Kubernetes cluster"
    echo "   Run: kubectl config use-context <your-civo-context>"
    exit 1
fi
echo "✅ kubectl is accessible"
echo ""

# Check Flux components
echo "2️⃣ Checking Flux components status..."
echo "--- Flux Pods ---"
kubectl get pods -n flux-system
echo ""

# Check GitRepository
echo "3️⃣ Checking GitRepository..."
kubectl get gitrepository flux-system -n flux-system -o yaml | grep -A 20 "status:" || echo "⚠️  No status found"
echo ""

# Check if secret exists
echo "4️⃣ Checking GitRepository secret..."
if kubectl get secret flux-system -n flux-system &>/dev/null; then
    echo "✅ Secret 'flux-system' exists"
    kubectl get secret flux-system -n flux-system -o jsonpath='{.data}' | jq -r 'keys[]' || echo "⚠️  Secret exists but might be empty"
else
    echo "❌ ERROR: Secret 'flux-system' is MISSING"
    echo "   This is required for GitRepository authentication"
fi
echo ""

# Check ImageRepository
echo "5️⃣ Checking ImageRepository..."
kubectl get imagerepository pixelated-empathy -n flux-system -o yaml | grep -A 20 "status:" || echo "⚠️  No status found"
echo ""

# Check ImagePolicy
echo "6️⃣ Checking ImagePolicy..."
kubectl get imagepolicy pixelated-empathy -n flux-system -o yaml | grep -A 10 "status:" || echo "⚠️  No status found"
echo ""

# Check ImageUpdateAutomation
echo "7️⃣ Checking ImageUpdateAutomation..."
kubectl get imageupdateautomation pixelated-empathy -n flux-system -o yaml | grep -A 20 "status:" || echo "⚠️  No status found"
echo ""

# Check if any resources are suspended
echo "8️⃣ Checking for suspended resources..."
SUSPENDED=$(kubectl get gitrepository,kustomization,imagerepository,imagepolicy,imageupdateautomation -n flux-system -o json | jq -r '.items[] | select(.spec.suspend == true) | "\(.kind)/\(.metadata.name)"')
if [ -n "$SUSPENDED" ]; then
    echo "❌ WARNING: Suspended resources found:"
    echo "$SUSPENDED"
else
    echo "✅ No suspended resources"
fi
echo ""

# Check Kustomization
echo "9️⃣ Checking Kustomization..."
kubectl get kustomization flux-system -n flux-system -o yaml | grep -A 20 "status:" || echo "⚠️  No status found"
echo ""

# Check current deployment image
echo "🔟 Checking current deployment image..."
CURRENT_IMAGE=$(kubectl get deployment pixelated -n pixelated -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "N/A")
echo "Current image: $CURRENT_IMAGE"
echo ""

# Check deployment status
echo "1️⃣1️⃣ Checking deployment status..."
kubectl get deployment pixelated -n pixelated || echo "⚠️  Deployment not found in pixelated namespace"
echo ""

# Check receiver/webhook
echo "1️⃣2️⃣ Checking Flux Receiver..."
kubectl get receiver github-receiver -n flux-system -o yaml | grep -A 10 "status:" || echo "⚠️  No status found"
echo ""

# Check for recent events/errors
echo "1️⃣3️⃣ Recent Flux events (last 50)..."
kubectl get events -n flux-system --sort-by='.lastTimestamp' | tail -20 || echo "No events found"
echo ""

echo "===================================="
echo "✅ Diagnostic complete!"
echo ""
echo "Common issues to check:"
echo "  1. GitRepository secret missing or expired"
echo "  2. Docker Hub authentication for ImageRepository"
echo "  3. GitHub token for ImageUpdateAutomation"
echo "  4. Resources suspended (check output above)"
echo "  5. GitHub Actions not triggering builds"
echo ""

