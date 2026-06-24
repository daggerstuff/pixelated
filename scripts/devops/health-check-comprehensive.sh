#!/bin/bash
set -euo pipefail

echo "🏥 Running comprehensive health checks..."

# Configuration
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-10}
MAX_RETRIES=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
RETRY_COUNT=0
SUCCESS_THRESHOLD=3
SUCCESS_COUNT=0

# Health check functions
check_pod_health() {
    echo "🔍 Checking pod health..."
    
    # Get pod status
    READY_PODS=$(kubectl get pods -l app=pixelated -o json | jq '[.items[] | select(.status.phase == "Running" and (.status.containerStatuses[]?.ready // false))] | length')
    TOTAL_PODS=$(kubectl get pods -l app=pixelated -o json | jq '.items | length')
    
    echo "📊 Pod status: $READY_PODS/$TOTAL_PODS ready"
    
    if [ "$READY_PODS" -lt "$TOTAL_PODS" ]; then
        echo "⚠️ Some pods are not ready"
        kubectl describe pods -l app=pixelated | grep -A 10 -B 5 "Warning\|Error" || true
        return 1
    fi
    
    if [ "$READY_PODS" -eq 0 ]; then
        echo "❌ No healthy pods found"
        return 1
    fi
    
    return 0
}

check_deployment_health() {
    echo "🔍 Checking deployment health..."
    
    # Check deployment status
    if ! kubectl get deployment $DEPLOYMENT_NAME >/dev/null 2>&1; then
        echo "❌ Deployment not found"
        return 1
    fi
    
    # Get deployment conditions
    AVAILABLE=$(kubectl get deployment $DEPLOYMENT_NAME -o json | jq '.status.conditions[] | select(.type == "Available") | .status')
    PROGRESSING=$(kubectl get deployment $DEPLOYMENT_NAME -o json | jq '.status.conditions[] | select(.type == "Progressing") | .status')
    
    if [ "$AVAILABLE" != "True" ]; then
        echo "❌ Deployment not available"
        return 1
    fi
    
    if [ "$PROGRESSING" != "True" ]; then
        echo "⚠️ Deployment still progressing"
        return 1
    fi
    
    echo "✅ Deployment health checks passed"
    return 0
}

check_service_health() {
    echo "🔍 Checking service health..."
    
    # Check service exists
    if ! kubectl get service $SERVICE_NAME >/dev/null 2>&1; then
        echo "❌ Service not found"
        return 1
    fi
    
    # Get service endpoints
    ENDPOINTS=$(kubectl get endpoints $SERVICE_NAME -o json | jq '.subsets[]?.addresses | length')
    
    if [ "$ENDPOINTS" -eq 0 ]; then
        echo "❌ No healthy endpoints for service"
        return 1
    fi
    
    echo "✅ Service has $ENDPOINTS healthy endpoints"
    return 0
}

check_application_health() {
    echo "🔍 Checking application health via HTTP..."
    
    # Try to access the health endpoint
    SERVICE_IP=$(kubectl get service $SERVICE_NAME -o json | jq -r '.spec.clusterIP')
    
    # Test internal connectivity
    if kubectl run health-check --image=curlimages/curl:latest --rm -i --restart=Never -- \
       curl -f --connect-timeout 10 --max-time 30 "http://$SERVICE_IP:80/api/health" >/dev/null 2>&1; then
        echo "✅ Application health check passed"
        return 0
    else
        echo "❌ Application health check failed"
        return 1
    fi
}

check_resource_usage() {
    echo "🔍 Checking resource usage..."
    
    # Check if pods are using excessive resources
    HIGH_USAGE_PODS=$(kubectl top pods -l app=pixelated --no-headers | \
        awk '{if ($3 > 80 || $2 > 80) print $1}' | wc -l)
    
    if [ "$HIGH_USAGE_PODS" -gt 0 ]; then
        echo "⚠️ $HIGH_USAGE_PODS pods have high resource usage"
        kubectl top pods -l app=pixelated
        return 1
    fi
    
    echo "✅ Resource usage within acceptable limits"
    return 0
}

check_external_connectivity() {
    echo "🔍 Checking external connectivity..."
    
    # Only check if external URL is configured
    if [ -n "${ENVIRONMENT_URL:-}" ]; then
        if curl -f --connect-timeout 10 --max-time 30 "${ENVIRONMENT_URL}/api/health" >/dev/null 2>&1; then
            echo "✅ External connectivity check passed"
            return 0
        else
            echo "⚠️ External connectivity check failed"
            return 1
        fi
    else
        echo "ℹ️ External URL not configured, skipping external check"
        return 0
    fi
}

# Main health check loop
echo "🔄 Starting health check validation (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "🔍 Health check attempt $((RETRY_COUNT + 1))/$MAX_RETRIES"
    
    # Run all health checks
    FAILED_CHECKS=0
    
    check_pod_health || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_deployment_health || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_service_health || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_application_health || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_resource_usage || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_external_connectivity || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "✅ All health checks passed (consecutive successes: $SUCCESS_COUNT/$SUCCESS_THRESHOLD)"
        
        if [ $SUCCESS_COUNT -ge $SUCCESS_THRESHOLD ]; then
            echo "🎉 Health validation completed successfully!"
            return 0
        fi
    else
        SUCCESS_COUNT=0
        echo "❌ $FAILED_CHECKS health checks failed"
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "⏳ Waiting ${HEALTH_CHECK_INTERVAL}s before next attempt..."
        sleep $HEALTH_CHECK_INTERVAL
    fi
done

echo "❌ Health validation failed after $MAX_RETRIES attempts"
echo "📊 Final status:"
kubectl get all -l app=pixelated
kubectl get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp | tail -10

return 1