#!/bin/bash
# Priority 2.3: Install Vertical Pod Autoscaler (VPA)
# Installs VPA and configures it for selected workloads

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

# Check if metrics server is installed
check_metrics_server() {
    log "Checking if metrics server is installed..."
    if kubectl get deployment metrics-server -n kube-system &>/dev/null; then
        success "Metrics server is installed"
    else
        error "Metrics server is required for VPA. Please install it first."
    fi
}

# Check if VPA is already installed
check_vpa_installed() {
    log "Checking if VPA is already installed..."
    if kubectl get namespace vpa-system &>/dev/null 2>&1; then
        # Check if there are any deployments in vpa-system
        local deployments=$(kubectl get deployment -n vpa-system --no-headers 2>/dev/null | wc -l)
        if [ "$deployments" -gt 0 ]; then
            warning "VPA appears to be already installed"
            kubectl get deployment -n vpa-system
            return 0
        else
            info "VPA namespace exists but no deployments found. Proceeding with installation..."
            return 1
        fi
    fi
    return 1
}

# Install VPA using official method (clone repository and use correct branch)
install_vpa_official() {
    log "Installing VPA using official method (cloning repository)..."
    
    # Create temporary directory
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT
    
    log "Cloning VPA repository..."
    if ! git clone https://github.com/kubernetes/autoscaler.git "$temp_dir/autoscaler" 2>/dev/null; then
        error "Failed to clone VPA repository. Please ensure git is installed and you have network access."
    fi
    
    cd "$temp_dir/autoscaler/vertical-pod-autoscaler" || error "Failed to change to VPA directory"
    
    # Use master branch which should have working installation scripts
    log "Checking out master branch..."
    git checkout master 2>/dev/null || git checkout main 2>/dev/null || warning "Could not checkout master/main branch, using current branch"
    
    # Install CRDs first
    log "Installing VPA CRDs..."
    if [ -f "./deploy/vpa-release.yaml" ]; then
        kubectl apply -f ./deploy/vpa-release.yaml || error "Failed to apply VPA release YAML"
    elif [ -d "./deploy" ]; then
        # Apply CRDs first, then other components
        if [ -f "./deploy/crds/vpa-crd.yaml" ] || [ -f "./deploy/crds/vpa-v1-crd.yaml" ]; then
            kubectl apply -f ./deploy/crds/ || warning "Could not apply CRDs from deploy/crds/"
        fi
        # Apply other components
        kubectl apply -f ./deploy/ || error "Failed to apply VPA deploy manifests"
    else
        # Try the hack script as fallback
        log "Trying VPA installation script..."
        if [ -f "./hack/vpa-up.sh" ]; then
            chmod +x ./hack/vpa-up.sh
            # Set environment variable to skip version check if needed
            export VPA_VERSION="" || true
            ./hack/vpa-up.sh 2>&1 | head -50 || {
                warning "VPA installation script had issues, trying manual installation..."
                # Try to apply manifests directly
                find ./deploy -name "*.yaml" -type f | head -20 | while read -r file; do
                    kubectl apply -f "$file" 2>/dev/null || true
                done
            }
        else
            error "VPA installation files not found"
        fi
    fi
    
    success "VPA components installed"
    cd - > /dev/null
}

# Install VPA using Helm (alternative method)
install_vpa_helm() {
    log "Installing VPA using Helm..."
    
    # Check if Helm is installed
    if ! command -v helm &>/dev/null; then
        warning "Helm is not installed. Installing VPA using official method instead..."
        install_vpa_official
        return
    fi
    
    # Add Helm repository
    log "Adding Fairwinds Helm repository..."
    helm repo add fairwinds-stable https://charts.fairwinds.com/stable || warning "Repository may already exist"
    helm repo update
    
    # Install VPA
    log "Installing VPA via Helm..."
    helm upgrade --install vpa fairwinds-stable/vpa \
        --namespace vpa-system \
        --create-namespace \
        --set recommender.resources.requests.cpu=100m \
        --set recommender.resources.requests.memory=256Mi \
        --set recommender.resources.limits.cpu=500m \
        --set recommender.resources.limits.memory=512Mi \
        --set updater.resources.requests.cpu=100m \
        --set updater.resources.requests.memory=256Mi \
        --set updater.resources.limits.cpu=500m \
        --set updater.resources.limits.memory=512Mi \
        --set admissionController.resources.requests.cpu=100m \
        --set admissionController.resources.requests.memory=128Mi \
        --set admissionController.resources.limits.cpu=200m \
        --set admissionController.resources.limits.memory=256Mi \
        || error "Failed to install VPA via Helm"
    
    success "VPA installed via Helm"
}

# Wait for VPA to be ready
wait_for_vpa() {
    log "Waiting for VPA components to be ready..."
    
    # Wait for deployments
    local max_wait=300
    local waited=0
    local interval=10
    
    while [ $waited -lt $max_wait ]; do
        local ready=$(kubectl get deployment -n vpa-system -o jsonpath='{.items[*].status.readyReplicas}' 2>/dev/null | tr ' ' '\n' | awk '{sum+=$1} END {print sum+0}')
        local desired=$(kubectl get deployment -n vpa-system -o jsonpath='{.items[*].spec.replicas}' 2>/dev/null | tr ' ' '\n' | awk '{sum+=$1} END {print sum+0}')
        
        if [ "$ready" -eq "$desired" ] && [ "$desired" -gt 0 ]; then
            success "VPA components are ready"
            return 0
        fi
        
        log "Waiting for VPA components... ($waited/$max_wait seconds)"
        sleep $interval
        waited=$((waited + interval))
    done
    
    warning "VPA components may not be fully ready. Please check manually."
    return 1
}

# Verify VPA installation
verify_vpa() {
    log "Verifying VPA installation..."
    
    # Check namespace
    if kubectl get namespace vpa-system &>/dev/null; then
        success "VPA namespace exists"
    else
        error "VPA namespace not found"
    fi
    
    # Check deployments
    log "VPA deployments:"
    kubectl get deployment -n vpa-system || warning "No deployments found"
    
    # Check pods
    log "VPA pods:"
    kubectl get pods -n vpa-system || warning "No pods found"
    
    # Check CRDs
    log "Checking VPA CRDs..."
    if kubectl get crd verticalpodautoscalers.autoscaling.k8s.io &>/dev/null; then
        success "VPA CRD is installed"
    else
        error "VPA CRD not found"
    fi
    
    # Check if VPA recommender is working
    log "Checking VPA recommender..."
    if kubectl get deployment vpa-recommender -n vpa-system &>/dev/null || \
       kubectl get deployment recommender -n vpa-system &>/dev/null; then
        success "VPA recommender is installed"
    else
        warning "VPA recommender not found. VPA may not be fully installed."
    fi
}

# Create VPA configurations for selected workloads
create_vpa_configs() {
    log "Creating VPA configurations for selected workloads..."
    
    local vpa_dir="manifests/vpa"
    mkdir -p "$vpa_dir"
    
    # Cert-Manager Controller VPA
    log "Creating VPA for cert-manager controller..."
    cat > "${vpa_dir}/cert-manager-vpa.yaml" << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: cert-manager-vpa
  namespace: cert-manager
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cert-manager
  updatePolicy:
    updateMode: "Off"  # Only recommendations, no auto-updates
  resourcePolicy:
    containerPolicies:
    - containerName: cert-manager-controller
      minAllowed:
        cpu: 50m
        memory: 64Mi
      maxAllowed:
        cpu: 500m
        memory: 512Mi
EOF
    
    # Cert-Manager CA Injector VPA
    log "Creating VPA for cert-manager cainjector..."
    cat > "${vpa_dir}/cert-manager-cainjector-vpa.yaml" << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: cert-manager-cainjector-vpa
  namespace: cert-manager
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cert-manager-cainjector
  updatePolicy:
    updateMode: "Off"  # Only recommendations, no auto-updates
  resourcePolicy:
    containerPolicies:
    - containerName: cert-manager-cainjector
      minAllowed:
        cpu: 50m
        memory: 64Mi
      maxAllowed:
        cpu: 500m
        memory: 512Mi
EOF
    
    # Cert-Manager Webhook VPA
    log "Creating VPA for cert-manager webhook..."
    cat > "${vpa_dir}/cert-manager-webhook-vpa.yaml" << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: cert-manager-webhook-vpa
  namespace: cert-manager
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cert-manager-webhook
  updatePolicy:
    updateMode: "Off"  # Only recommendations, no auto-updates
  resourcePolicy:
    containerPolicies:
    - containerName: cert-manager-webhook
      minAllowed:
        cpu: 50m
        memory: 64Mi
      maxAllowed:
        cpu: 500m
        memory: 512Mi
EOF
    
    # Metoro Exporter VPA
    log "Creating VPA for metoro-exporter..."
    cat > "${vpa_dir}/metoro-exporter-vpa.yaml" << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: metoro-exporter-vpa
  namespace: metoro
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: metoro-exporter
  updatePolicy:
    updateMode: "Off"  # Only recommendations, no auto-updates
  resourcePolicy:
    containerPolicies:
    - containerName: metoro-exporter
      minAllowed:
        cpu: 50m
        memory: 128Mi
      maxAllowed:
        cpu: 500m
        memory: 1Gi
EOF
    
    success "VPA configurations created in ${vpa_dir}/"
    info "VPA configurations are in 'Off' mode (recommendations only)"
    info "Review recommendations for 1-2 weeks before enabling 'Initial' or 'Auto' mode"
}

# Apply VPA configurations
apply_vpa_configs() {
    log "Applying VPA configurations..."
    
    local vpa_dir="manifests/vpa"
    
    if [ ! -d "$vpa_dir" ]; then
        warning "VPA configurations directory not found. Creating configurations first..."
        create_vpa_configs
    fi
    
    # Apply all VPA configurations
    for vpa_file in "${vpa_dir}"/*-vpa.yaml; do
        if [ -f "$vpa_file" ]; then
            log "Applying $(basename "$vpa_file")..."
            kubectl apply -f "$vpa_file" || warning "Failed to apply $vpa_file"
        fi
    done
    
    success "VPA configurations applied"
}

# Show VPA status
show_vpa_status() {
    log "VPA Status:"
    echo ""
    
    info "VPA Components:"
    kubectl get deployment -n vpa-system
    echo ""
    
    info "VPA Pods:"
    kubectl get pods -n vpa-system
    echo ""
    
    info "VPA Configurations:"
    kubectl get vpa --all-namespaces 2>/dev/null || warning "No VPA configurations found"
    echo ""
    
    info "VPA Recommendations (will appear after VPA collects data):"
    kubectl get vpa --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.status.recommendation.containerRecommendations[*].target}{"\n"}{end}' 2>/dev/null || info "Recommendations will appear after VPA collects usage data (usually 24-48 hours)"
}

# Main function
main() {
    local install_method="${1:-official}"
    
    log "🚀 Installing Vertical Pod Autoscaler (VPA)"
    echo ""
    
    check_kubectl
    check_metrics_server
    
    if check_vpa_installed; then
        warning "VPA is already installed. Skipping installation and proceeding with configuration..."
    else
        # Install VPA
        case "$install_method" in
            helm)
                install_vpa_helm
                ;;
            official|*)
                install_vpa_official
                ;;
        esac
        
        # Wait for VPA to be ready
        wait_for_vpa
    fi
    
    # Verify installation
    verify_vpa
    
    # Create and apply VPA configurations
    create_vpa_configs
    apply_vpa_configs
    
    # Show status
    show_vpa_status
    
    echo ""
    success "VPA installation completed!"
    log "Next steps:"
    echo "  1. Monitor VPA recommendations: kubectl get vpa --all-namespaces"
    echo "  2. Review recommendations after 24-48 hours"
    echo "  3. Check recommendations: kubectl describe vpa <vpa-name> -n <namespace>"
    echo "  4. After reviewing, consider enabling 'Initial' mode for selected workloads"
    echo "  5. Monitor VPA behavior and adjust as needed"
    echo ""
    warning "VPA is currently in 'Off' mode (recommendations only)"
    info "This is safe for production. Review recommendations before enabling auto-updates."
}

# Run main
main "$@"

