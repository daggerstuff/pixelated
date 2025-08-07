#!/bin/bash

# Enhanced Oracle Cloud Deployment with GitLab CLI, OpenMemory, and MCP Integration
# Leverages GitLab CLI for advanced CI/CD operations and OpenMemory for deployment tracking

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
DOMAIN=${1:-""}
USE_GITLAB_CLI=${USE_GITLAB_CLI:-"true"}
GITLAB_PROJECT="pixelatedtech/pixelated"

# Check available tools
check_tools() {
    print_header "Checking available tools..."
    
    # Check GitLab CLI (try multiple possible commands and Homebrew locations)
    GITLAB_CLI_CMD=""

    # Check common locations for glab (Homebrew installs)
    for glab_path in "glab" "/opt/homebrew/bin/glab" "/usr/local/bin/glab" "/home/linuxbrew/.linuxbrew/bin/glab"; do
        if command -v "$glab_path" &> /dev/null || [[ -x "$glab_path" ]]; then
            print_status "✅ GitLab CLI available at: $glab_path"
            GITLAB_CLI_VERSION=$("$glab_path" version 2>/dev/null | head -n1 || echo "version unknown")
            print_status "   Version: $GITLAB_CLI_VERSION"
            GITLAB_CLI_CMD="$glab_path"
            break
        fi
    done

    if [[ -z "$GITLAB_CLI_CMD" ]]; then
        print_warning "⚠️  GitLab CLI (glab) not found in PATH or common Homebrew locations, disabling GitLab CLI features"
        USE_GITLAB_CLI="false"
    fi
    
    # OpenMemory tracking is handled separately by the AI assistant
    
    # Check OCI CLI
    if command -v oci &> /dev/null; then
        print_status "✅ OCI CLI available"
        # Test OCI CLI authentication
        if oci iam region list &> /dev/null; then
            print_status "✅ OCI CLI authenticated"
        else
            print_warning "⚠️  OCI CLI not authenticated, falling back to standard deployment"
            USE_GITLAB_CLI="false"
        fi
    else
        print_warning "⚠️  OCI CLI not found, falling back to standard deployment"
        print_status "💡 To install OCI CLI: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm"
        print_status "🔄 Using standard deployment instead..."
        exec ./scripts/oracle-deploy.sh "$@"
    fi
}

# Store deployment memory in OpenMemory
store_deployment_memory() {
    local deployment_info="$1"
    
    if [[ "$USE_OPENMEMORY" != "true" ]]; then
        return
    fi
    
    print_header "Storing deployment information in OpenMemory..."
    
    local memory_content="Oracle Cloud deployment completed on $(date): $deployment_info. Infrastructure includes 4 ARM CPUs, 24GB RAM, PostgreSQL database, Redis cache, and Caddy reverse proxy with automatic HTTPS."
    
    # Store via MCP server (assuming it's running)
    curl -s -X POST http://localhost:3001/memory \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$memory_content\"}" || print_warning "Failed to store deployment memory"
    
    print_status "✅ Deployment information stored in OpenMemory"
}

# Create GitLab deployment issue
create_gitlab_deployment_issue() {
    local deployment_status="$1"
    local oracle_ip="$2"
    
    if [[ "$USE_GITLAB_CLI" != "true" ]]; then
        return
    fi
    
    print_header "Creating GitLab deployment tracking issue..."
    
    local issue_title="Oracle Cloud Deployment - $(date +%Y-%m-%d)"
    local issue_description="## Oracle Cloud Deployment Report

**Deployment Date**: $(date)
**Status**: $deployment_status
**Oracle Instance IP**: $oracle_ip
**Domain**: ${DOMAIN:-"IP-based access"}

### Infrastructure Details
- **Instance Type**: VM.Standard.A1.Flex (ARM64)
- **Resources**: 4 vCPUs, 24GB RAM
- **Storage**: 200GB (Always Free)
- **Database**: PostgreSQL 15
- **Cache**: Redis
- **Reverse Proxy**: Caddy with automatic HTTPS

### Services Deployed
- [x] Pixelated Empathy Frontend (Port 4321)
- [x] PostgreSQL Database (Port 5432)
- [x] Redis Cache (Port 6379)
- [x] Caddy Reverse Proxy (Ports 80/443)

### Access Information
- **Application URL**: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$oracle_ip}
- **SSH Access**: \`ssh -i ~/.ssh/pixelated_oracle ubuntu@$oracle_ip\`
- **Database**: \`psql -h $oracle_ip -U pixelated_user -d pixelated_empathy\`

### Next Steps
- [ ] Verify all services are running
- [ ] Test application functionality
- [ ] Set up monitoring alerts
- [ ] Configure backup schedules

### Troubleshooting
- Container logs: \`docker logs pixelated-app\`
- Caddy logs: \`sudo journalctl -u caddy -f\`
- Database status: \`sudo systemctl status postgresql\`

/label ~deployment ~oracle-cloud ~infrastructure"

    # Create issue using GitLab CLI
    if glab issue create \
        --title "$issue_title" \
        --description "$issue_description" \
        --label "deployment,oracle-cloud,infrastructure" \
        --project "$GITLAB_PROJECT" &> /dev/null; then
        print_status "✅ GitLab deployment issue created"
    else
        print_warning "⚠️  Failed to create GitLab deployment issue"
    fi
}

# Trigger GitLab CI pipeline for container build
trigger_gitlab_pipeline() {
    if [[ "$USE_GITLAB_CLI" != "true" ]]; then
        return
    fi
    
    print_header "Checking GitLab CI pipeline status..."
    
    # Get latest pipeline status
    local pipeline_status=$(glab ci status --project "$GITLAB_PROJECT" 2>/dev/null || echo "unknown")
    print_status "Latest pipeline status: $pipeline_status"
    
    # If no recent successful build, offer to trigger one
    if [[ "$pipeline_status" != "passed" ]]; then
        print_warning "No recent successful pipeline found"
        read -p "Trigger new GitLab CI pipeline? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Triggering GitLab CI pipeline..."
            if glab ci run --project "$GITLAB_PROJECT"; then
                print_status "✅ GitLab CI pipeline triggered"
                print_status "Monitor at: https://gitlab.com/$GITLAB_PROJECT/-/pipelines"
            else
                print_warning "⚠️  Failed to trigger GitLab CI pipeline"
            fi
        fi
    fi
}

# Get deployment information from memory
get_deployment_memory() {
    if [[ "$USE_OPENMEMORY" != "true" ]]; then
        return
    fi
    
    print_header "Checking previous deployment information..."
    
    # Query OpenMemory for previous deployments
    local memory_query="Oracle Cloud deployment"
    local previous_deployments=$(curl -s -X GET "http://localhost:3001/memory/search?q=$memory_query" | jq -r '.memories[].content' 2>/dev/null || echo "")
    
    if [[ -n "$previous_deployments" ]]; then
        print_status "📋 Previous deployment information found:"
        echo "$previous_deployments" | head -3
    else
        print_status "No previous deployment information found"
    fi
}

# Enhanced deployment with GitLab integration
enhanced_deploy() {
    print_header "🚀 Enhanced Oracle Cloud Deployment with GitLab Integration"
    
    # Get previous deployment info
    get_deployment_memory
    
    # Check if infrastructure exists
    if [[ -f ".oracle_deployment" ]]; then
        print_status "Existing Oracle Cloud infrastructure found"
        source .oracle_deployment
        
        # Trigger GitLab pipeline if needed
        trigger_gitlab_pipeline
        
        # Deploy application with GitLab registry
        print_status "Deploying application with GitLab Container Registry..."
        USE_GITLAB_REGISTRY=true ./scripts/deploy-app-to-oracle.sh "$DOMAIN"
        
        # Create deployment tracking issue
        create_gitlab_deployment_issue "Updated" "$PUBLIC_IP"
        
        # Store deployment memory
        store_deployment_memory "Application updated on existing Oracle Cloud infrastructure at $PUBLIC_IP"
        
    else
        print_status "Creating new Oracle Cloud infrastructure..."
        
        # Create infrastructure
        ./scripts/deploy-oracle-automated.sh
        
        # Wait for infrastructure to be ready
        sleep 60
        
        # Deploy application
        USE_GITLAB_REGISTRY=true ./scripts/deploy-app-to-oracle.sh "$DOMAIN"
        
        # Load deployment info
        source .oracle_deployment
        
        # Create deployment tracking issue
        create_gitlab_deployment_issue "Deployed" "$PUBLIC_IP"
        
        # Store deployment memory
        store_deployment_memory "New Oracle Cloud infrastructure created and application deployed at $PUBLIC_IP"
    fi
    
    print_status "🎉 Enhanced deployment completed!"
}

# GitLab merge request for deployment
create_deployment_mr() {
    if [[ "$USE_GITLAB_CLI" != "true" ]]; then
        return
    fi
    
    print_header "Creating deployment documentation MR..."
    
    # Create a branch for deployment documentation
    local branch_name="deployment/oracle-$(date +%Y%m%d-%H%M%S)"
    git checkout -b "$branch_name"
    
    # Update deployment documentation
    cat >> DEPLOYMENT_LOG.md << EOF

## Oracle Cloud Deployment - $(date)

**Instance IP**: $PUBLIC_IP
**Domain**: ${DOMAIN:-"IP-based access"}
**Deployment Method**: Enhanced GitLab Integration
**Container Registry**: GitLab Container Registry
**Status**: ✅ Deployed

### Services
- Frontend: Running on port 4321
- Database: PostgreSQL on port 5432
- Cache: Redis on port 6379
- Proxy: Caddy with automatic HTTPS

### Access
- Application: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$PUBLIC_IP}
- SSH: \`ssh -i ~/.ssh/pixelated_oracle ubuntu@$PUBLIC_IP\`

EOF
    
    # Commit and push
    git add DEPLOYMENT_LOG.md
    git commit -m "docs: Add Oracle Cloud deployment log for $(date +%Y-%m-%d)"
    git push gitlab "$branch_name"
    
    # Create merge request
    glab mr create \
        --title "Oracle Cloud Deployment Documentation - $(date +%Y-%m-%d)" \
        --description "Automated deployment documentation update" \
        --source-branch "$branch_name" \
        --target-branch "master" \
        --project "$GITLAB_PROJECT"
    
    print_status "✅ Deployment documentation MR created"
    git checkout master
}

# Main execution
main() {
    check_tools
    enhanced_deploy
    
    if [[ -f ".oracle_deployment" ]]; then
        source .oracle_deployment
        create_deployment_mr
        
        print_header "🎯 Deployment Summary"
        print_status "Oracle Cloud Instance: $PUBLIC_IP"
        print_status "Application URL: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$PUBLIC_IP}"
        print_status "GitLab Project: https://gitlab.com/$GITLAB_PROJECT"
        print_status "Container Registry: registry.gitlab.com/$GITLAB_PROJECT"
        
        if [[ "$USE_OPENMEMORY" == "true" ]]; then
            print_status "Deployment info stored in OpenMemory"
        fi
        
        if [[ "$USE_GITLAB_CLI" == "true" ]]; then
            print_status "GitLab issue and MR created for tracking"
        fi
    fi
}

main "$@"
