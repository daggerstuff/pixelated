#!/bin/bash
set -e

# Civo Migration Script for Pixelated Empathy
# This script migrates the application from GKE to Civo

echo "🚀 Starting Civo Migration Process..."

# Configuration
NAMESPACE="pixelated"
CIVO_CLUSTER="pixelated-empathy-civo"
REGION="nyc1"

# Ensure we're using the Civo cluster
echo "🔧 Switching to Civo cluster..."
kubectl config use-context $CIVO_CLUSTER

# Create namespace
echo "📦 Creating namespace..."
kubectl apply -f namespace.yaml

# Create placeholder config and secrets (update with real values)
echo "🔐 Creating placeholder configurations..."
kubectl create configmap pixelated-config \
  --from-literal=NODE_ENV=production \
  --from-literal=HOST=0.0.0.0 \
  --from-literal=PORT=4321 \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic pixelated-secrets \
  --from-literal=placeholder=placeholder \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Build and push image to Civo registry
echo "🏗️ Building and pushing image to Civo registry..."
# Note: This will be updated with actual image building steps

# Deploy application
echo "🚀 Deploying application to Civo..."
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/pixelated -n $NAMESPACE

# Get external IP
echo "🌐 Getting external IP..."
kubectl get service pixelated-service -n $NAMESPACE

echo "✅ Migration to Civo completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update DNS records to point to the new Civo load balancer IP"
echo "2. Test application functionality"
echo "3. Decommission GKE cluster"
echo "4. Update documentation"