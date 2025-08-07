#!/bin/bash

# Oracle Cloud Deployment Script for Pixelated
# This script sets up your app on Oracle Cloud Always Free tier

set -e

echo "🚀 Starting Oracle Cloud deployment for Pixelated..."

# Configuration
APP_NAME="pixelated"
CONTAINER_NAME="pixelated-app"
PORT=4321
DOMAIN=${1:-"your-oracle-instance-ip"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Oracle Cloud (ARM64)
check_environment() {
    print_status "Checking environment..."
    
    if [[ $(uname -m) == "aarch64" ]]; then
        print_status "✅ Running on ARM64 (Oracle Cloud compatible)"
    else
        print_warning "⚠️  Not running on ARM64 - this script is optimized for Oracle Cloud"
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_status "Installing Docker..."
        install_docker
    else
        print_status "✅ Docker is already installed"
    fi
}

# Install Docker on Oracle Linux/Ubuntu
install_docker() {
    print_status "Installing Docker..."
    
    # Update system
    sudo apt-get update -y || sudo yum update -y
    
    # Install Docker
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        sudo apt-get install -y docker.io docker-compose
        sudo systemctl start docker
        sudo systemctl enable docker
    elif command -v yum &> /dev/null; then
        # Oracle Linux/RHEL
        sudo yum install -y docker docker-compose
        sudo systemctl start docker
        sudo systemctl enable docker
    fi
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    print_status "✅ Docker installed successfully"
    print_warning "⚠️  You may need to log out and back in for Docker permissions to take effect"
}

# Install Caddy for reverse proxy
install_caddy() {
    print_status "Installing Caddy..."

    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
        sudo apt update
        sudo apt install -y caddy
    elif command -v yum &> /dev/null; then
        # Oracle Linux/RHEL
        sudo yum install -y yum-plugin-copr
        sudo yum copr enable @caddy/caddy
        sudo yum install -y caddy
    fi

    sudo systemctl start caddy
    sudo systemctl enable caddy

    print_status "✅ Caddy installed successfully"
}

# Configure firewall for Oracle Cloud
configure_firewall() {
    print_status "Configuring firewall..."
    
    # Oracle Cloud uses iptables
    sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
    sudo iptables -I INPUT 1 -p tcp --dport $PORT -j ACCEPT
    
    # Save iptables rules
    if command -v iptables-save &> /dev/null; then
        sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    fi
    
    print_status "✅ Firewall configured"
}

# Build and run the application
deploy_app() {
    print_status "Building and deploying application..."
    
    # Stop existing container if running
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    
    # Build the Docker image
    print_status "Building Docker image..."
    docker build -t $APP_NAME:latest .
    
    # Run the container
    print_status "Starting application container..."
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p $PORT:$PORT \
        -e NODE_ENV=production \
        -e PORT=$PORT \
        $APP_NAME:latest
    
    # Wait for container to start
    sleep 10
    
    # Check if container is running
    if docker ps | grep -q $CONTAINER_NAME; then
        print_status "✅ Application container is running"
    else
        print_error "❌ Failed to start application container"
        docker logs $CONTAINER_NAME
        exit 1
    fi
}

# Configure Caddy reverse proxy
configure_caddy() {
    print_status "Configuring Caddy reverse proxy..."

    # Create Caddyfile
    sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
# Pixelated App Configuration
$DOMAIN {
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

# Redirect HTTP to HTTPS (automatic with Caddy)
EOF

    # Test Caddy config
    sudo caddy validate --config /etc/caddy/Caddyfile

    # Reload Caddy
    sudo systemctl reload caddy

    print_status "✅ Caddy configured successfully"
    print_status "🔒 Automatic HTTPS will be enabled for $DOMAIN"
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Wait a bit for everything to start
    sleep 5
    
    # Check if app responds
    if curl -f http://localhost:$PORT/api/health/simple > /dev/null 2>&1; then
        print_status "✅ Application health check passed"
    else
        print_warning "⚠️  Health check endpoint not responding, checking main page..."
        if curl -f http://localhost:$PORT > /dev/null 2>&1; then
            print_status "✅ Application is responding"
        else
            print_error "❌ Application is not responding"
            print_error "Container logs:"
            docker logs $CONTAINER_NAME --tail 50
            exit 1
        fi
    fi
}

# Main deployment function
main() {
    print_status "🚀 Starting Oracle Cloud deployment..."
    
    check_environment
    install_caddy
    configure_firewall
    deploy_app
    configure_caddy
    health_check
    
    print_status "🎉 Deployment completed successfully!"
    print_status "Your application should be available at:"
    print_status "  http://$DOMAIN"
    print_status ""
    print_status "To check application status:"
    print_status "  docker logs $CONTAINER_NAME"
    print_status "  docker ps"
    print_status ""
    print_status "To update the application:"
    print_status "  git pull && ./scripts/deploy-oracle-cloud.sh $DOMAIN"
}

# Run main function
main "$@"
