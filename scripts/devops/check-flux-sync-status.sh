#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🕐 Flux Sync Status Checker"
echo "============================"
echo ""

# Check kubectl access
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ ERROR: Cannot access Kubernetes cluster${NC}"
    exit 1
fi

# Function to calculate next sync time
calculate_next_sync() {
    local last_sync=$1
    local interval=$2
    
    if [ -z "$last_sync" ] || [ "$last_sync" = "Unknown" ]; then
        echo "Unknown (no previous sync)"
        return
    fi
    
    # Parse the last sync time (format: YYYY-MM-DDTHH:MM:SSZ)
    # Convert to epoch seconds, add interval, convert back
    if command -v date >/dev/null 2>&1; then
        # For Linux/Mac date parsing
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS date parsing
            LAST_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_sync" +%s 2>/dev/null || echo "")
        else
            # Linux date parsing
            LAST_EPOCH=$(date -d "$last_sync" +%s 2>/dev/null || echo "")
        fi
        
        if [ -n "$LAST_EPOCH" ]; then
            # Parse interval (e.g., "10m0s" -> 600 seconds)
            INTERVAL_SEC=$(echo "$interval" | sed 's/m/*60+/g; s/s//g; s/+$//' | bc 2>/dev/null || echo "")
            if [ -n "$INTERVAL_SEC" ]; then
                NEXT_EPOCH=$((LAST_EPOCH + INTERVAL_SEC))
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    NEXT_TIME=$(date -r "$NEXT_EPOCH" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "")
                else
                    NEXT_TIME=$(date -d "@$NEXT_EPOCH" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "")
                fi
                echo "$NEXT_TIME"
                return
            fi
        fi
    fi
    echo "Calculate manually: Last sync + $interval"
}

# Check GitRepository
echo "📦 GitRepository Status"
echo "----------------------"
GITREPO_READY=$(kubectl get gitrepository flux-system -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
GITREPO_LAST_FETCH=$(kubectl get gitrepository flux-system -n flux-system -o jsonpath='{.status.lastFetchedAt}' 2>/dev/null || echo "Unknown")
GITREPO_INTERVAL=$(kubectl get gitrepository flux-system -n flux-system -o jsonpath='{.spec.interval}' 2>/dev/null || echo "Unknown")

if [ "$GITREPO_READY" = "True" ]; then
    echo -e "Status: ${GREEN}Ready${NC}"
else
    echo -e "Status: ${RED}Not Ready${NC}"
fi
echo "Last fetched: $GITREPO_LAST_FETCH"
echo "Interval: $GITREPO_INTERVAL"
if [ "$GITREPO_LAST_FETCH" != "Unknown" ] && [ "$GITREPO_INTERVAL" != "Unknown" ]; then
    NEXT_SYNC=$(calculate_next_sync "$GITREPO_LAST_FETCH" "$GITREPO_INTERVAL")
    echo -e "Next sync: ${BLUE}$NEXT_SYNC${NC}"
fi
echo ""

# Check Kustomization: flux-system
echo "🔄 Kustomization: flux-system"
echo "-----------------------------"
KUSTOM_SYS_READY=$(kubectl get kustomization flux-system -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
KUSTOM_SYS_LAST_APPLY=$(kubectl get kustomization flux-system -n flux-system -o jsonpath='{.status.lastAppliedRevision}' 2>/dev/null || echo "Unknown")
KUSTOM_SYS_LAST_UPDATE=$(kubectl get kustomization flux-system -n flux-system -o jsonpath='{.status.lastHandledReconcileAt}' 2>/dev/null || echo "Unknown")
KUSTOM_SYS_INTERVAL=$(kubectl get kustomization flux-system -n flux-system -o jsonpath='{.spec.interval}' 2>/dev/null || echo "Unknown")

if [ "$KUSTOM_SYS_READY" = "True" ]; then
    echo -e "Status: ${GREEN}Ready${NC}"
else
    echo -e "Status: ${RED}Not Ready${NC}"
fi
echo "Last applied: $KUSTOM_SYS_LAST_APPLY"
echo "Last handled: $KUSTOM_SYS_LAST_UPDATE"
echo "Interval: $KUSTOM_SYS_INTERVAL"
if [ "$KUSTOM_SYS_LAST_UPDATE" != "Unknown" ] && [ "$KUSTOM_SYS_INTERVAL" != "Unknown" ]; then
    NEXT_SYNC=$(calculate_next_sync "$KUSTOM_SYS_LAST_UPDATE" "$KUSTOM_SYS_INTERVAL")
    echo -e "Next sync: ${BLUE}$NEXT_SYNC${NC}"
fi
echo ""

# Check Kustomization: pixelated (if it exists)
echo "🔄 Kustomization: pixelated"
echo "----------------------------"
if kubectl get kustomization pixelated -n flux-system &>/dev/null; then
    KUSTOM_PIX_READY=$(kubectl get kustomization pixelated -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
    KUSTOM_PIX_LAST_APPLY=$(kubectl get kustomization pixelated -n flux-system -o jsonpath='{.status.lastAppliedRevision}' 2>/dev/null || echo "Unknown")
    KUSTOM_PIX_LAST_UPDATE=$(kubectl get kustomization pixelated -n flux-system -o jsonpath='{.status.lastHandledReconcileAt}' 2>/dev/null || echo "Unknown")
    KUSTOM_PIX_INTERVAL=$(kubectl get kustomization pixelated -n flux-system -o jsonpath='{.spec.interval}' 2>/dev/null || echo "Unknown")
    
    if [ "$KUSTOM_PIX_READY" = "True" ]; then
        echo -e "Status: ${GREEN}Ready${NC}"
    else
        echo -e "Status: ${RED}Not Ready${NC}"
        MESSAGE=$(kubectl get kustomization pixelated -n flux-system -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}' 2>/dev/null || echo "")
        if [ -n "$MESSAGE" ]; then
            echo -e "Message: ${YELLOW}$MESSAGE${NC}"
        fi
    fi
    echo "Last applied: $KUSTOM_PIX_LAST_APPLY"
    echo "Last handled: $KUSTOM_PIX_LAST_UPDATE"
    echo "Interval: $KUSTOM_PIX_INTERVAL"
    if [ "$KUSTOM_PIX_LAST_UPDATE" != "Unknown" ] && [ "$KUSTOM_PIX_INTERVAL" != "Unknown" ]; then
        NEXT_SYNC=$(calculate_next_sync "$KUSTOM_PIX_LAST_UPDATE" "$KUSTOM_PIX_INTERVAL")
        echo -e "Next sync: ${BLUE}$NEXT_SYNC${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Kustomization 'pixelated' does not exist yet${NC}"
    echo "   It will be created when flux-system Kustomization syncs"
    echo "   (after you push the changes)"
fi
echo ""

# Summary
echo "============================"
echo "📋 Quick Actions"
echo "============================"
echo ""
echo "To trigger immediate sync (don't wait for interval):"
echo ""
echo -e "${BLUE}# Trigger GitRepository sync${NC}"
echo "kubectl annotate gitrepository flux-system -n flux-system \\"
echo "  reconcile.fluxcd.io/requestedAt=\$(date +%s) --overwrite"
echo ""
echo -e "${BLUE}# Trigger Kustomization sync${NC}"
echo "kubectl annotate kustomization flux-system -n flux-system \\"
echo "  reconcile.fluxcd.io/requestedAt=\$(date +%s) --overwrite"
echo ""
if kubectl get kustomization pixelated -n flux-system &>/dev/null; then
    echo -e "${BLUE}# Trigger pixelated Kustomization sync${NC}"
    echo "kubectl annotate kustomization pixelated -n flux-system \\"
    echo "  reconcile.fluxcd.io/requestedAt=\$(date +%s) --overwrite"
    echo ""
fi
echo -e "${BLUE}# Watch for sync to complete${NC}"
echo "kubectl get kustomization -n flux-system -w"
echo ""
echo "Or use Flux CLI (if installed):"
echo "  flux reconcile kustomization flux-system -n flux-system"
echo "  flux reconcile kustomization pixelated -n flux-system"
echo ""

