#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VPS_HOST="45.55.211.39"
VPS_USER="root"
VPS_PORT="22"
SSH_KEY="$HOME/.ssh/planet"
DOMAIN="pixelatedempathy.com"
LOCAL_PROJECT_DIR="/home/vivi/pixelated"
REMOTE_PROJECT_DIR="/root/pixelated"

# Logging functions
print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Error handling
set -o pipefail
trap 'print_error "Script failed at line $LINENO"' ERR

# Cleanup disk space on VPS
cleanup_disk_space() {
    print_header "🧹 Cleaning up disk space on VPS"
    
    ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'EOF'
        echo "Current disk usage:"
        df -h
        
        echo "Cleaning Docker system..."
        docker system prune -af --volumes || true
        
        echo "Removing old containers..."
        docker ps -a --filter "status=exited" --format "{{.Names}}" | grep -i "pixelated" | xargs -r docker rm -f 2>/dev/null || true
        
        echo "Removing dangling images..."
        docker images -f "dangling=true" --format "{{.ID}}" | xargs -r docker rmi -f 2>/dev/null || true
        
        echo "Cleaning temporary files..."
        rm -rf /tmp/* 2>/dev/null || true
        
        echo "Updated disk usage:"
        df -h
EOF
    
    return $?
}

# Sync files to VPS
sync_files() {
    print_header "📁 Synchronizing files to VPS"
    
    # Ensure remote directory exists
    ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
        "mkdir -p '$REMOTE_PROJECT_DIR'"
    
    # Create exclude file
    cat > /tmp/rsync-exclude << 'EOF'
node_modules/
.next/
.nuxt/
dist/
build/
.cache/
.temp/
*.log
*.tmp
.git/
.DS_Store
Thumbs.db
EOF
    
    # Perform rsync with better error handling
    print_status "Starting file synchronization..."
    rsync -avz --delete --exclude-from=/tmp/rsync-exclude \
        --timeout=300 --partial --progress \
        -e "ssh -i '$SSH_KEY' -p '$VPS_PORT' -o StrictHostKeyChecking=no -o ConnectTimeout=30" \
        "$LOCAL_PROJECT_DIR/" "$VPS_USER@$VPS_HOST:$REMOTE_PROJECT_DIR/"
    
    local rsync_exit_code=$?
    rm -f /tmp/rsync-exclude
    
    # Handle rsync exit codes properly
    case $rsync_exit_code in
        0)
            print_status "✅ Files synchronized successfully"
            return 0
            ;;
        23)
            print_warning "⚠️  Some files were not transferred (partial success)"
            print_status "✅ Core synchronization completed"
            return 0
            ;;
        24)
            print_warning "⚠️  Some files vanished during transfer (partial success)"
            print_status "✅ Core synchronization completed"
            return 0
            ;;
        *)
            print_error "❌ File synchronization failed with exit code $rsync_exit_code"
            return 1
            ;;
    esac
}

# Build and deploy container on VPS
build_and_deploy() {
    print_header "🐳 Building and deploying container on VPS"
    
    ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'EOF'
        set -e
        
        # Ensure we're in the right directory
        if [ ! -d "/root/pixelated" ]; then
            echo "❌ Project directory not found: /root/pixelated"
            exit 1
        fi
        
        cd "/root/pixelated"
        
        # Source nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Ensure Node.js and pnpm are available
        if ! command -v node >/dev/null 2>&1; then
            echo "❌ Node.js not found"
            exit 1
        fi
        
        if ! command -v pnpm >/dev/null 2>&1; then
            echo "Installing pnpm..."
            npm install -g pnpm@10.16.0
        else
            echo "pnpm already installed: $(pnpm --version)"
        fi
        
        echo "🔧 Building Docker container..."
        echo "Node.js version: $(node --version)"
        echo "pnpm version: $(pnpm --version)"
        echo "Working directory: $(pwd)"
        
        # Clean up any existing containers and images
        echo "Cleaning up existing containers..."
        docker stop pixelated-app-new 2>/dev/null || true
        docker rm pixelated-app-new 2>/dev/null || true
        docker rmi pixelated-box:latest 2>/dev/null || true
        
        # Verify Dockerfile exists
        if [ ! -f "Dockerfile" ]; then
            echo "❌ Dockerfile not found in $(pwd)"
            ls -la
            exit 1
        fi
        
        # Build container with BuildKit enabled for DNS support
        echo "Building Docker image..."
        DOCKER_BUILDKIT=1 docker build \
            --network=host \
            --no-cache \
            -t "pixelated-box:latest" \
            .
        
        if [ $? -eq 0 ]; then
            echo "✅ Container built successfully"
            
            # Start new container
            echo "Starting container..."
            docker run -d \
                --name pixelated-app-new \
                --restart unless-stopped \
                -p 4321:4321 \
                "pixelated-box:latest"
            
            if [ $? -eq 0 ]; then
                echo "✅ Container started successfully"
                
                # Wait for container to be ready
                echo "Waiting for application to start..."
                sleep 15
                
                # Test if application is responding
                if curl -f http://localhost:4321/ >/dev/null 2>&1; then
                    echo "✅ Application is responding"
                    exit 0
                else
                    echo "⚠️  Application may still be starting up"
                    echo "Container logs:"
                    docker logs --tail 20 pixelated-app-new
                    exit 0
                fi
            else
                echo "❌ Failed to start container"
                exit 1
            fi
        else
            echo "❌ Container build failed"
            exit 1
        fi
EOF
    
    return $?
}

# Main deployment function
main() {
    print_header "🚀 Deploying Pixelated Empathy to VPS"
    print_status "Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
    print_status "Domain: $DOMAIN"
    
    # Step 1: Clean up disk space
    if ! cleanup_disk_space; then
        print_error "Disk cleanup failed"
        exit 1
    fi
    
    # Step 2: Sync files
    if ! sync_files; then
        print_error "File synchronization failed"
        exit 1
    fi
    
    # Step 3: Build and deploy
    if ! build_and_deploy; then
        print_error "Build and deployment failed"
        exit 1
    fi
    
    print_header "✅ Deployment completed successfully"
    print_status "Application should be available at: http://$DOMAIN"
    print_status "Direct access: http://$VPS_HOST:4321"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi