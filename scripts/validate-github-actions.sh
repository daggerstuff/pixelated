#!/bin/bash
set -euo pipefail

echo "🔍 Validating GitHub Actions GKE Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
print_info() { echo -e "${BLUE}[ℹ]${NC} $1"; }

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

print_status "GitHub CLI is installed"

# Check if we're authenticated with GitHub
if ! gh auth status &> /dev/null; then
    print_error "Not authenticated with GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

print_status "Authenticated with GitHub CLI"

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
print_info "Checking repository: $REPO"

echo ""
echo "🔐 Checking GitHub Secrets"
echo "=========================="

# Function to check if secret exists in GitHub or .env
check_secret_source() {
    local secret_name=$1
    local is_required=$2
    
    # Check GitHub Secrets first
    if gh secret list | grep -q "^$secret_name\s"; then
        print_status "$secret_name is set in GitHub Secrets"
        return 0
    fi
    
    # Check .env file as fallback
    if [[ -f ".env" ]]; then
        if grep -q "^$secret_name=" .env; then
            print_status "$secret_name is set in .env file"
            return 0
        fi
    fi
    
    # Check .env.local as another fallback
    if [[ -f ".env.local" ]]; then
        if grep -q "^$secret_name=" .env.local; then
            print_status "$secret_name is set in .env.local file"
            return 0
        fi
    fi
    
    if [[ "$is_required" == "true" ]]; then
        print_error "$secret_name is missing (not in GitHub Secrets or .env files)"
    else
        print_warning "$secret_name is not set (using defaults)"
    fi
}

# Required secrets list
REQUIRED_SECRETS=(
    "GCP_SERVICE_ACCOUNT_KEY"
    "GCP_PROJECT_ID"
    "GKE_CLUSTER_NAME"
    "GKE_ZONE"
    "GKE_NAMESPACE"
    "GKE_DEPLOYMENT_NAME"
    "GKE_SERVICE_NAME"
    "GKE_ENVIRONMENT_URL"
)

OPTIONAL_SECRETS=(
    "GKE_REPLICAS"
    "GKE_MAX_SURGE"
    "GKE_MAX_UNAVAILABLE"
    "CANARY_PERCENTAGE"
    "AUTO_ROLLBACK"
    "HEALTH_CHECK_TIMEOUT"
    "KEEP_IMAGES"
    "CLEANUP_OLDER_THAN"
    "SLACK_WEBHOOK_URL"
    "SENTRY_AUTH_TOKEN"
    "SENTRY_ORG"
    "SENTRY_PROJECT"
    "SENTRY_DSN"
    "PUBLIC_SENTRY_DSN"
)

# Check required secrets
echo "Required Secrets:"
for secret in "${REQUIRED_SECRETS[@]}"; do
    check_secret_source "$secret" "true"
done

echo ""
echo "Optional Secrets:"
for secret in "${OPTIONAL_SECRETS[@]}"; do
    check_secret_source "$secret" "false"
done

echo ""
echo "📋 Checking Workflow Files"
echo "========================="

# Check if workflow files exist
WORKFLOW_FILES=(
    ".github/workflows/gke-deploy.yml"
    ".github/workflows/gke-rollback.yml"
    ".github/workflows/gke-monitoring.yml"
    ".github/workflows/gke-integration.yml"
    ".github/workflows/ci.yml"
    ".github/workflows/security-scanning.yml"
    ".github/workflows/sentry-build.yml"
    ".github/workflows/kubesec.yml"
)

for file in "${WORKFLOW_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        print_status "$file exists"
    else
        print_error "$file is missing"
    fi
done

echo ""
echo "🔍 Validating Service Account Key"
echo "================================="

# Check if GCP service account key is valid JSON
if gh secret get GCP_SERVICE_ACCOUNT_KEY &> /dev/null; then
    SERVICE_ACCOUNT_KEY=$(gh secret get GCP_SERVICE_ACCOUNT_KEY)
    
    # Basic JSON validation
    if echo "$SERVICE_ACCOUNT_KEY" | jq -e . &> /dev/null; then
        print_status "GCP_SERVICE_ACCOUNT_KEY is valid JSON"
        
        # Extract key information
        PROJECT_ID=$(echo "$SERVICE_ACCOUNT_KEY" | jq -r .project_id)
        CLIENT_EMAIL=$(echo "$SERVICE_ACCOUNT_KEY" | jq -r .client_email)
        
        print_info "Project ID: $PROJECT_ID"
        print_info "Service Account: $CLIENT_EMAIL"
        
        # Check if project ID matches the secret
        if gh secret get GCP_PROJECT_ID &> /dev/null; then
            CONFIGURED_PROJECT_ID=$(gh secret get GCP_PROJECT_ID)
            if [[ "$PROJECT_ID" == "$CONFIGURED_PROJECT_ID" ]]; then
                print_status "Project ID matches service account"
            else
                print_warning "Project ID mismatch: service account has '$PROJECT_ID', secret has '$CONFIGURED_PROJECT_ID'"
            fi
        fi
    else
        print_error "GCP_SERVICE_ACCOUNT_KEY is not valid JSON"
    fi
else
    # Check .env as fallback
    if [[ -f ".env" ]] && grep -q "^GCP_SERVICE_ACCOUNT_KEY=" .env; then
        print_status "GCP_SERVICE_ACCOUNT_KEY found in .env file"
    else
        print_error "GCP_SERVICE_ACCOUNT_KEY not found in GitHub Secrets or .env"
    fi
fi

echo ""
echo "🚀 Testing Workflow Syntax"
echo "=========================="

# Validate workflow syntax using GitHub's workflow syntax checker
for file in "${WORKFLOW_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        print_info "Validating $file..."
        
        # Use GitHub's workflow syntax validation (requires push to see errors)
        # For now, just check basic YAML syntax
        if python3 -c "import yaml; yaml.safe_load(open('$file'))" &> /dev/null; then
            print_status "$file has valid YAML syntax"
        else
            print_error "$file has YAML syntax errors"
            python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>&1 | head -5
        fi
    fi
done

echo ""
echo "📊 Summary"
echo "=========="

print_info "Setup validation completed!"
echo ""
echo "Next steps:"
echo "1. Fix any missing required secrets"
echo "2. Test with a staging deployment first"
echo "3. Run: gh workflow run gke-monitoring.yml -f check_type=basic -f environment=staging"
echo "4. Monitor the workflow runs in GitHub Actions tab"
echo ""
echo "For detailed setup instructions, see: .github/workflows/SETUP_GUIDE.md"