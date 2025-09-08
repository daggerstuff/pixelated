#!/bin/bash

# Simplified and robust deployment script for Pixelated Empathy.
#
# Usage:
#   ./scripts/deploy.sh
#   ./scripts/deploy.sh --dry-run
#

set -eo pipefail

# --- CONFIGURATION ---
VPS_HOST="45.55.211.39"
VPS_USER="root"
VPS_PORT="22"
SSH_KEY="~/.ssh/planet"
REMOTE_PROJECT_DIR="/root/pixelated"
REMOTE_BACKUP_DIR="/root/pixelated_backups"
CONTAINER_NAME="pixelated-app"
IMAGE_NAME="pixelated"
MAX_BACKUPS=3

# --- FLAGS ---
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# --- STYLING AND LOGGING ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "\n${BLUE}=================================================${NC}"; echo -e "${BLUE}STEP: $1${NC}"; echo -e "${BLUE}=================================================${NC}"; }

# --- HELPER FUNCTIONS ---

# Wrapper to handle --dry-run for commands executed via SSH
run_ssh_script() {
    local remote_script="$1"
    local ssh_target="$VPS_USER@$VPS_HOST"
    local ssh_opts="-i $SSH_KEY -p $VPS_PORT -o StrictHostKeyChecking=no"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY-RUN] Would execute the following on $ssh_target:${NC}"
        echo "---"
        echo -e "$remote_script"
        echo "---"
        return 0
    fi
    ssh $ssh_opts $ssh_target bash <<< "$remote_script"
}

# --- DEPLOYMENT FUNCTIONS ---

manage_backups_on_vps() {
    print_header "Managing Backups on VPS"
    local script=$(cat <<EOF
set -e
mkdir -p "$REMOTE_BACKUP_DIR"

# Create a new backup of the current state BEFORE rsync
if [ -d "$REMOTE_PROJECT_DIR" ]; then
    BACKUP_NAME="pixelated-backup-\$(date +%Y%m%d-%H%M%S)"
    echo "Creating new backup: \$BACKUP_NAME"
    cp -r "$REMOTE_PROJECT_DIR" "$REMOTE_BACKUP_DIR/\$BACKUP_NAME"
else
    echo "Project directory does not exist, skipping backup creation."
fi

# Prune old backups
echo "Pruning old backups, keeping the latest $MAX_BACKUPS..."
# List directories, sort by name (which is date-based), skip the newest ones, and delete the rest.
ls -1d "$REMOTE_BACKUP_DIR"/pixelated-backup-* 2>/dev/null | sort -r | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -rf
echo "✅ Backup management complete."
EOF
)
    run_ssh_script "$script"
}

cleanup_previous_deployment_on_vps() {
    print_header "Cleaning Up Previous Docker Objects"
    local script=$(cat <<'EOF'
set -e
echo "Stopping and removing containers named 'pixelated-app'..."
CONTAINER_IDS=\$(docker ps -a -q --filter "name=pixelated-app")
if [ -n "\$CONTAINER_IDS" ]; then
    docker stop \$CONTAINER_IDS
    docker rm \$CONTAINER_IDS
    echo "Removed containers: \$CONTAINER_IDS"
else
    echo "No containers named 'pixelated-app' found."
fi

echo "Removing old images named 'pixelated:latest'..."
IMAGE_ID=\$(docker images -q pixelated:latest)
if [ -n "\$IMAGE_ID" ]; then
    docker rmi -f \$IMAGE_ID
    echo "Removed image pixelated:latest (\$IMAGE_ID)"
else
    echo "No image named 'pixelated:latest' found."
fi

echo "Cleaning up dangling images..."
docker image prune -f
echo "✅ Docker cleanup complete."
EOF
)
    run_ssh_script "$script"
}

sync_files_to_vps() {
    print_header "Synchronizing Project Files"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY-RUN]${NC} rsync -avz --delete --exclude-from='.dockerignore' -e \"ssh -i $SSH_KEY -p $VPS_PORT\" . \"$VPS_USER@$VPS_HOST:$REMOTE_PROJECT_DIR/\""
        return
    fi
    rsync -avz --delete --exclude-from='.dockerignore' -e "ssh -i $SSH_KEY -p $VPS_PORT" . "$VPS_USER@$VPS_HOST:$REMOTE_PROJECT_DIR/"
    print_status "✅ File synchronization complete."
}

build_container_on_vps() {
    print_header "Building Docker Container on VPS"
    local script=$(cat <<EOF
set -e
cd "$REMOTE_PROJECT_DIR"
echo "🔧 Starting Docker build on VPS. This may take a while..."
echo "Build context size: \$(du -sh . | cut -f1)"

docker build --tag "$IMAGE_NAME:latest" .

if [ \$? -eq 0 ]; then
    echo "✅ Docker build successful on VPS."
else
    echo "❌ Docker build failed on VPS."
    exit 1
fi
EOF
)
    if ! run_ssh_script "$script"; then
        print_error "Build script failed. See output above."
        exit 1
    fi
}

run_new_container_on_vps() {
    print_header "Starting New Container"
    local script=$(cat <<EOF
set -e
echo "Running new container '$CONTAINER_NAME' from image '$IMAGE_NAME:latest'..."
docker run -d -p 4321:4321 --name "$CONTAINER_NAME" --restart unless-stopped "$IMAGE_NAME:latest"
echo "✅ New container started."
EOF
)
    run_ssh_script "$script"
}

perform_health_check() {
    print_header "Performing Health Check"
    local url="http://${VPS_HOST}:4321"
    local attempts=5
    local delay=10

    if [ "$DRY_RUN" = true ]; then
        print_warning "Skipping health check in dry-run mode."
        return 0
    fi

    print_status "Waiting for application to become available at $url..."
    sleep $delay # Initial delay for server to start

    for i in \$(seq 1 \$attempts); do
        print_status "Health check attempt \$i of \$attempts..."
        if curl -s -I --fail "\$url" > /dev/null; then
            print_status "✅ Health check PASSED. Application is up and running."
            return 0
        else
            print_warning "Health check failed. Retrying in \$delay seconds..."
            sleep \$delay
        fi
    done

    print_error "❌ Health check FAILED after \$attempts attempts."
    print_error "The application may not be running correctly. Please check the container logs on the VPS:"
    print_error "ssh -i $SSH_KEY $VPS_USER@$VPS_HOST \"docker logs $CONTAINER_NAME\""
    exit 1
}

# --- MAIN EXECUTION ---
main() {
    print_header "Starting Pixelated Empathy Deployment"
    if [ "$DRY_RUN" = true ]; then
        print_warning "DRY RUN MODE ENABLED. NO CHANGES WILL BE MADE."
    fi

    trap 'print_error "Deployment script failed at line \$LINENO."' ERR

    manage_backups_on_vps
    cleanup_previous_deployment_on_vps
    sync_files_to_vps
    build_container_on_vps
    run_new_container_on_vps
    perform_health_check

    print_header "🚀 Deployment Complete 🚀"
    print_status "Application should be available at http://$VPS_HOST:4321"
}

main "$@"
