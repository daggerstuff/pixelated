#!/bin/bash
# GKE Cluster Debugging Script

echo "🔍 GKE Cluster Diagnostics"
echo "=========================="

# Check cluster connection
echo "📡 Cluster Connection:"
kubectl cluster-info

echo -e "\n🏗️  Deployment Status:"
kubectl get deployments -o wide

echo -e "\n🚀 Pod Status:"
kubectl get pods -l app=pixelated -o wide

echo -e "\n📊 Pod Details:"
kubectl describe pods -l app=pixelated

echo -e "\n🌐 Service Status:"
kubectl get services -o wide

echo -e "\n📋 Service Details:"
kubectl describe service pixelated-service

echo -e "\n📝 Recent Events:"
kubectl get events --sort-by=.metadata.creationTimestamp

echo -e "\n🔧 Node Status:"
kubectl get nodes -o wide

echo -e "\n💾 Resource Usage:"
kubectl top nodes 2>/dev/null || echo "Metrics server not available"
kubectl top pods -l app=pixelated 2>/dev/null || echo "Pod metrics not available"

echo -e "\n📜 Deployment Logs (last 50 lines):"
kubectl logs -l app=pixelated --tail=50

echo -e "\n🔍 Ingress Status:"
kubectl get ingress 2>/dev/null || echo "No ingress found"