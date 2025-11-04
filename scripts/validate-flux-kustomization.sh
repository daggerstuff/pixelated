#!/bin/bash
set -e

# Validation script to ensure pixelated-kustomization.yaml is included in flux-system kustomization.yaml
# This prevents accidental removal that would break the deployment pipeline

KUSTOMIZATION_FILE="clusters/pixelkube/flux-system/flux-system/kustomization.yaml"
REQUIRED_RESOURCE="pixelated-kustomization.yaml"

echo "🔍 Validating Flux Kustomization configuration..."
echo ""

# Check if kustomization.yaml exists
if [ ! -f "$KUSTOMIZATION_FILE" ]; then
    echo "❌ ERROR: $KUSTOMIZATION_FILE not found!"
    exit 1
fi

# Check if pixelated-kustomization.yaml is in the resources list
if ! grep -q "$REQUIRED_RESOURCE" "$KUSTOMIZATION_FILE"; then
    echo "❌ CRITICAL ERROR: $REQUIRED_RESOURCE is missing from $KUSTOMIZATION_FILE"
    echo ""
    echo "This would cause:"
    echo "  1. Flux to prune the pixelated Kustomization resource"
    echo "  2. The pixelated deployment to be deleted from the cluster"
    echo "  3. All pods to be terminated"
    echo "  4. Application to stop serving traffic"
    echo ""
    echo "Please ensure $REQUIRED_RESOURCE is included in the resources list."
    exit 1
fi

# Verify the file exists
RESOURCE_FILE="clusters/pixelkube/flux-system/flux-system/$REQUIRED_RESOURCE"
if [ ! -f "$RESOURCE_FILE" ]; then
    echo "❌ ERROR: $RESOURCE_FILE not found!"
    echo "The resource is referenced but the file doesn't exist."
    exit 1
fi

echo "✅ Validation passed: $REQUIRED_RESOURCE is correctly included"
exit 0

