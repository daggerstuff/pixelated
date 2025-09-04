#!/bin/bash

# Improved Deployment Script for Pixelated Empathy
# Implements pipeline-style deployment with comprehensive health checks and rollback capabilities

set -e

# Configuration
VPS_HOST=${1:-"45.55.211.39"}
VPS_USER=${2:-"root"}
VPS_PORT=${3:-"22"}
SSH_KEY=${4:-"~/.ssh/planet"}
DOMAIN=${5:-"pixelatedempathy.com"}
LOCAL_PROJECT_DIR="/home/vivi/pixelated"
REMOTE_PROJECT_DIR="/root/pixelated"

# Target versions (Requirements 1.1, 1.2)
TARGET_NODE_VERSION="24.7.0"
TARGET_PNPM_VERSION="10.15.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Deployment context for tracking state
DEPLOYMENT_CONTEXT=""
DEPLOYMENT_TIMESTAMP=""
COMMIT_HASH=""

# Logging functions with timestamps
log_with_timestamp() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} ${level} ${message}"
}

print_status() { log_with_timestamp "${GREEN}[INFO]${NC}" "$1"; }
print_warning() { log_with_timestamp "${YELLOW}[WARNING]${NC}" "$1"; }
print_error() { log_with_timestamp "${RED}[ERROR]${NC}" "$1"; }
print_header() { log_with_timestamp "${BLUE}[STEP]${NC}" "$1"; }
print_debug() { log_with_timestamp "${CYAN}[DEBUG]${NC}" "$1"; }

# Initialize deployment context
initialize_deployment_context() {
    DEPLOYMENT_TIMESTAMP=$(date '+%Y-%m-%d-%H%M%S')
    COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    DEPLOYMENT_CONTEXT="deployment-${DEPLOYMENT_TIMESTAMP}-${COMMIT_HASH}"
    
    print_status "Deployment context initialized: $DEPLOYMENT_CONTEXT"
    print_status "Target Node.js version: $TARGET_NODE_VERSION"
    print_status "Target pnpm version: $TARGET_PNPM_VERSION"
}

#=============================================================================
# ENVIRONMENT MANAGER COMPONENT
# Handles Node.js and pnpm installation and verification
#=============================================================================

# Environment Manager: Node.js setup functions (Requirement 1.1, 1.3)
setup_nodejs_environment() {
    local ssh_cmd="$1"
    local vps_connection="$2"
    
    print_header "Setting up Node.js environment (v${TARGET_NODE_VERSION})"
    
    $ssh_cmd "$vps_connection" bash << EOF
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "\${GREEN}[VPS-ENV]${NC} \$1"; }
print_error() { echo -e "\${RED}[VPS-ENV ERROR]${NC} \$1"; }
print_warning() { echo -e "\${YELLOW}[VPS-ENV WARNING]${NC} \$1"; }

# Function to install nvm if not present
install_nvm() {
    if [[ ! -s "\$HOME/.nvm/nvm.sh" ]]; then
        print_status "Installing nvm (Node Version Manager)..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        
        # Add nvm to bashrc for persistent sessions (Requirement 1.3)
        if ! grep -q "NVM_DIR" ~/.bashrc; then
            print_status "Adding nvm to ~/.bashrc for persistent sessions..."
            echo 'export NVM_DIR="\$HOME/.nvm"' >> ~/.bashrc
            echo '[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"' >> ~/.bashrc
            echo '[ -s "\$NVM_DIR/bash_completion" ] && \. "\$NVM_DIR/bash_completion"' >> ~/.bashrc
        fi
    else
        print_status "nvm already installed"
    fi
    
    # Load nvm for current session
    export NVM_DIR="\$HOME/.nvm"
    [ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
    [ -s "\$NVM_DIR/bash_completion" ] && \. "\$NVM_DIR/bash_completion"
}

# Function to install and configure Node.js 24.7.0
install_nodejs() {
    print_status "Installing Node.js ${TARGET_NODE_VERSION}..."
    
    # Install specific Node.js version
    nvm install ${TARGET_NODE_VERSION}
    nvm use ${TARGET_NODE_VERSION}
    nvm alias default ${TARGET_NODE_VERSION}
    
    print_status "Node.js ${TARGET_NODE_VERSION} installation completed"
}

# Function to configure PATH for persistent sessions (Requirement 1.3)
configure_nodejs_path() {
    print_status "Configuring PATH for persistent Node.js sessions..."
    
    # Ensure Node.js binaries are in PATH
    local node_path="\$NVM_DIR/versions/node/v${TARGET_NODE_VERSION}/bin"
    
    # Update current session PATH
    export PATH="\$node_path:\$PATH"
    
    # Verify PATH configuration
    print_status "Current PATH includes Node.js: \$(echo \$PATH | grep -o "\$node_path" || echo "NOT FOUND")"
}

# Main Node.js setup execution
print_status "Starting Node.js environment setup..."

install_nvm
install_nodejs
configure_nodejs_path

print_status "✅ Node.js environment setup completed"
EOF

    if [ $? -eq 0 ]; then
        print_status "✅ Node.js environment setup successful"
        return 0
    else
        print_error "❌ Node.js environment setup failed"
        return 1
    fi
}

# Environment Manager: Node.js version verification (Requirement 1.1, 1.3)
verify_nodejs_installation() {
    local ssh_cmd="$1"
    local vps_connection="$2"
    
    print_header "Verifying Node.js installation"
    
    local verification_result=$($ssh_cmd "$vps_connection" bash << 'EOF'
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-VERIFY]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-VERIFY ERROR]${NC} $1"; }

# Load nvm environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Switch to target Node.js version
nvm use 24.7.0 2>/dev/null || {
    print_error "Failed to switch to Node.js 24.7.0"
    exit 1
}

# Verify Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "NONE")
NODE_PATH=$(which node 2>/dev/null || echo "NOT_FOUND")

print_status "Node.js version: $NODE_VERSION"
print_status "Node.js path: $NODE_PATH"

# Check if version matches target
if [[ "$NODE_VERSION" == "v24.7.0" ]]; then
    print_status "✅ Node.js version verification passed"
    echo "SUCCESS"
else
    print_error "❌ Node.js version mismatch. Expected: v24.7.0, Got: $NODE_VERSION"
    echo "FAILED"
fi
EOF
)

    if [[ "$verification_result" == *"SUCCESS"* ]]; then
        print_status "✅ Node.js version verification successful"
        return 0
    else
        print_error "❌ Node.js version verification failed"
        print_error "Verification output: $verification_result"
        return 1
    fi
}

# Environment Manager: pnpm installation and verification (Requirement 1.2, 1.4)
setup_pnpm_environment() {
    local ssh_cmd="$1"
    local vps_connection="$2"
    
    print_header "Setting up pnpm environment (v${TARGET_PNPM_VERSION})"
    
    $ssh_cmd "$vps_connection" bash << EOF
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "\${GREEN}[VPS-PNPM]${NC} \$1"; }
print_error() { echo -e "\${RED}[VPS-PNPM ERROR]${NC} \$1"; }
print_warning() { echo -e "\${YELLOW}[VPS-PNPM WARNING]${NC} \$1"; }

# Load nvm environment
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
[ -s "\$NVM_DIR/bash_completion" ] && \. "\$NVM_DIR/bash_completion"

# Ensure we're using the correct Node.js version
nvm use ${TARGET_NODE_VERSION}

# Function to install pnpm with specific version
install_pnpm() {
    print_status "Installing pnpm ${TARGET_PNPM_VERSION}..."
    
    # Install pnpm globally with specific version
    npm install -g pnpm@${TARGET_PNPM_VERSION}
    
    print_status "pnpm ${TARGET_PNPM_VERSION} installation completed"
}

# Function to verify pnpm installation
verify_pnpm_basic() {
    local pnpm_version=\$(pnpm --version 2>/dev/null || echo "NONE")
    local pnpm_path=\$(which pnpm 2>/dev/null || echo "NOT_FOUND")
    
    print_status "pnpm version: \$pnpm_version"
    print_status "pnpm path: \$pnpm_path"
    
    return 0
}

# Main pnpm setup execution
print_status "Starting pnpm environment setup..."

install_pnpm
verify_pnpm_basic

print_status "✅ pnpm environment setup completed"
EOF

    if [ $? -eq 0 ]; then
        print_status "✅ pnpm environment setup successful"
        return 0
    else
        print_error "❌ pnpm environment setup failed"
        return 1
    fi
}

# Environment Manager: Comprehensive pnpm verification (Requirement 1.2, 1.4)
verify_pnpm_installation() {
    local ssh_cmd="$1"
    local vps_connection="$2"
    
    print_header "Verifying pnpm installation with detailed error reporting"
    
    local verification_result=$($ssh_cmd "$vps_connection" bash << 'EOF'
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-PNPM-VERIFY]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-PNPM-VERIFY ERROR]${NC} $1"; }

# Load nvm environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Switch to target Node.js version
nvm use 24.7.0 2>/dev/null || {
    print_error "Failed to switch to Node.js 24.7.0 for pnpm verification"
    echo "FAILED"
    exit 1
}

# Comprehensive pnpm verification
PNPM_VERSION=$(pnpm --version 2>/dev/null || echo "NONE")
PNPM_PATH=$(which pnpm 2>/dev/null || echo "NOT_FOUND")
PNPM_NODE_VERSION=$(pnpm exec node --version 2>/dev/null || echo "NONE")

print_status "pnpm version: $PNPM_VERSION"
print_status "pnpm path: $PNPM_PATH"
print_status "pnpm using Node.js version: $PNPM_NODE_VERSION"

# Detailed error reporting for version mismatch
if [[ "$PNPM_VERSION" == "10.15.0" ]]; then
    print_status "✅ pnpm version verification passed"
    
    # Verify pnpm is using correct Node.js version
    if [[ "$PNPM_NODE_VERSION" == "v24.7.0" ]]; then
        print_status "✅ pnpm Node.js version verification passed"
        echo "SUCCESS"
    else
        print_error "❌ pnpm is using wrong Node.js version"
        print_error "Expected: v24.7.0, Got: $PNPM_NODE_VERSION"
        echo "FAILED"
    fi
else
    print_error "❌ pnpm version mismatch"
    print_error "Expected: 10.15.0, Got: $PNPM_VERSION"
    print_error "pnpm path: $PNPM_PATH"
    echo "FAILED"
fi
EOF
)

    if [[ "$verification_result" == *"SUCCESS"* ]]; then
        print_status "✅ pnpm verification successful"
        return 0
    else
        print_error "❌ pnpm verification failed"
        print_error "Verification output: $verification_result"
        return 1
    fi
}

# Environment Manager: Comprehensive environment validation (Requirement 1.4)
validate_complete_environment() {
    local ssh_cmd="$1"
    local vps_connection="$2"
    
    print_header "Performing comprehensive environment validation"
    
    local validation_result=$($ssh_cmd "$vps_connection" bash << 'EOF'
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-VALIDATE]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-VALIDATE ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[VPS-VALIDATE]${NC} $1"; }

# Load nvm environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Switch to target versions
nvm use 24.7.0

print_header "Environment Validation Report"
print_status "================================"

# Collect all environment information
NODE_VERSION=$(node --version 2>/dev/null || echo "NONE")
NODE_PATH=$(which node 2>/dev/null || echo "NOT_FOUND")
NPM_VERSION=$(npm --version 2>/dev/null || echo "NONE")
PNPM_VERSION=$(pnpm --version 2>/dev/null || echo "NONE")
PNPM_PATH=$(which pnpm 2>/dev/null || echo "NOT_FOUND")

print_status "Node.js version: $NODE_VERSION"
print_status "Node.js path: $NODE_PATH"
print_status "npm version: $NPM_VERSION"
print_status "pnpm version: $PNPM_VERSION"
print_status "pnpm path: $PNPM_PATH"

# Validation checks
VALIDATION_PASSED=true

# Check Node.js version
if [[ "$NODE_VERSION" != "v24.7.0" ]]; then
    print_error "❌ Node.js version check failed"
    VALIDATION_PASSED=false
else
    print_status "✅ Node.js version check passed"
fi

# Check pnpm version
if [[ "$PNPM_VERSION" != "10.15.0" ]]; then
    print_error "❌ pnpm version check failed"
    VALIDATION_PASSED=false
else
    print_status "✅ pnpm version check passed"
fi

# Check PATH configuration
if [[ "$NODE_PATH" == *"nvm/versions/node/v24.7.0"* ]]; then
    print_status "✅ Node.js PATH configuration correct"
else
    print_error "❌ Node.js PATH configuration incorrect"
    VALIDATION_PASSED=false
fi

print_status "================================"

if [[ "$VALIDATION_PASSED" == "true" ]]; then
    print_status "✅ All environment validation checks passed"
    echo "SUCCESS"
else
    print_error "❌ Environment validation failed"
    echo "FAILED"
fi
EOF
)

    if [[ "$validation_result" == *"SUCCESS"* ]]; then
        print_status "✅ Complete environment validation successful"
        return 0
    else
        print_error "❌ Environment validation failed"
        print_error "Validation output: $validation_result"
        return 1
    fi
}

#=============================================================================
# MAIN DEPLOYMENT ORCHESTRATION
#=============================================================================

# Show usage information
show_usage() {
    echo "Usage: $0 [VPS_HOST] [VPS_USER] [VPS_PORT] [SSH_KEY] [DOMAIN]"
    echo ""
    echo "Improved deployment script with pipeline-style deployment"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 208.117.84.253 root 22"
    echo "  $0 208.117.84.253 root 22 ~/.ssh/planet pixelatedempathy.com"
    echo ""
    exit 1
}

# Main deployment function
main() {
    # Initialize deployment context
    initialize_deployment_context
    
    print_header "🚀 Starting Improved Deployment Pipeline"
    print_status "Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
    print_status "Domain: ${DOMAIN:-"IP-based access"}"
    print_status "Local dir: $LOCAL_PROJECT_DIR"
    print_status "Remote dir: $REMOTE_PROJECT_DIR"
    
    # Build SSH command
    SSH_CMD="ssh -t"
    if [[ -n "$SSH_KEY" ]]; then
        SSH_CMD="$SSH_CMD -i $SSH_KEY"
    fi
    SSH_CMD="$SSH_CMD -p $VPS_PORT"
    VPS_CONNECTION="$VPS_USER@$VPS_HOST"
    
    # Test SSH connection
    print_header "Testing SSH connection..."
    if $SSH_CMD "$VPS_CONNECTION" "echo 'SSH connection successful'" 2>/dev/null; then
        print_status "✅ SSH connection working"
    else
        print_error "❌ SSH connection failed"
        exit 1
    fi
    
    # Phase 1: Environment Setup
    print_header "Phase 1: Environment Setup"
    
    # Setup Node.js environment
    if ! setup_nodejs_environment "$SSH_CMD" "$VPS_CONNECTION"; then
        print_error "❌ Node.js environment setup failed"
        exit 1
    fi
    
    # Verify Node.js installation
    if ! verify_nodejs_installation "$SSH_CMD" "$VPS_CONNECTION"; then
        print_error "❌ Node.js verification failed"
        exit 1
    fi
    
    # Setup pnpm environment
    if ! setup_pnpm_environment "$SSH_CMD" "$VPS_CONNECTION"; then
        print_error "❌ pnpm environment setup failed"
        exit 1
    fi
    
    # Verify pnpm installation
    if ! verify_pnpm_installation "$SSH_CMD" "$VPS_CONNECTION"; then
        print_error "❌ pnpm verification failed"
        exit 1
    fi
    
    # Comprehensive environment validation
    if ! validate_complete_environment "$SSH_CMD" "$VPS_CONNECTION"; then
        print_error "❌ Environment validation failed"
        exit 1
    fi
    
    print_status "✅ Phase 1: Environment Setup completed successfully"
    
    # TODO: Additional phases will be implemented in subsequent tasks
    print_status "🎉 Environment Manager implementation completed!"
    print_status "Next phases (Backup Manager, Container Manager, etc.) will be implemented in subsequent tasks."
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi