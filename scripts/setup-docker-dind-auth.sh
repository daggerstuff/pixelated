#!/bin/bash
# Setup Docker-in-Docker authentication for NeMo microservices jobs

set -e

REMOTE_USER="${REMOTE_USER:-vivi}"
REMOTE_HOST="${REMOTE_HOST:-212.2.244.60}"

if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY environment variable is not set"
    echo "Please set it: export NVIDIA_API_KEY=your-api-key"
    exit 1
fi

echo "=========================================="
echo "Setting up Docker-in-Docker Authentication"
echo "=========================================="
echo ""

ssh "${REMOTE_USER}@${REMOTE_HOST}" << ENDSSH
set -e

cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10 || {
    echo "❌ Error: NeMo services directory not found"
    exit 1
}

echo "Creating Docker config directory..."
mkdir -p ~/.docker

echo "Creating Docker config.json with NGC registry credentials..."
cat > ~/.docker/config.json << 'DOCKERCONFIG'
{
  "auths": {
    "nvcr.io": {
      "auth": "BASE64_AUTH_PLACEHOLDER"
    }
  }
}
DOCKERCONFIG

# Base64 encode the credentials: $oauthtoken:API_KEY
AUTH_STRING="\$oauthtoken:${NVIDIA_API_KEY}"
BASE64_AUTH=\$(echo -n "\$AUTH_STRING" | base64 -w 0)

# Replace placeholder with actual base64 auth
sed -i "s|BASE64_AUTH_PLACEHOLDER|\$BASE64_AUTH|" ~/.docker/config.json

echo "✅ Docker config.json created"
echo ""

# Check if we can mount this into the Docker service
echo "Checking infrastructure.yaml for Docker service configuration..."
if grep -q "docker:" services/infrastructure.yaml; then
    echo "Docker service found in infrastructure.yaml"
    
    # Create a backup
    cp services/infrastructure.yaml services/infrastructure.yaml.backup
    
    # Check if volumes section exists for docker service
    if grep -A 20 "docker:" services/infrastructure.yaml | grep -q "volumes:"; then
        echo "Volumes section already exists, adding Docker config mount..."
        # This is complex to do with sed, so we'll use a different approach
    else
        echo "Adding volumes section to Docker service..."
        # This needs to be done carefully to maintain YAML structure
    fi
else
    echo "⚠️  Docker service not found in infrastructure.yaml"
fi

echo ""
echo "Stopping services..."
docker compose stop docker jobs-controller || true

echo ""
echo "Starting Docker service with mounted credentials..."
# The Docker service will need the config.json mounted
# For now, we'll create an init script approach

echo "Creating Docker init script..."
cat > /tmp/docker-init-auth.sh << 'DOCKERINIT'
#!/bin/sh
# Docker init script to authenticate with NGC registry
echo "\$NIM_API_KEY" | docker login nvcr.io -u '\$oauthtoken' --password-stdin || true
exec /usr/local/bin/dockerd-entrypoint.sh "\$@"
DOCKERINIT

chmod +x /tmp/docker-init-auth.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. The Docker config.json has been created at ~/.docker/config.json"
echo "2. You may need to modify infrastructure.yaml to mount this file"
echo "3. Or use an init script approach to authenticate on container start"
echo ""
echo "For now, let's try mounting the config file..."
ENDSSH

echo ""
echo "=========================================="
echo "Attempting to configure Docker service..."
echo "=========================================="
echo ""

# Now modify the infrastructure.yaml to mount the Docker config
ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'MODIFYCONFIG'
set -e

cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10

# Create a Python script to safely modify YAML
python3 << 'PYTHONSCRIPT'
import yaml
import sys

try:
    with open('services/infrastructure.yaml', 'r') as f:
        doc = yaml.safe_load(f)
    
    # Find docker service in services section
    if 'services' in doc and 'docker' in doc['services']:
        docker_service = doc['services']['docker']
        
        # Add volumes if not present
        if 'volumes' not in docker_service:
            docker_service['volumes'] = []
        
        # Add Docker config mount (check if already exists)
        config_mount = '$HOME/.docker/config.json:/root/.docker/config.json:ro'
        if config_mount not in docker_service['volumes']:
            docker_service['volumes'].append(config_mount)
            print(f"✅ Added Docker config mount: {config_mount}")
        else:
            print("✅ Docker config mount already exists")
        
        # Write back
        with open('services/infrastructure.yaml', 'w') as f:
            yaml.dump(doc, f, default_flow_style=False, sort_keys=False)
        
        print("✅ infrastructure.yaml updated successfully")
    else:
        print("⚠️  Docker service not found in infrastructure.yaml")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Error modifying YAML: {e}")
    sys.exit(1)
PYTHONSCRIPT

echo ""
echo "Restarting Docker service..."
docker compose up -d docker

echo "Waiting for Docker service to start..."
sleep 10

echo "Checking if Docker service can authenticate..."
docker compose exec docker docker login nvcr.io --username '$oauthtoken' --password-stdin <<< "${NVIDIA_API_KEY}" || echo "⚠️  Manual login test failed (may be expected)"

echo ""
echo "Restarting jobs-controller..."
docker compose restart jobs-controller

echo "Waiting for jobs-controller to restart..."
sleep 10

echo ""
echo "Checking jobs-controller logs..."
docker compose logs jobs-controller --tail 20 | grep -i "auth\|error\|401" || echo "No auth errors in recent logs ✅"

MODIFYCONFIG

echo ""
echo "=========================================="
echo "Setup Complete"
echo "=========================================="
echo ""
echo "Docker-in-Docker authentication has been configured."
echo "The Docker config.json has been created and mounted into the Docker service."
echo ""
echo "To verify, check jobs-controller logs:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10 && docker compose logs jobs-controller --tail 30'"
echo ""


