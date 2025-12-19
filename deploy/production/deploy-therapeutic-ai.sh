#!/bin/bash
set -euo pipefail

# Production Deployment Script for Therapeutic AI System
# Deploys all 7 microservices with monitoring and safety systems

echo "🚀 DEPLOYING THERAPEUTIC AI TO PRODUCTION 🚀"
echo "============================================"

# Configuration
NAMESPACE="therapeutic-ai-prod"
RELEASE_NAME="therapeutic-ai"
REGISTRY="ghcr.io/pixelated"
IMAGE_TAG="${IMAGE_TAG:-latest}"
KUBECTL_CONTEXT="${KUBECTL_CONTEXT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verify prerequisites
verify_prerequisites() {
    log_info "Verifying prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm not found. Please install Helm 3.x."
        exit 1
    fi
    
    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot access Kubernetes cluster. Check your kubeconfig."
        exit 1
    fi
    
    # Check if context exists
    if ! kubectl config get-contexts "${KUBECTL_CONTEXT}" &> /dev/null; then
        log_warning "Context '${KUBECTL_CONTEXT}' not found. Using current context."
        KUBECTL_CONTEXT=$(kubectl config current-context)
    fi
    
    log_success "Prerequisites verified"
}

# Create namespace and setup RBAC
setup_namespace() {
    log_info "Setting up namespace and RBAC..."
    
    # Create namespace
    kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
    
    # Label namespace for monitoring
    kubectl label namespace "${NAMESPACE}" name="${NAMESPACE}" --overwrite
    kubectl label namespace "${NAMESPACE}" component=therapeutic-ai --overwrite
    
    # Create service account
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: therapeutic-ai-sa
  namespace: ${NAMESPACE}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: therapeutic-ai-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: therapeutic-ai-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: therapeutic-ai-role
subjects:
- kind: ServiceAccount
  name: therapeutic-ai-sa
  namespace: ${NAMESPACE}
EOF
    
    log_success "Namespace and RBAC configured"
}

# Deploy secrets and configmaps
deploy_config() {
    log_info "Deploying configuration and secrets..."
    
    # Create configmap for psychology knowledge base
    kubectl create configmap psychology-knowledge-base \
        --from-file=ai/pixel/knowledge/enhanced_psychology_knowledge_base.json \
        --namespace="${NAMESPACE}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Create secrets (in production, these would come from secret management)
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: therapeutic-ai-secrets
  namespace: ${NAMESPACE}
type: Opaque
data:
  database-url: $(echo -n "postgresql://therapeutic_ai:secure_password@postgres:5432/therapeutic_ai" | base64)
  redis-url: $(echo -n "redis://redis:6379/0" | base64)
  jwt-secret: $(echo -n "super-secure-jwt-secret-key" | base64)
  sentry-dsn: $(echo -n "https://your-sentry-dsn@sentry.io/project-id" | base64)
EOF
    
    log_success "Configuration deployed"
}

# Deploy individual services
deploy_service() {
    local service_name=$1
    local replicas=$2
    local cpu_request=$3
    local memory_request=$4
    local cpu_limit=$5
    local memory_limit=$6
    local health_path=$7
    
    log_info "Deploying ${service_name}..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service_name}
  namespace: ${NAMESPACE}
  labels:
    app: ${service_name}
    component: therapeutic-ai
    tier: tier2
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${service_name}
  template:
    metadata:
      labels:
        app: ${service_name}
        component: therapeutic-ai
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: therapeutic-ai-sa
      containers:
      - name: ${service_name}
        image: ${REGISTRY}/${service_name}:${IMAGE_TAG}
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        resources:
          requests:
            cpu: ${cpu_request}
            memory: ${memory_request}
          limits:
            cpu: ${cpu_limit}
            memory: ${memory_limit}
        env:
        - name: PORT
          value: "8080"
        - name: METRICS_PORT
          value: "9090"
        - name: SENTRY_RELEASE
          value: "${IMAGE_TAG}"
        - name: NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        envFrom:
        - secretRef:
            name: therapeutic-ai-secrets
        volumeMounts:
        - name: knowledge-base
          mountPath: /data
          readOnly: true
        livenessProbe:
          httpGet:
            path: ${health_path}
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: ${health_path}
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
      volumes:
      - name: knowledge-base
        configMap:
          name: psychology-knowledge-base
      securityContext:
        fsGroup: 1000
---
apiVersion: v1
kind: Service
metadata:
  name: ${service_name}
  namespace: ${NAMESPACE}
  labels:
    app: ${service_name}
    component: therapeutic-ai
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
spec:
  selector:
    app: ${service_name}
  ports:
  - port: 80
    targetPort: 8080
    name: http
  - port: 9090
    targetPort: 9090
    name: metrics
  type: ClusterIP
EOF
    
    log_success "${service_name} deployed"
}

# Deploy all microservices
deploy_microservices() {
    log_info "Deploying all therapeutic AI microservices..."
    
    # API Gateway
    deploy_service "therapeutic-ai-gateway" 3 "500m" "1Gi" "1000m" "2Gi" "/health"
    
    # Knowledge Service
    deploy_service "therapeutic-knowledge-service" 2 "1000m" "2Gi" "2000m" "4Gi" "/health"
    
    # Conversation Service
    deploy_service "therapeutic-conversation-service" 4 "750m" "1.5Gi" "1500m" "3Gi" "/health"
    
    # Expert Service
    deploy_service "therapeutic-expert-service" 3 "500m" "1Gi" "1000m" "2Gi" "/health"
    
    # Safety Service (Critical)
    deploy_service "therapeutic-safety-service" 2 "500m" "1Gi" "1000m" "2Gi" "/health"
    
    # Session Service
    deploy_service "therapeutic-session-service" 3 "500m" "1Gi" "1000m" "2Gi" "/health"
    
    # Monitoring Service
    deploy_service "therapeutic-monitoring-service" 2 "250m" "512Mi" "500m" "1Gi" "/metrics"
    
    log_success "All microservices deployed"
}

# Deploy ingress
deploy_ingress() {
    log_info "Deploying ingress and load balancer..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: therapeutic-ai-ingress
  namespace: ${NAMESPACE}
  annotations:
    kubernetes.io/ingress.class: traefik
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.middlewares: "default-auth@kubernetescrd"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.therapeutic-ai.pixelated.ai
    secretName: therapeutic-ai-tls
  rules:
  - host: api.therapeutic-ai.pixelated.ai
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: therapeutic-ai-gateway
            port:
              number: 80
EOF
    
    log_success "Ingress configured"
}

# Deploy monitoring
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # ServiceMonitor for Prometheus
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: therapeutic-ai-metrics
  namespace: ${NAMESPACE}
  labels:
    app: therapeutic-ai
spec:
  selector:
    matchLabels:
      component: therapeutic-ai
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
EOF
    
    # PrometheusRule for alerts
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: therapeutic-ai-alerts
  namespace: ${NAMESPACE}
spec:
  groups:
  - name: therapeutic-ai.rules
    rules:
    - alert: TherapeuticAIHighLatency
      expr: histogram_quantile(0.95, therapeutic_response_latency_bucket) > 2000
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High response latency detected"
        description: "95th percentile latency is above 2000ms"
    
    - alert: TherapeuticAICrisisSpike
      expr: rate(crisis_detection_rate[5m]) > 0.1
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Crisis detection spike"
        description: "Unusual spike in crisis detections"
    
    - alert: TherapeuticAIServiceDown
      expr: up{job="therapeutic-ai-metrics"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Therapeutic AI service is down"
        description: "Service {{ $labels.instance }} is not responding"
EOF
    
    log_success "Monitoring configured"
}

# Wait for rollout
wait_for_rollout() {
    log_info "Waiting for all deployments to be ready..."
    
    local services=(
        "therapeutic-ai-gateway"
        "therapeutic-knowledge-service"
        "therapeutic-conversation-service"
        "therapeutic-expert-service"
        "therapeutic-safety-service"
        "therapeutic-session-service"
        "therapeutic-monitoring-service"
    )
    
    for service in "${services[@]}"; do
        log_info "Waiting for ${service}..."
        kubectl rollout status deployment/"${service}" -n "${NAMESPACE}" --timeout=300s
    done
    
    log_success "All deployments ready"
}

# Health check
health_check() {
    log_info "Performing health checks..."
    
    # Check pod status
    log_info "Pod status:"
    kubectl get pods -n "${NAMESPACE}" -o wide
    
    # Check service endpoints
    log_info "Service endpoints:"
    kubectl get svc -n "${NAMESPACE}"
    
    # Check ingress
    log_info "Ingress status:"
    kubectl get ingress -n "${NAMESPACE}"
    
    # Test internal connectivity
    log_info "Testing internal service connectivity..."
    kubectl run health-check-pod \
        --image=curlimages/curl:latest \
        --rm -i --restart=Never \
        --namespace="${NAMESPACE}" \
        -- curl -s -o /dev/null -w "%{http_code}" \
        http://therapeutic-ai-gateway/health || true
    
    log_success "Health checks completed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary resources..."
    kubectl delete pod health-check-pod -n "${NAMESPACE}" --ignore-not-found=true
}

# Main deployment function
main() {
    log_info "Starting Therapeutic AI production deployment..."
    log_info "Namespace: ${NAMESPACE}"
    log_info "Release: ${RELEASE_NAME}"
    log_info "Registry: ${REGISTRY}"
    log_info "Image Tag: ${IMAGE_TAG}"
    log_info "Context: ${KUBECTL_CONTEXT}"
    echo ""
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute deployment steps
    verify_prerequisites
    setup_namespace
    deploy_config
    deploy_microservices
    deploy_ingress
    deploy_monitoring
    wait_for_rollout
    health_check
    
    echo ""
    log_success "🎉 THERAPEUTIC AI PRODUCTION DEPLOYMENT COMPLETE! 🎉"
    echo ""
    log_info "Access your deployment:"
    log_info "• API Endpoint: https://api.therapeutic-ai.pixelated.ai"
    log_info "• Monitoring: kubectl port-forward svc/prometheus 9090:9090 -n monitoring"
    log_info "• Logs: kubectl logs -l component=therapeutic-ai -n ${NAMESPACE} -f"
    echo ""
    log_info "Deployment Summary:"
    kubectl get all -n "${NAMESPACE}"
}

# Execute main function
main "$@"