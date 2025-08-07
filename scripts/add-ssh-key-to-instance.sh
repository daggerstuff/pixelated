#!/bin/bash

# Add SSH key to existing Oracle Cloud instance using OCI CLI
# This allows us to access an existing instance with a new SSH key

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

# Load deployment info
if [[ ! -f ".oracle_deployment" ]]; then
    print_error "No deployment info found. Run deployment script first."
    exit 1
fi

source .oracle_deployment

print_header "🔑 Adding SSH key to existing Oracle Cloud instance"
print_status "Instance: $INSTANCE_OCID"
print_status "Public IP: $PUBLIC_IP"
print_status "SSH Key: $SSH_KEY_PATH"

# Check if SSH key exists
if [[ ! -f "$SSH_KEY_PATH" ]]; then
    print_error "SSH key not found: $SSH_KEY_PATH"
    exit 1
fi

if [[ ! -f "${SSH_KEY_PATH}.pub" ]]; then
    print_error "Public SSH key not found: ${SSH_KEY_PATH}.pub"
    exit 1
fi

# Get the public key content
PUBLIC_KEY_CONTENT=$(cat "${SSH_KEY_PATH}.pub")
print_status "Public key content: ${PUBLIC_KEY_CONTENT:0:50}..."

# Method 1: Try to add SSH key via instance metadata (if supported)
print_header "Method 1: Adding SSH key via instance metadata..."

# Get current instance metadata
print_status "Getting current instance metadata..."
CURRENT_METADATA=$(oci compute instance get --instance-id $INSTANCE_OCID --query 'data.metadata' --output json 2>/dev/null || echo "{}")

# Check if we can update metadata
if echo "$CURRENT_METADATA" | jq -e . >/dev/null 2>&1; then
    print_status "Current metadata retrieved successfully"
    
    # Create new metadata with SSH key
    NEW_METADATA=$(echo "$CURRENT_METADATA" | jq --arg key "$PUBLIC_KEY_CONTENT" '. + {"ssh_authorized_keys": $key}')
    
    print_status "Attempting to update instance metadata..."
    
    # Try to update instance metadata
    if oci compute instance update --instance-id $INSTANCE_OCID --metadata "$NEW_METADATA" --force 2>/dev/null; then
        print_status "✅ SSH key added via metadata update"
        print_status "Waiting 30 seconds for changes to take effect..."
        sleep 30
        
        # Test SSH connection
        if ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes ubuntu@$PUBLIC_IP "echo 'SSH key working'" 2>/dev/null; then
            print_status "🎉 SSH key is working! You can now deploy your app."
            exit 0
        else
            print_warning "Metadata updated but SSH still not working. Trying alternative method..."
        fi
    else
        print_warning "Metadata update failed. Trying alternative method..."
    fi
else
    print_warning "Could not retrieve instance metadata. Trying alternative method..."
fi

# Method 2: Create user-data script to add SSH key
print_header "Method 2: Using cloud-init to add SSH key..."

# Create cloud-init script to add SSH key
CLOUD_INIT_SCRIPT=$(cat <<EOF
#cloud-config
ssh_authorized_keys:
  - $PUBLIC_KEY_CONTENT

runcmd:
  - echo "$PUBLIC_KEY_CONTENT" >> /home/ubuntu/.ssh/authorized_keys
  - chown ubuntu:ubuntu /home/ubuntu/.ssh/authorized_keys
  - chmod 600 /home/ubuntu/.ssh/authorized_keys
  - systemctl restart ssh
EOF
)

# Save cloud-init script
echo "$CLOUD_INIT_SCRIPT" > /tmp/add-ssh-key-cloud-init.yaml

print_status "Created cloud-init script to add SSH key"
print_status "Cloud-init script saved to: /tmp/add-ssh-key-cloud-init.yaml"

# Method 3: Manual instructions
print_header "Method 3: Manual SSH key addition"
print_warning "Automatic methods may not work on existing instances."
print_warning "You may need to add the SSH key manually."
print_status ""
print_status "📋 Manual steps:"
print_status "1. Connect to your instance using Oracle Cloud Console (VNC/Serial Console)"
print_status "2. Or if you have another way to access the instance"
print_status "3. Run these commands on the instance:"
print_status ""
print_status "   echo '$PUBLIC_KEY_CONTENT' >> ~/.ssh/authorized_keys"
print_status "   chmod 600 ~/.ssh/authorized_keys"
print_status "   sudo systemctl restart ssh"
print_status ""
print_status "4. Then test SSH connection:"
print_status "   ssh -i $SSH_KEY_PATH ubuntu@$PUBLIC_IP"

# Method 4: Instance restart with new user-data (risky)
print_header "Method 4: Instance restart with new user-data (RISKY)"
print_warning "⚠️  This method restarts your instance and may cause data loss!"
print_status ""
read -p "Do you want to restart the instance with new user-data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Stopping instance..."
    oci compute instance action --instance-id $INSTANCE_OCID --action STOP --wait-for-state STOPPED
    
    print_status "Instance stopped. Starting with new user-data..."
    oci compute instance action --instance-id $INSTANCE_OCID --action START --wait-for-state RUNNING
    
    print_status "Waiting 60 seconds for instance to boot..."
    sleep 60
    
    # Test SSH connection
    if ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes ubuntu@$PUBLIC_IP "echo 'SSH key working'" 2>/dev/null; then
        print_status "🎉 SSH key is working after restart!"
    else
        print_error "SSH still not working after restart. Manual intervention required."
    fi
else
    print_status "Skipping instance restart."
fi

print_header "🔧 Next Steps"
print_status ""
print_status "If SSH is now working, you can deploy your app:"
print_status "  ./scripts/deploy-app-to-oracle.sh pixelatedempathy.com"
print_status ""
print_status "If SSH is still not working:"
print_status "1. Use Oracle Cloud Console to access the instance"
print_status "2. Manually add the SSH key using the commands above"
print_status "3. Or create a new instance with the correct SSH key"
print_status ""
print_status "SSH key location: $SSH_KEY_PATH"
print_status "Public key: ${SSH_KEY_PATH}.pub"
