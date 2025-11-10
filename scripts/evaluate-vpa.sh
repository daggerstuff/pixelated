#!/bin/bash
# Priority 2.3: Evaluate Vertical Pod Autoscaler (VPA)
# Evaluates VPA feasibility and provides installation guidance

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check kubectl access
check_kubectl() {
    if ! kubectl cluster-info &>/dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    log "Connected to cluster: $(kubectl config current-context)"
}

# Check if VPA is already installed
check_vpa_installed() {
    log "Checking if VPA is already installed..."
    
    if kubectl get namespace vpa-system &>/dev/null; then
        success "VPA namespace exists"
        if kubectl get deployment -n vpa-system &>/dev/null; then
            info "VPA components found:"
            kubectl get deployment -n vpa-system
            return 0
        else
            warning "VPA namespace exists but no deployments found"
            return 1
        fi
    else
        info "VPA is not installed"
        return 1
    fi
}

# Check cluster compatibility
check_cluster_compatibility() {
    log "Checking cluster compatibility with VPA..."
    
    local kubernetes_version=$(kubectl version --short 2>/dev/null | grep "Server Version" | awk '{print $3}' || echo "unknown")
    info "Kubernetes version: $kubernetes_version"
    
    # Check if metrics server is installed (required for VPA)
    if kubectl get deployment metrics-server -n kube-system &>/dev/null; then
        success "Metrics server is installed (required for VPA)"
    else
        warning "Metrics server not found. VPA requires metrics server."
        info "Install metrics server: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
    fi
    
    # Check cluster resources
    local node_count=$(kubectl get nodes --no-headers | wc -l)
    info "Cluster has $node_count nodes"
    
    if [ "$node_count" -lt 2 ]; then
        warning "VPA works best with multiple nodes for pod eviction"
    fi
}

# Analyze workloads for VPA
analyze_workloads() {
    log "Analyzing workloads for VPA suitability..."
    
    echo ""
    info "Workloads that could benefit from VPA:"
    echo ""
    
    # Check deployments without HPA
    info "Deployments without HPA (good VPA candidates):"
    for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
        for deployment in $(kubectl get deployment -n "$ns" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
            # Check if HPA exists
            if ! kubectl get hpa -n "$ns" "$deployment" &>/dev/null; then
                # Check if resources are set
                local resources=$(kubectl get deployment "$deployment" -n "$ns" -o jsonpath='{.spec.template.spec.containers[*].resources.requests.cpu}' 2>/dev/null)
                if [ -z "$resources" ] || [ "$resources" = "<no value>" ]; then
                    echo "  - $ns/$deployment (no resources set - VPA can recommend)"
                else
                    echo "  - $ns/$deployment (resources set - VPA can optimize)"
                fi
            fi
        done
    done
    
    echo ""
    warning "Workloads with HPA (VPA conflict):"
    kubectl get hpa --all-namespaces 2>/dev/null | tail -n +2 | while read -r line; do
        echo "  - $line"
    done || info "  No HPA found (good for VPA)"
    
    echo ""
    info "Note: VPA and HPA cannot be used together on the same workload"
    info "Use VPA for:"
    echo "  - Workloads with variable resource needs"
    echo "  - Workloads without HPA"
    echo "  - Optimizing resource requests based on historical usage"
}

# VPA installation guide
show_installation_guide() {
    log "VPA Installation Guide"
    echo ""
    info "VPA can be installed using one of these methods:"
    echo ""
    echo "Method 1: Using the official VPA repository"
    echo "  git clone https://github.com/kubernetes/autoscaler.git"
    echo "  cd autoscaler/vertical-pod-autoscaler"
    echo "  ./hack/vpa-up.sh"
    echo ""
    echo "Method 2: Using Helm (recommended)"
    echo "  helm repo add fairwinds-stable https://charts.fairwinds.com/stable"
    echo "  helm repo update"
    echo "  helm install vpa fairwinds-stable/vpa --namespace vpa-system --create-namespace"
    echo ""
    echo "Method 3: Manual installation"
    echo "  kubectl apply -f https://github.com/kubernetes/autoscaler/releases/download/vertical-pod-autoscaler-0.14.0/vpa-release.yaml"
    echo ""
    warning "Important considerations:"
    echo "  1. VPA requires metrics server"
    echo "  2. VPA and HPA cannot be used together"
    echo "  3. VPA can cause pod evictions during updates"
    echo "  4. Start with 'Off' or 'Initial' update mode for safety"
    echo "  5. Monitor VPA recommendations before enabling 'Auto' mode"
}

# VPA usage examples
show_usage_examples() {
    log "VPA Usage Examples"
    echo ""
    info "Example 1: VPA in 'Off' mode (recommendations only)"
    cat << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: pixelated-vpa
  namespace: pixelated
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pixelated
  updatePolicy:
    updateMode: "Off"  # Only provides recommendations, doesn't auto-update
  resourcePolicy:
    containerPolicies:
    - containerName: pixelated
      minAllowed:
        cpu: 50m
        memory: 128Mi
      maxAllowed:
        cpu: 1000m
        memory: 2Gi
EOF
    echo ""
    info "Example 2: VPA in 'Initial' mode (sets resources on pod creation)"
    cat << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: pixelated-vpa
  namespace: pixelated
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pixelated
  updatePolicy:
    updateMode: "Initial"  # Sets resources when pod is created
  resourcePolicy:
    containerPolicies:
    - containerName: pixelated
      minAllowed:
        cpu: 50m
        memory: 128Mi
      maxAllowed:
        cpu: 1000m
        memory: 2Gi
EOF
    echo ""
    warning "Example 3: VPA in 'Auto' mode (automatic updates - use with caution)"
    cat << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: pixelated-vpa
  namespace: pixelated
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pixelated
  updatePolicy:
    updateMode: "Auto"  # Automatically updates resources (can cause pod evictions)
  resourcePolicy:
    containerPolicies:
    - containerName: pixelated
      minAllowed:
        cpu: 50m
        memory: 128Mi
      maxAllowed:
        cpu: 1000m
        memory: 2Gi
EOF
}

# Risk assessment
assess_risks() {
    log "VPA Risk Assessment"
    echo ""
    warning "Risks and Considerations:"
    echo ""
    echo "1. Pod Evictions:"
    echo "   - VPA in 'Auto' mode can evict pods to apply new resources"
    echo "   - Can cause service disruptions if not configured properly"
    echo "   - Mitigation: Start with 'Off' or 'Initial' mode"
    echo ""
    echo "2. HPA Conflicts:"
    echo "   - VPA and HPA cannot be used on the same workload"
    echo "   - Choose based on scaling needs (horizontal vs vertical)"
    echo "   - Mitigation: Use VPA for resource optimization, HPA for scaling"
    echo ""
    echo "3. Resource Limits:"
    echo "   - VPA can recommend resources outside of node capacity"
    echo "   - Set min/max allowed resources to prevent issues"
    echo "   - Mitigation: Configure resourcePolicy with min/max bounds"
    echo ""
    echo "4. Performance Impact:"
    echo "   - VPA recommender consumes cluster resources"
    echo "   - Requires metrics server and historical data"
    echo "   - Mitigation: Monitor VPA component resource usage"
    echo ""
    info "Recommended Approach:"
    echo "  1. Install VPA in 'Off' mode first"
    echo "  2. Review recommendations for 1-2 weeks"
    echo "  3. Manually apply recommendations for non-critical workloads"
    echo "  4. Gradually enable 'Initial' mode for selected workloads"
    echo "  5. Only use 'Auto' mode for non-production or well-tested workloads"
}

# Main function
main() {
    log "🔍 Evaluating Vertical Pod Autoscaler (VPA)"
    echo ""
    
    check_kubectl
    
    if check_vpa_installed; then
        success "VPA is already installed"
        analyze_workloads
    else
        info "VPA is not installed"
        check_cluster_compatibility
        analyze_workloads
        show_installation_guide
        show_usage_examples
        assess_risks
    fi
    
    echo ""
    success "Evaluation completed!"
    log "Next steps:"
    echo "  1. Review workloads that could benefit from VPA"
    echo "  2. Install VPA in 'Off' mode to get recommendations"
    echo "  3. Review recommendations for 1-2 weeks"
    echo "  4. Gradually enable VPA for selected workloads"
    echo "  5. Monitor VPA behavior and adjust as needed"
}

# Run main
main "$@"

