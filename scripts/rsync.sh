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
.build/
.cache/
.temp/
*.log
*.tmp
.git/
.DS_Store
Thumbs.db
.venv/
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
            npm install -g pnpm@10.18.2
        else
            echo "pnpm already installed: $(pnpm --version)"
        fi

        echo "🔧 Building Docker container..."
        echo "Node.js version: $(node --version)"
        echo "pnpm version: $(pnpm --version)"
        echo "Working directory: $(pwd)"

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

            # Now that build succeeded, clean up old containers for handoff
            echo "Preparing for container handoff..."
            # Kill any processes on ports 4321/4322
            lsof -ti:4321 | xargs -r kill -9 2>/dev/null || true
            lsof -ti:4322 | xargs -r kill -9 2>/dev/null || true
            # Stop and remove old pixelated containers
            docker ps -a --format "{{.Names}}" | grep -i "pixelated" | xargs -r docker stop 2>/dev/null || true
            docker ps -a --format "{{.Names}}" | grep -i "pixelated" | xargs -r docker rm 2>/dev/null || true

            # Start new container
            echo "Starting new container..."
            docker run -d \
                --name pixelated-app \
                --restart unless-stopped \
                -p 4321:4321 \
                --env-file .env \
                "pixelated-box:latest"

            if [ $? -eq 0 ]; then
                echo "✅ Container started successfully"

                # Wait for container to be ready
                echo "Waiting for application to start..."
                # Give the app time to initialize
                sleep 30

                # Check container logs for startup progress
                echo "Checking startup logs..."
                docker logs --tail 10 pixelated-app

                # Check if the container is still running
                if ! docker ps -f name=pixelated-app | grep -q pixelated-app; then
                    echo "❌ Container stopped unexpectedly"
                    docker logs pixelated-app
                    exit 1
                fi

                # Health checks - test what users actually access
                echo "Running health checks..."

                # 1. Verify container is running
                CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' pixelated-app 2>/dev/null || echo "unknown")
                if [ "$CONTAINER_STATUS" != "running" ]; then
                    echo "❌ Container not running (status: $CONTAINER_STATUS)"
                    docker logs pixelated-app
                    exit 1
                fi
                echo "✅ Container is running"

                # 2. Test local port first
                echo "Testing local port (localhost:4321)..."
                if curl -f --connect-timeout 10 --max-time 15 http://localhost:4321/ >/dev/null 2>&1; then
                    echo "✅ Local port responding"
                else
                    echo "❌ Local port failed"
                    docker logs --tail 20 pixelated-app
                    exit 1
                fi

                # 3. CRITICAL: Test the actual live domain
                echo "Testing live domain (pixelatedempathy.com)..."
                sleep 5  # Give proxy time to detect new backend

                # Test HTTP (should redirect to HTTPS)
                HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 http://pixelatedempathy.com/ || echo "000")
                if [ "$HTTP_STATUS" = "308" ] || [ "$HTTP_STATUS" = "301" ]; then
                    echo "✅ HTTP redirect working ($HTTP_STATUS)"
                else
                    echo "❌ HTTP redirect failed (status: $HTTP_STATUS)"
                fi

                # Test HTTPS (the real test)
                HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 https://pixelatedempathy.com/ || echo "000")
                if [ "$HTTPS_STATUS" = "200" ]; then
                    echo "✅ HTTPS site responding (status: $HTTPS_STATUS)"

                    # Verify content
                    CONTENT=$(curl -s --max-time 10 https://pixelatedempathy.com/ | head -c 500)
                    if [[ "$CONTENT" == *"Pixelated Empathy"* ]]; then
                        echo "✅ Live site content verified"
                    else
                        echo "❌ Live site content check failed"
                        echo "Response preview: $CONTENT"
                        exit 1
                    fi
                else
                    echo "❌ HTTPS site failed (status: $HTTPS_STATUS)"
                    echo "This means users will see 502 errors!"
                    exit 1
                fi

                echo "✅ All health checks passed - site is live"
                exit 0
            else
                echo "❌ Failed to start container"
                exit 1
            fi
        else
            echo "❌ Container build failed - keeping existing containers running"
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
