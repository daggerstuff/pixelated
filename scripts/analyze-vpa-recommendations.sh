#!/bin/bash
# Analyze VPA Recommendations and Compare with Current Resources
# Provides optimization suggestions based on VPA data

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

# Convert memory bytes to human readable
bytes_to_human() {
    local bytes=$1
    if [ -z "$bytes" ] || [ "$bytes" = "null" ]; then
        echo "N/A"
        return
    fi
    
    # If it's already in Mi/Gi format, return as is
    if echo "$bytes" | grep -qE "[MG]i$"; then
        echo "$bytes"
        return
    fi
    
    # Convert bytes to Mi
    local mi=$((bytes / 1024 / 1024))
    if [ $mi -lt 1024 ]; then
        echo "${mi}Mi"
    else
        local gi=$((mi / 1024))
        echo "${gi}Gi"
    fi
}

# Analyze VPA recommendations
analyze_vpa_recommendations() {
    log "Analyzing VPA Recommendations..."
    echo ""
    
    # Get all VPAs
    local vpas=$(kubectl get vpa --all-namespaces -o json 2>/dev/null)
    
    if [ -z "$vpas" ] || [ "$vpas" = "null" ]; then
        warning "No VPA resources found"
        return 1
    fi
    
    echo "VPA Recommendation Analysis"
    echo "============================"
    echo ""
    
    # Process each VPA
    echo "$vpas" | jq -r '.items[] | "\(.metadata.namespace)|\(.metadata.name)|\(.spec.targetRef.kind)|\(.spec.targetRef.name)"' | while IFS='|' read -r namespace vpa_name kind target_name; do
        echo "Workload: $namespace/$target_name ($vpa_name)"
        echo "----------------------------------------"
        
        # Get VPA details
        local vpa_json=$(kubectl get vpa "$vpa_name" -n "$namespace" -o json 2>/dev/null)
        
        if [ -z "$vpa_json" ]; then
            warning "  Could not retrieve VPA details"
            echo ""
            continue
        fi
        
        # Get current resources
        local current_cpu=""
        local current_memory=""
        if [ "$kind" = "Deployment" ]; then
            local deployment_json=$(kubectl get deployment "$target_name" -n "$namespace" -o json 2>/dev/null)
            if [ -n "$deployment_json" ]; then
                current_cpu=$(echo "$deployment_json" | jq -r '.spec.template.spec.containers[0].resources.requests.cpu // "N/A"')
                current_memory=$(echo "$deployment_json" | jq -r '.spec.template.spec.containers[0].resources.requests.memory // "N/A"')
            fi
        fi
        
        # Get VPA recommendations
        local target_cpu=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].target.cpu // "N/A"')
        local target_memory=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].target.memory // "N/A"')
        local lower_cpu=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].lowerBound.cpu // "N/A"')
        local lower_memory=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].lowerBound.memory // "N/A"')
        local upper_cpu=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].upperBound.cpu // "N/A"')
        local upper_memory=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].upperBound.memory // "N/A"')
        local uncapped_cpu=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].uncappedTarget.cpu // "N/A"')
        local uncapped_memory=$(echo "$vpa_json" | jq -r '.status.recommendation.containerRecommendations[0].uncappedTarget.memory // "N/A"')
        
        # Convert memory to human readable
        target_memory=$(bytes_to_human "$target_memory")
        lower_memory=$(bytes_to_human "$lower_memory")
        upper_memory=$(bytes_to_human "$upper_memory")
        uncapped_memory=$(bytes_to_human "$uncapped_memory")
        
        # Display current resources
        echo "Current Resources:"
        echo "  CPU:    $current_cpu"
        echo "  Memory: $current_memory"
        echo ""
        
        # Display VPA recommendations
        if [ "$target_cpu" != "N/A" ] && [ "$target_cpu" != "null" ]; then
            echo "VPA Recommendations:"
            echo "  Target CPU:    $target_cpu (recommended)"
            echo "  Target Memory: $target_memory (recommended)"
            echo "  Lower Bound:   $lower_cpu CPU, $lower_memory memory (minimum safe)"
            echo "  Upper Bound:   $upper_cpu CPU, $upper_memory memory (maximum safe)"
            if [ "$uncapped_cpu" != "N/A" ] && [ "$uncapped_cpu" != "null" ]; then
                echo "  Uncapped:      $uncapped_cpu CPU, $uncapped_memory memory (ideal without constraints)"
            fi
            echo ""
            
            # Compare and suggest optimizations
            echo "Optimization Suggestions:"
            if [ "$current_cpu" != "N/A" ] && [ "$target_cpu" != "N/A" ]; then
                # Compare CPU (simple string comparison for now)
                if [ "$current_cpu" != "$target_cpu" ]; then
                    info "  CPU: Consider updating from $current_cpu to $target_cpu"
                else
                    success "  CPU: Current request ($current_cpu) matches VPA recommendation"
                fi
            fi
            
            if [ "$current_memory" != "N/A" ] && [ "$target_memory" != "N/A" ]; then
                # Compare Memory (simple string comparison for now)
                if [ "$current_memory" != "$target_memory" ]; then
                    info "  Memory: Consider updating from $current_memory to $target_memory"
                else
                    success "  Memory: Current request ($current_memory) matches VPA recommendation"
                fi
            fi
            
            # Check if uncapped is significantly lower
            if [ "$uncapped_cpu" != "N/A" ] && [ "$uncapped_cpu" != "null" ] && [ "$target_cpu" != "N/A" ]; then
                # Extract numeric values for comparison (rough estimate)
                local uncapped_num=$(echo "$uncapped_cpu" | sed 's/m$//')
                local target_num=$(echo "$target_cpu" | sed 's/m$//')
                if [ -n "$uncapped_num" ] && [ -n "$target_num" ] && [ "$uncapped_num" -lt "$target_num" ]; then
                    local diff=$((target_num - uncapped_num))
                    if [ $diff -gt 10 ]; then  # More than 10m difference
                        warning "  Note: Uncapped target ($uncapped_cpu) is significantly lower than target ($target_cpu)"
                        info "    This suggests resource constraints may be limiting optimization"
                    fi
                fi
            fi
        else
            warning "  No recommendations available yet (VPA needs more data)"
        fi
        
        echo ""
        echo "=========================================="
        echo ""
    done
}

# Get actual usage for comparison
get_actual_usage() {
    log "Current Pod Resource Usage:"
    echo ""
    
    # Get usage for cert-manager pods
    info "Cert-Manager Pods:"
    kubectl top pods -n cert-manager --no-headers 2>/dev/null | while read -r name cpu mem rest; do
        echo "  $name: CPU=$cpu, Memory=$mem"
    done || warning "  Could not retrieve usage data"
    
    echo ""
    
    # Get usage for metoro pods
    info "Metoro Pods:"
    kubectl top pods -n metoro --no-headers 2>/dev/null | while read -r name cpu mem rest; do
        echo "  $name: CPU=$cpu, Memory=$mem"
    done || warning "  Could not retrieve usage data"
    
    echo ""
}

# Generate optimization report
generate_report() {
    log "Generating Optimization Report..."
    
    local report_file="docs/vpa-optimization-report-$(date +%Y%m%d).md"
    
    cat > "$report_file" << 'EOF'
# VPA Optimization Report

**Generated:** $(date +'%Y-%m-%d %H:%M:%S')  
**Cluster:** pixelated-empathy-civo

## Executive Summary

This report analyzes VPA recommendations and provides optimization suggestions for cluster workloads.

## Recommendations by Workload

EOF
    
    info "Report generated: $report_file"
}

# Main function
main() {
    log "🔍 Analyzing VPA Recommendations"
    echo ""
    
    # Check if VPA is installed
    if ! kubectl get crd verticalpodautoscalers.autoscaling.k8s.io &>/dev/null; then
        error "VPA is not installed. Please install VPA first."
    fi
    
    # Analyze recommendations
    analyze_vpa_recommendations
    
    # Get actual usage
    get_actual_usage
    
    echo ""
    success "Analysis completed!"
    log "Next steps:"
    echo "  1. Review recommendations above"
    echo "  2. Compare with actual usage patterns"
    echo "  3. Consider applying recommendations for non-critical workloads"
    echo "  4. Monitor performance after applying changes"
    echo "  5. Gradually enable 'Initial' mode for selected workloads"
}

# Run main
main "$@"

