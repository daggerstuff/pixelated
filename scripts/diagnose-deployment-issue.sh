#!/bin/bash
set -e

echo "🔍 Deployment Issue Diagnostic Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check kubectl access
echo "1️⃣ Checking kubectl access..."
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ ERROR: Cannot access Kubernetes cluster${NC}"
    echo "   Run: kubectl config use-context <your-cluster-context>"
    exit 1
fi
echo -e "${GREEN}✅ kubectl is accessible${NC}"
CLUSTER_CONTEXT=$(kubectl config current-context)
echo "   Current context: $CLUSTER_CONTEXT"
echo ""

# Check if Docker build workflow ran
echo "2️⃣ Checking recent GitHub workflow runs..."
echo "   Check manually: https://github.com/pixelatedempathy/pixelated/actions/workflows/docker-hub-build.yml"
echo "   Latest commit: $(git log -1 --oneline --format='%h %s')"
echo ""

# Check Docker Hub image
echo "3️⃣ Checking Docker Hub image..."
echo "   Image: docker.io/pixelatedempathy/pixelated-empathy:latest"
echo "   Check manually: https://hub.docker.com/r/pixelatedempathy/pixelated-empathy/tags"
echo ""

# Check Flux components
echo "4️⃣ Checking Flux components..."
kubectl get pods -n flux-system --no-headers 2>/dev/null | while read -r line; do
    STATUS=$(echo "$line" | awk '{print $3}')
    if [ "$STATUS" != "Running" ]; then
        echo -e "${YELLOW}⚠️  Pod not running: $line${NC}"
    fi
done
echo ""

# Check GitRepository
echo "5️⃣ Checking GitRepository status..."
GITREPO_STATUS=$(kubectl get gitrepository flux-system -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
if [ "$GITREPO_STATUS" = "True" ]; then
    echo -e "${GREEN}✅ GitRepository is Ready${NC}"
    LAST_FETCH=$(kubectl get gitrepository flux-system -n flux-system -o jsonpath='{.status.artifact.revision}' 2>/dev/null || echo "Unknown")
    echo "   Last fetch: $LAST_FETCH"
else
    echo -e "${RED}❌ GitRepository is NOT Ready${NC}"
    kubectl get gitrepository flux-system -n flux-system -o jsonpath='{.status.conditions[*].message}' 2>/dev/null || echo "No status found"
fi
echo ""

# Check ImageRepository
echo "6️⃣ Checking ImageRepository status..."
IMGREPO_STATUS=$(kubectl get imagerepository pixelated-empathy -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
if [ "$IMGREPO_STATUS" = "True" ]; then
    echo -e "${GREEN}✅ ImageRepository is Ready${NC}"
    LAST_SCAN=$(kubectl get imagerepository pixelated-empathy -n flux-system -o jsonpath='{.status.lastScanResult.scanTime}' 2>/dev/null || echo "Unknown")
    LATEST_IMAGE=$(kubectl get imagerepository pixelated-empathy -n flux-system -o jsonpath='{.status.lastScanResult.tag}' 2>/dev/null || echo "Unknown")
    echo "   Last scan: $LAST_SCAN"
    echo "   Latest image tag: $LATEST_IMAGE"
else
    echo -e "${RED}❌ ImageRepository is NOT Ready${NC}"
    kubectl get imagerepository pixelated-empathy -n flux-system -o jsonpath='{.status.conditions[*].message}' 2>/dev/null || echo "No status found"
fi
echo ""

# Check ImagePolicy
echo "7️⃣ Checking ImagePolicy status..."
IMGPOLICY_STATUS=$(kubectl get imagepolicy pixelated-empathy -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
if [ "$IMGPOLICY_STATUS" = "True" ]; then
    echo -e "${GREEN}✅ ImagePolicy is Ready${NC}"
    LATEST_TAG=$(kubectl get imagepolicy pixelated-empathy -n flux-system -o jsonpath='{.status.latestImage}' 2>/dev/null || echo "Unknown")
    echo "   Latest image: $LATEST_TAG"
else
    echo -e "${RED}❌ ImagePolicy is NOT Ready${NC}"
    kubectl get imagepolicy pixelated-empathy -n flux-system -o jsonpath='{.status.conditions[*].message}' 2>/dev/null || echo "No status found"
fi
echo ""

# Check ImageUpdateAutomation
echo "8️⃣ Checking ImageUpdateAutomation status..."
IMGUPDATE_STATUS=$(kubectl get imageupdateautomation pixelated-empathy -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
if [ "$IMGUPDATE_STATUS" = "True" ]; then
    echo -e "${GREEN}✅ ImageUpdateAutomation is Ready${NC}"
    LAST_PUSH=$(kubectl get imageupdateautomation pixelated-empathy -n flux-system -o jsonpath='{.status.lastPushResult.revision}' 2>/dev/null || echo "Unknown")
    echo "   Last push: $LAST_PUSH"
else
    echo -e "${RED}❌ ImageUpdateAutomation is NOT Ready${NC}"
    kubectl get imageupdateautomation pixelated-empathy -n flux-system -o jsonpath='{.status.conditions[*].message}' 2>/dev/null || echo "No status found"
fi
echo ""

# Check if Kustomization exists for pixelated
echo "9️⃣ Checking Kustomization for pixelated deployment..."
if kubectl get kustomization pixelated -n flux-system &>/dev/null; then
    echo -e "${GREEN}✅ Kustomization 'pixelated' exists${NC}"
    KUSTOM_STATUS=$(kubectl get kustomization pixelated -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
    if [ "$KUSTOM_STATUS" = "True" ]; then
        echo -e "${GREEN}   Status: Ready${NC}"
    else
        echo -e "${RED}   Status: NOT Ready${NC}"
        kubectl get kustomization pixelated -n flux-system -o jsonpath='{.status.conditions[*].message}' 2>/dev/null || echo "No status found"
    fi
    LAST_APPLY=$(kubectl get kustomization pixelated -n flux-system -o jsonpath='{.status.lastAppliedRevision}' 2>/dev/null || echo "Unknown")
    echo "   Last applied: $LAST_APPLY"
else
    echo -e "${RED}❌ CRITICAL: Kustomization 'pixelated' does NOT exist${NC}"
    echo "   This is likely why deployments aren't updating!"
    echo "   The Kustomization only syncs flux-system, not the pixelated deployment."
fi
echo ""

# Check current deployment
echo "🔟 Checking current deployment..."
if kubectl get deployment pixelated -n pixelated &>/dev/null; then
    CURRENT_IMAGE=$(kubectl get deployment pixelated -n pixelated -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "N/A")
    echo "   Current image: $CURRENT_IMAGE"
    REPLICAS_READY=$(kubectl get deployment pixelated -n pixelated -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    REPLICAS_DESIRED=$(kubectl get deployment pixelated -n pixelated -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    echo "   Replicas: $REPLICAS_READY/$REPLICAS_DESIRED ready"
    if [ "$REPLICAS_READY" != "$REPLICAS_DESIRED" ]; then
        echo -e "${YELLOW}⚠️  Deployment not fully ready${NC}"
    fi
else
    echo -e "${RED}❌ Deployment 'pixelated' not found in namespace 'pixelated'${NC}"
fi
echo ""

# Check recent git commits
echo "1️⃣1️⃣ Checking recent git commits..."
echo "   Recent commits on master:"
git log --oneline -5 master 2>/dev/null || echo "   Could not check git log"
echo ""

# Check for Flux image automation commits
echo "1️⃣2️⃣ Checking for Flux image automation commits..."
FLUX_COMMITS=$(git log --oneline --grep="chore(image-automation)" -5 2>/dev/null || echo "None found")
if [ -n "$FLUX_COMMITS" ] && [ "$FLUX_COMMITS" != "None found" ]; then
    echo -e "${GREEN}✅ Found Flux image automation commits:${NC}"
    echo "$FLUX_COMMITS"
else
    echo -e "${YELLOW}⚠️  No recent Flux image automation commits found${NC}"
    echo "   This might indicate ImageUpdateAutomation is not working"
fi
echo ""

echo "===================================="
echo "📋 Summary & Next Steps"
echo "===================================="
echo ""
echo "Common issues to check:"
echo "  1. ❌ Missing Kustomization for pixelated deployment (CRITICAL)"
echo "  2. ⚠️  Docker build workflow may not have run"
echo "  3. ⚠️  Docker image may not have been pushed to Docker Hub"
echo "  4. ⚠️  ImageUpdateAutomation may not have git push permissions"
echo "  5. ⚠️  GitRepository authentication may have expired"
echo ""
echo "To fix the missing Kustomization, create:"
echo "  clusters/pixelkube/flux-system/pixelated-kustomization.yaml"
echo ""

