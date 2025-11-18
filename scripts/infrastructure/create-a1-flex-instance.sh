#!/bin/bash
# Create VM.Standard.A1.Flex instance on Oracle Cloud Infrastructure
# This script helps you create your first A1.Flex instance

set -e

echo "🚀 Creating VM.Standard.A1.Flex Instance"
echo "=========================================="
echo ""

# Get tenancy OCID from config or prompt
TENANCY_OCID=$(cat ~/.oci/config 2>/dev/null | grep "^tenancy=" | cut -d'=' -f2 | tr -d ' ' || echo "")
if [ -z "$TENANCY_OCID" ]; then
    echo "⚠️  Could not find tenancy OCID in ~/.oci/config"
    echo "Please enter your tenancy OCID (ocid1.tenancy.oc1..):"
    read -r TENANCY_OCID
fi

# Get region
REGION=$(cat ~/.oci/config 2>/dev/null | grep "^region=" | cut -d'=' -f2 | tr -d ' ' || echo "us-ashburn-1")
echo "📍 Using region: $REGION"
echo "📍 Using tenancy (compartment): $TENANCY_OCID"
echo ""

# Get availability domain
echo "🔍 Getting availability domains..."
AD_LIST=$(oci iam availability-domain list --query 'data[*].name' --output json 2>/dev/null | jq -r '.[0]')
if [ -z "$AD_LIST" ] || [ "$AD_LIST" = "null" ]; then
    echo "❌ Error: Could not get availability domains. Please check your OCI configuration."
    exit 1
fi
AVAILABILITY_DOMAIN=$(echo "$AD_LIST" | head -1)
echo "✅ Using availability domain: $AVAILABILITY_DOMAIN"
echo ""

# Check for existing VCN
echo "🔍 Checking for existing VCN..."
EXISTING_VCN=$(oci network vcn list --compartment-id "$TENANCY_OCID" --all --output json 2>&1 | jq -r '.data[0].id // empty' 2>/dev/null || echo "")

if [ -z "$EXISTING_VCN" ]; then
    echo "⚠️  No VCN found. Creating a new VCN..."
    VCN_NAME="a1-flex-vcn-$(date +%s)"
    echo "Creating VCN: $VCN_NAME"
    
    VCN_RESULT=$(oci network vcn create \
        --compartment-id "$TENANCY_OCID" \
        --cidr-block "10.0.0.0/16" \
        --display-name "$VCN_NAME" \
        --dns-label "a1flex$(date +%s | tail -c 6)" \
        --output json 2>&1)
    
    if echo "$VCN_RESULT" | grep -q "ServiceError"; then
        echo "❌ Error creating VCN:"
        echo "$VCN_RESULT" | jq -r '.message' 2>/dev/null || echo "$VCN_RESULT"
        exit 1
    fi
    
    VCN_ID=$(echo "$VCN_RESULT" | jq -r '.data.id' 2>/dev/null)
    echo "✅ Created VCN: $VCN_ID"
    
    # Wait for VCN to be available
    echo "⏳ Waiting for VCN to be ready..."
    sleep 5
    
    # Create Internet Gateway
    echo "Creating Internet Gateway..."
    IGW_NAME="a1-flex-igw-$(date +%s)"
    IGW_RESULT=$(oci network internet-gateway create \
        --compartment-id "$TENANCY_OCID" \
        --vcn-id "$VCN_ID" \
        --display-name "$IGW_NAME" \
        --is-enabled true \
        --output json 2>&1)
    
    IGW_ID=$(echo "$IGW_RESULT" | jq -r '.data.id' 2>/dev/null)
    echo "✅ Created Internet Gateway: $IGW_ID"
    
    # Get default route table
    RT_ID=$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-route-table-id"' --raw-output 2>/dev/null)
    
    # Add route to internet gateway
    echo "Adding route to Internet Gateway..."
    oci network route-table update \
        --rt-id "$RT_ID" \
        --route-rules "[{\"networkEntityId\":\"$IGW_ID\",\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\"}]" \
        --force > /dev/null 2>&1 || true
    
    # Create public subnet
    echo "Creating public subnet..."
    SUBNET_NAME="a1-flex-subnet-$(date +%s)"
    SUBNET_RESULT=$(oci network subnet create \
        --compartment-id "$TENANCY_OCID" \
        --vcn-id "$VCN_ID" \
        --availability-domain "$AVAILABILITY_DOMAIN" \
        --cidr-block "10.0.1.0/24" \
        --display-name "$SUBNET_NAME" \
        --dns-label "a1subnet$(date +%s | tail -c 6)" \
        --output json 2>&1)
    
    if echo "$SUBNET_RESULT" | grep -q "ServiceError"; then
        echo "❌ Error creating subnet:"
        echo "$SUBNET_RESULT" | jq -r '.message' 2>/dev/null || echo "$SUBNET_RESULT"
        exit 1
    fi
    
    SUBNET_ID=$(echo "$SUBNET_RESULT" | jq -r '.data.id' 2>/dev/null)
    echo "✅ Created subnet: $SUBNET_ID"
    
    # Get default security list
    SL_ID=$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-security-list-id"' --raw-output 2>/dev/null)
    
    # Add SSH rule to security list
    echo "Adding SSH rule to security list..."
    oci network security-list update \
        --security-list-id "$SL_ID" \
        --ingress-security-rules "[{\"protocol\":\"6\",\"source\":\"0.0.0.0/0\",\"isStateless\":false,\"tcpOptions\":{\"destinationPortRange\":{\"min\":22,\"max\":22}}}]" \
        --force > /dev/null 2>&1 || true
    
    sleep 3
else
    echo "✅ Found existing VCN: $EXISTING_VCN"
    VCN_ID="$EXISTING_VCN"
    
    # Get subnet from existing VCN
    echo "🔍 Finding subnet in VCN..."
    SUBNET_ID=$(oci network subnet list --compartment-id "$TENANCY_OCID" --vcn-id "$VCN_ID" --output json 2>&1 | jq -r '.data[0].id // empty' 2>/dev/null || echo "")
    
    if [ -z "$SUBNET_ID" ]; then
        echo "⚠️  No subnet found. Creating subnet..."
        SUBNET_NAME="a1-flex-subnet-$(date +%s)"
        SUBNET_RESULT=$(oci network subnet create \
            --compartment-id "$TENANCY_OCID" \
            --vcn-id "$VCN_ID" \
            --availability-domain "$AVAILABILITY_DOMAIN" \
            --cidr-block "10.0.1.0/24" \
            --display-name "$SUBNET_NAME" \
            --output json 2>&1)
        
        SUBNET_ID=$(echo "$SUBNET_RESULT" | jq -r '.data.id' 2>/dev/null)
        echo "✅ Created subnet: $SUBNET_ID"
    else
        echo "✅ Using existing subnet: $SUBNET_ID"
    fi
fi

echo ""
echo "🔍 Finding Oracle Linux image for A1.Flex..."
# Get Oracle Linux 8 image for A1.Flex
IMAGE_ID=$(oci compute image list \
    --compartment-id "$TENANCY_OCID" \
    --operating-system "Oracle Linux" \
    --operating-system-version "8" \
    --shape "VM.Standard.A1.Flex" \
    --sort-by TIMECREATED \
    --sort-order DESC \
    --query 'data[0].id' \
    --raw-output 2>/dev/null || echo "")

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo "⚠️  Could not find Oracle Linux 8 image. Trying generic search..."
    IMAGE_ID=$(oci compute image list \
        --compartment-id "$TENANCY_OCID" \
        --shape "VM.Standard.A1.Flex" \
        --sort-by TIMECREATED \
        --sort-order DESC \
        --query 'data[0].id' \
        --raw-output 2>/dev/null || echo "")
fi

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo "❌ Could not find a suitable image. Please specify an image OCID:"
    read -r IMAGE_ID
fi

echo "✅ Using image: $IMAGE_ID"
echo ""

# Generate SSH key if it doesn't exist
SSH_KEY_FILE="$HOME/.ssh/oci_a1_flex_key"
if [ ! -f "$SSH_KEY_FILE" ]; then
    echo "🔑 Generating SSH key pair..."
    mkdir -p "$HOME/.ssh"
    ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_FILE" -N "" -C "oci-a1-flex-instance"
    echo "✅ SSH key created: $SSH_KEY_FILE"
fi

PUBLIC_KEY=$(cat "${SSH_KEY_FILE}.pub")

echo ""
echo "📋 Instance Configuration:"
echo "   Shape: VM.Standard.A1.Flex"
echo "   OCPUs: 4"
echo "   Memory: 24 GB"
echo "   Availability Domain: $AVAILABILITY_DOMAIN"
echo "   Subnet: $SUBNET_ID"
echo ""

# Prompt for confirmation
read -p "Create instance? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled."
    exit 1
fi

echo ""
echo "🚀 Creating instance..."
INSTANCE_NAME="a1-flex-instance-$(date +%s)"

INSTANCE_RESULT=$(oci compute instance launch \
    --compartment-id "$TENANCY_OCID" \
    --availability-domain "$AVAILABILITY_DOMAIN" \
    --shape "VM.Standard.A1.Flex" \
    --shape-config "{\"ocpus\": 4, \"memory-in-gbs\": 24}" \
    --display-name "$INSTANCE_NAME" \
    --image-id "$IMAGE_ID" \
    --subnet-id "$SUBNET_ID" \
    --assign-public-ip true \
    --metadata "{\"ssh_authorized_keys\": \"$PUBLIC_KEY\"}" \
    --output json 2>&1)

if echo "$INSTANCE_RESULT" | grep -q "ServiceError"; then
    echo "❌ Error creating instance:"
    echo "$INSTANCE_RESULT" | jq -r '.message' 2>/dev/null || echo "$INSTANCE_RESULT"
    exit 1
fi

INSTANCE_ID=$(echo "$INSTANCE_RESULT" | jq -r '.data.id' 2>/dev/null)
INSTANCE_OCID=$(echo "$INSTANCE_RESULT" | jq -r '.data."lifecycle-state"' 2>/dev/null)

echo "✅ Instance created successfully!"
echo ""
echo "📝 Instance Details:"
echo "   Instance OCID: $INSTANCE_ID"
echo "   Instance Name: $INSTANCE_NAME"
echo "   State: $INSTANCE_OCID"
echo ""
echo "⏳ Waiting for instance to be running..."
sleep 10

# Get instance public IP
PUBLIC_IP=$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" --query 'data[0]."public-ip"' --raw-output 2>/dev/null || echo "")

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" = "null" ]; then
    echo "⏳ Waiting for public IP assignment..."
    sleep 15
    PUBLIC_IP=$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" --query 'data[0]."public-ip"' --raw-output 2>/dev/null || echo "")
fi

echo ""
echo "🎉 Instance is ready!"
echo "===================="
echo "Instance OCID: $INSTANCE_ID"
echo "Public IP: ${PUBLIC_IP:-Not assigned yet}"
echo "SSH Key: $SSH_KEY_FILE"
echo ""
if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ]; then
    echo "To connect:"
    echo "  ssh -i $SSH_KEY_FILE opc@$PUBLIC_IP"
else
    echo "To get the public IP later, run:"
    echo "  oci compute instance list-vnics --instance-id $INSTANCE_ID --query 'data[0].\"public-ip\"' --raw-output"
fi
echo ""
echo "To check instance status:"
echo "  oci compute instance get --instance-id $INSTANCE_ID"
echo ""

