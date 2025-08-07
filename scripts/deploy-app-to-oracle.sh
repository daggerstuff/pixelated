#!/bin/bash

# Deploy Pixelated app to existing Oracle Cloud instance
# This script uploads and deploys your app to the instance created by deploy-oracle-automated.sh

set -e

# Configuration
APP_NAME="pixelated"
CONTAINER_NAME="pixelated-app"
PORT=4321
DOMAIN=${1:-""}

# GitLab Container Registry Configuration
GITLAB_REGISTRY="registry.gitlab.com"
GITLAB_PROJECT="pixelatedtech/pixelated"
USE_GITLAB_REGISTRY=${USE_GITLAB_REGISTRY:-"true"}  # Default to true since GitLab is already configured

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

# Load deployment info
load_deployment_info() {
    if [[ ! -f ".oracle_deployment" ]]; then
        print_error "No deployment info found. Run ./scripts/deploy-oracle-automated.sh first"
        exit 1
    fi
    
    source .oracle_deployment
    
    if [[ -z "$PUBLIC_IP" || -z "$SSH_KEY_PATH" ]]; then
        print_error "Invalid deployment info. Please re-run infrastructure deployment."
        exit 1
    fi
    
    # Use domain if provided, otherwise use IP
    if [[ -n "$DOMAIN" ]]; then
        TARGET_HOST="$DOMAIN"
    else
        TARGET_HOST="$PUBLIC_IP"
    fi
    
    print_status "Target: $TARGET_HOST"
    print_status "SSH Key: $SSH_KEY_PATH"
}

# Test SSH connection
test_connection() {
    print_header "Testing SSH connection..."

    print_status "Testing SSH connection to $PUBLIC_IP with key $SSH_KEY_PATH"

    # First, test if the key file exists and has correct permissions
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        print_error "SSH key not found: $SSH_KEY_PATH"
        print_error "Your existing instance might use a different SSH key"
        print_error "Please check which SSH key was used to create the instance"
        exit 1
    fi

    # Check key permissions
    local key_perms=$(stat -c "%a" "$SSH_KEY_PATH")
    if [[ "$key_perms" != "600" ]]; then
        print_warning "SSH key permissions are $key_perms, should be 600. Fixing..."
        chmod 600 "$SSH_KEY_PATH"
    fi

    # Test connection with timeout and better error reporting
    print_status "Attempting SSH connection..."

    if timeout 30 ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes ubuntu@$PUBLIC_IP "echo 'Connection successful'" 2>/tmp/ssh_error.log; then
        print_status "✅ SSH connection successful"
        return 0
    else
        print_error "❌ SSH connection failed"
        print_error "SSH error output:"
        cat /tmp/ssh_error.log 2>/dev/null || echo "No error log available"

        print_error ""
        print_error "Possible issues:"
        print_error "1. Wrong SSH key - your instance might use a different key"
        print_error "2. Instance not ready - try again in a few minutes"
        print_error "3. Security group blocking SSH (port 22)"
        print_error "4. Instance is in a different region/subnet"
        print_error ""
        print_error "To debug:"
        print_error "  ssh -i $SSH_KEY_PATH -v ubuntu@$PUBLIC_IP"

        exit 1
    fi
}

# Wait for cloud-init to complete
wait_for_cloud_init() {
    print_header "Waiting for cloud-init to complete..."
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'EOF'
        echo "Waiting for cloud-init to finish..."
        while [ ! -f /var/lib/cloud/instance/boot-finished ]; do
            echo "Cloud-init still running..."
            sleep 10
        done
        echo "✅ Cloud-init completed"
        
        # Verify Docker is running
        sudo systemctl status docker --no-pager
        
        # Verify Caddy is installed
        caddy version
EOF
    
    print_status "✅ Instance is ready for deployment"
}

# Create deployment package
create_deployment_package() {
    print_header "Creating deployment package..."
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    PACKAGE_NAME="pixelated-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    print_status "Packaging application..."
    
    # Create tarball excluding unnecessary files
    tar -czf "$TEMP_DIR/$PACKAGE_NAME" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=dist \
        --exclude=.astro \
        --exclude=.vite \
        --exclude=coverage \
        --exclude=test-results \
        --exclude=.oracle_deployment \
        --exclude="*.tar.gz" \
        .
    
    print_status "✅ Package created: $PACKAGE_NAME"
    echo "$TEMP_DIR/$PACKAGE_NAME"
}

# Upload and deploy application
deploy_application() {
    print_header "Uploading and deploying application..."
    
    local package_path=$(create_deployment_package)
    local package_name=$(basename "$package_path")
    
    # Upload package
    print_status "Uploading package to instance..."
    scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$package_path" ubuntu@$PUBLIC_IP:~/

    # Upload environment file if it exists
    if [[ -f ".env.oracle" ]]; then
        print_status "Uploading Oracle environment configuration..."
        scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ".env.oracle" ubuntu@$PUBLIC_IP:~/.env.production
    fi
    
    # Clean up local package
    rm -f "$package_path"
    
    # Deploy on remote instance
    print_status "Deploying application on instance..."
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << EOF
        set -e
        
        # Extract package
        echo "Extracting application..."
        rm -rf pixelated-old
        if [ -d pixelated ]; then
            mv pixelated pixelated-old
        fi
        mkdir -p pixelated
        tar -xzf $package_name -C pixelated
        cd pixelated
        
        # Stop existing container
        echo "Stopping existing container..."
        sudo docker stop $CONTAINER_NAME 2>/dev/null || true
        sudo docker rm $CONTAINER_NAME 2>/dev/null || true
        
        # Build and tag image for GitLab Container Registry
        echo "Building Docker image for GitLab Container Registry..."

        if [[ "$USE_GITLAB_REGISTRY" == "true" ]]; then
            # Get current git commit for tagging
            GIT_COMMIT=\$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
            IMAGE_TAG="$GITLAB_REGISTRY/$GITLAB_PROJECT:latest"
            COMMIT_TAG="$GITLAB_REGISTRY/$GITLAB_PROJECT:\$GIT_COMMIT"

            echo "Building image with tags:"
            echo "  Latest: $IMAGE_TAG"
            echo "  Commit: $COMMIT_TAG"

            # Build and tag for GitLab registry
            sudo docker build -t $APP_NAME:latest .
            sudo docker tag $APP_NAME:latest $IMAGE_TAG
            sudo docker tag $APP_NAME:latest $COMMIT_TAG

            echo "✅ Image built and tagged for GitLab Container Registry"
            echo "💡 To push to registry later: docker push $IMAGE_TAG"
        else
            # Build local image only
            echo "Building local image..."
            sudo docker build -t $APP_NAME:latest .
            echo "✅ Local image built"
        fi
        
        # Run new container with Pixelated Empathy environment
        echo "Starting new container..."

        # Build Docker run command with environment variables
        DOCKER_ENV_ARGS=""
        if [ -f ~/.env.production ]; then
            echo "Loading environment from .env.production..."
            DOCKER_ENV_ARGS="--env-file ~/.env.production"
        fi

        sudo docker run -d \\
            --name $CONTAINER_NAME \\
            --restart unless-stopped \\
            -p $PORT:$PORT \\
            \$DOCKER_ENV_ARGS \\
            -e NODE_ENV=production \\
            -e PORT=$PORT \\
            -e WEB_PORT=$PORT \\
            -e LOG_LEVEL=info \\
            -e ENABLE_RATE_LIMITING=true \\
            -e RATE_LIMIT_WINDOW=60 \\
            -e RATE_LIMIT_MAX_REQUESTS=100 \\
            -e ENABLE_HIPAA_COMPLIANCE=true \\
            -e ENABLE_AUDIT_LOGGING=true \\
            -e ENABLE_DATA_MASKING=true \\
            -e ASTRO_TELEMETRY_DISABLED=1 \\
            -e PUBLIC_URL=http://$TARGET_HOST \\
            -e CORS_ORIGINS=http://$TARGET_HOST,https://$TARGET_HOST \\
            $APP_NAME:latest
        
        # Wait for container to start
        sleep 10
        
        # Check container status
        if sudo docker ps | grep -q $CONTAINER_NAME; then
            echo "✅ Container is running"
        else
            echo "❌ Container failed to start"
            sudo docker logs $CONTAINER_NAME
            exit 1
        fi
        
        # Clean up old package
        rm -f ~/$package_name
EOF
    
    print_status "✅ Application deployed successfully"
}

# Configure Caddy
configure_caddy() {
    print_header "Configuring Caddy reverse proxy..."
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << EOF
        set -e
        
        # Create Caddyfile
        sudo tee /etc/caddy/Caddyfile > /dev/null << 'CADDY_EOF'
# Pixelated App Configuration
$TARGET_HOST {
    reverse_proxy localhost:$PORT
    
    # Enable compression
    encode gzip
    
    # Security headers
    header {
        # Enable HSTS
        Strict-Transport-Security max-age=31536000;
        # Prevent MIME sniffing
        X-Content-Type-Options nosniff
        # Prevent clickjacking
        X-Frame-Options DENY
        # XSS protection
        X-XSS-Protection "1; mode=block"
        # Referrer policy
        Referrer-Policy strict-origin-when-cross-origin
    }
    
    # Health check endpoint
    handle /api/health* {
        reverse_proxy localhost:$PORT
    }
    
    # Static assets with long cache
    handle /assets/* {
        reverse_proxy localhost:$PORT
        header Cache-Control "public, max-age=31536000, immutable"
    }
    
    # All other requests
    handle {
        reverse_proxy localhost:$PORT
    }
}
CADDY_EOF
        
        # Test and reload Caddy
        echo "Testing Caddy configuration..."
        sudo caddy validate --config /etc/caddy/Caddyfile
        
        echo "Reloading Caddy..."
        sudo systemctl reload caddy
        
        echo "✅ Caddy configured successfully"
EOF
    
    print_status "✅ Caddy configuration complete"
}

# Health check
perform_health_check() {
    print_header "Performing health check..."
    
    # Wait for services to stabilize
    sleep 15
    
    # Test direct container access
    print_status "Testing direct container access..."
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << EOF
        if curl -f http://localhost:$PORT > /dev/null 2>&1; then
            echo "✅ Container is responding"
        else
            echo "❌ Container is not responding"
            sudo docker logs $CONTAINER_NAME --tail 20
            exit 1
        fi
EOF
    
    # Test through Caddy
    print_status "Testing through Caddy..."
    if curl -f "http://$TARGET_HOST" > /dev/null 2>&1; then
        print_status "✅ Application is accessible through Caddy"
    else
        print_warning "⚠️  Application not accessible through Caddy yet (may need DNS propagation)"
    fi
    
    # Test health endpoint if it exists
    if curl -f "http://$TARGET_HOST/api/health/simple" > /dev/null 2>&1; then
        print_status "✅ Health endpoint is working"
    else
        print_warning "⚠️  Health endpoint not found (this may be normal)"
    fi
}

# Display deployment summary
show_summary() {
    print_header "🎉 Deployment Summary"
    
    echo ""
    print_status "Application: Pixelated"
    print_status "Target Host: $TARGET_HOST"
    print_status "Public IP: $PUBLIC_IP"
    print_status "Container: $CONTAINER_NAME"
    print_status "Port: $PORT"
    echo ""
    
    if [[ "$TARGET_HOST" != "$PUBLIC_IP" ]]; then
        print_status "🌐 Your app should be available at:"
        print_status "   https://$TARGET_HOST (with automatic SSL)"
        print_status "   http://$TARGET_HOST"
    else
        print_status "🌐 Your app is available at:"
        print_status "   http://$PUBLIC_IP"
        print_status ""
        print_status "💡 To enable HTTPS, point a domain to $PUBLIC_IP and redeploy with:"
        print_status "   ./scripts/deploy-app-to-oracle.sh yourdomain.com"
    fi
    
    echo ""
    print_status "🔧 Management commands:"
    print_status "   SSH: ssh -i $SSH_KEY_PATH ubuntu@$PUBLIC_IP"
    print_status "   Logs: sudo docker logs $CONTAINER_NAME"
    print_status "   Restart: sudo docker restart $CONTAINER_NAME"
    print_status "   Caddy logs: sudo journalctl -u caddy -f"
    echo ""
    
    print_status "🔄 To update your app:"
    print_status "   ./scripts/deploy-app-to-oracle.sh $TARGET_HOST"
}

# Main function
main() {
    print_header "🚀 Deploying Pixelated to Oracle Cloud..."
    
    load_deployment_info
    test_connection
    wait_for_cloud_init
    deploy_application
    configure_caddy
    perform_health_check
    show_summary
    
    print_status "🎉 Deployment completed successfully!"
}

main "$@"
