#!/bpassin/bash
# Multi-region A1.Flex instance creation with automatic retry loop
# Tries all available OCI regions and retries every 6 hours until successful

set +e  # Don't exit on error, we handle errors manually

TENANCY_ID="ocid1.tenancy.oc1..aaaaaaaaf7kzx4gvgyjxft6hacpx6d2xigbylolx2gwizor3dpxyaj24j2wa"
LOG_FILE="$HOME/.oci/a1-flex-instance-creation.log"
RETRY_INTERVAL_HOURS=6
RETRY_INTERVAL_SECONDS=$((RETRY_INTERVAL_HOURS * 3600))

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" >&2
}

# Generate SSH key if it doesn't exist
SSH_KEY_FILE="$HOME/.ssh/oci_a1_flex_key"
if [ ! -f "$SSH_KEY_FILE" ]; then
    log "🔑 Generating SSH key pair..."
    mkdir -p "$HOME/.ssh"
    ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_FILE" -N "" -C "oci-a1-flex-instance"
    log "✅ SSH key created: $SSH_KEY_FILE"
fi

PUBLIC_KEY=$(cat "${SSH_KEY_FILE}.pub")

# Function to get or create VCN in a region
get_or_create_vcn() {
    local region=$1
    local vcn_name="a1-flex-vcn-${region}"
    
    # Set region context
    export OCI_CLI_PROFILE="DEFAULT"
    export OCI_CLI_REGION="$region"
    
    log "🔍 Checking for VCN in region: $region"
    
    # Try to find existing VCN
    EXISTING_VCN=$(oci network vcn list \
        --compartment-id "$TENANCY_ID" \
        --all \
        --output json 2>/dev/null | jq -r '.data[] | select(.["display-name"] == "'"$vcn_name"'" or .["display-name"] == "pixelated-empathy-vcn") | .id' 2>/dev/null | head -1)
    
    if [ -n "$EXISTING_VCN" ] && [ "$EXISTING_VCN" != "null" ]; then
        log "✅ Found existing VCN: $EXISTING_VCN"
        echo "$EXISTING_VCN"
        return 0
    fi
    
    # Create new VCN
    log "Creating VCN: $vcn_name"
    VCN_RESULT=$(oci network vcn create \
        --compartment-id "$TENANCY_ID" \
        --cidr-block "10.0.0.0/16" \
        --display-name "$vcn_name" \
        --dns-label "a1flex$(echo "$region" | tr -d '-' | tr '[:upper:]' '[:lower:]' | cut -c1-6)" \
        --output json 2>&1)
    
    if echo "$VCN_RESULT" | grep -q "ServiceError"; then
        ERROR_MSG=$(echo "$VCN_RESULT" | jq -r '.message' 2>/dev/null || echo "$VCN_RESULT")
        log "❌ Failed to create VCN: $ERROR_MSG"
        echo ""
        return 1
    fi
    
    VCN_ID=$(echo "$VCN_RESULT" | jq -r '.data.id' 2>/dev/null)
    
    if [ -z "$VCN_ID" ] || [ "$VCN_ID" = "null" ]; then
        log "❌ Failed to get VCN ID"
        echo ""
        return 1
    fi
    
    log "✅ Created VCN: $VCN_ID"
    sleep 5
    
    # Create Internet Gateway
    log "Creating Internet Gateway..."
    IGW_NAME="a1-flex-igw-${region}"
    IGW_RESULT=$(oci network internet-gateway create \
        --compartment-id "$TENANCY_ID" \
        --vcn-id "$VCN_ID" \
        --display-name "$IGW_NAME" \
        --is-enabled true \
        --output json 2>&1)
    
    IGW_ID=$(echo "$IGW_RESULT" | jq -r '.data.id' 2>/dev/null)
    if [ -n "$IGW_ID" ] && [ "$IGW_ID" != "null" ]; then
        log "✅ Created Internet Gateway: $IGW_ID"
        
        # Add route to internet gateway
        RT_ID=$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-route-table-id"' --raw-output 2>/dev/null)
        if [ -n "$RT_ID" ]; then
            oci network route-table update \
                --rt-id "$RT_ID" \
                --route-rules "[{\"networkEntityId\":\"$IGW_ID\",\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\"}]" \
                --force > /dev/null 2>&1 || true
        fi
    fi
    
    # Add SSH rule to default security list
    SL_ID=$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-security-list-id"' --raw-output 2>/dev/null)
    if [ -n "$SL_ID" ]; then
        oci network security-list update \
            --security-list-id "$SL_ID" \
            --ingress-security-rules "[{\"protocol\":\"6\",\"source\":\"0.0.0.0/0\",\"isStateless\":false,\"tcpOptions\":{\"destinationPortRange\":{\"min\":22,\"max\":22}}}]" \
            --force > /dev/null 2>&1 || true
    fi
    
    echo "$VCN_ID"
    return 0
}

# Function to get or create subnet in a region
get_or_create_subnet() {
    local region=$1
    local vcn_id=$2
    local ad=$3
    
    log "Checking subnet for VCN: $vcn_id, AD: $ad"
    
    # Try to find existing Regional Subnet (preferred) or AD-specific subnet
    SUBNET_ID=$(oci network subnet list \
        --compartment-id "$TENANCY_ID" \
        --vcn-id "$vcn_id" \
        --output json 2>&1 | jq -r --arg ad "$ad" '.data[] | select(.["availability-domain"] == null or .["availability-domain"] == $ad) | .id' 2>/dev/null | head -1)
    
    if [ -n "$SUBNET_ID" ] && [ "$SUBNET_ID" != "null" ]; then
        log "✅ Using existing subnet: $SUBNET_ID"
        echo "$SUBNET_ID"
        return 0
    fi
    
    # Get existing subnets to find available CIDR
    # Remove 2>/dev/null to see errors in logs
    EXISTING_SUBNETS_JSON=$(oci network subnet list \
        --compartment-id "$TENANCY_ID" \
        --vcn-id "$vcn_id" \
        --output json 2>&1)
        
    if echo "$EXISTING_SUBNETS_JSON" | grep -q "ServiceError"; then
        log "❌ Failed to list subnets: $EXISTING_SUBNETS_JSON"
        return 1
    fi
    
    EXISTING_CIDRS=$(echo "$EXISTING_SUBNETS_JSON" | jq -r '.data[]."cidr-block"' 2>/dev/null || echo "")
    log "Existing CIDRs: $(echo "$EXISTING_CIDRS" | tr '\n' ' ')"
    
    # Find available CIDR block
    SUBNET_CIDR=""
    for i in {1..20}; do
        TEST_CIDR="10.0.$i.0/24"
        if ! echo "$EXISTING_CIDRS" | grep -q "$TEST_CIDR"; then
            SUBNET_CIDR="$TEST_CIDR"
            break
        fi
    done
    
    if [ -z "$SUBNET_CIDR" ]; then
        log "❌ Could not find available CIDR block"
        echo ""
        return 1
    fi
    
    log "Creating Regional Subnet: $SUBNET_CIDR"
    SUBNET_RESULT=$(oci network subnet create \
        --compartment-id "$TENANCY_ID" \
        --vcn-id "$vcn_id" \
        --cidr-block "$SUBNET_CIDR" \
        --display-name "a1-flex-regional-subnet-${region}" \
        --output json 2>&1)
    
    # Check exit code via grep (since we captured output)
    if echo "$SUBNET_RESULT" | grep -q "ServiceError\|InvalidParameter\|Conflict"; then
        ERROR_MSG=$(echo "$SUBNET_RESULT" | jq -r '.message // .code // "Unknown error"' 2>/dev/null | head -1)
        log "❌ Failed to create subnet: $ERROR_MSG"
        log "Full response: $SUBNET_RESULT"
        echo ""
        return 1
    fi
    
    SUBNET_ID=$(echo "$SUBNET_RESULT" | jq -r '.data.id' 2>/dev/null)
    
    if [ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" = "null" ]; then
        log "❌ Failed to get Subnet ID from response"
        log "Response: $SUBNET_RESULT"
        echo ""
        return 1
    fi
    
    log "✅ Created subnet: $SUBNET_ID"
    sleep 3
    
    echo "$SUBNET_ID"
    return 0
}

# Function to get image ID for a region
get_image_id() {
    local region=$1
    
    # Try Oracle Linux 8/9 for A1.Flex (ARM64)
    IMAGE_ID=$(oci compute image list \
        --compartment-id "$TENANCY_ID" \
        --operating-system "Oracle Linux" \
        --shape "VM.Standard.A1.Flex" \
        --sort-by TIMECREATED \
        --sort-order DESC \
        --query 'data[0].id' \
        --raw-output 2>/dev/null || echo "")
    
    if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
        # Try generic search
        IMAGE_ID=$(oci compute image list \
            --compartment-id "$TENANCY_ID" \
            --shape "VM.Standard.A1.Flex" \
            --sort-by TIMECREATED \
            --sort-order DESC \
            --query 'data[0].id' \
            --raw-output 2>/dev/null || echo "")
    fi
    
    echo "$IMAGE_ID"
}

# Function to try creating instance in a region
try_region() {
    local region=$1
    
    log "=========================================="
    log "🌍 Trying region: $region"
    log "=========================================="
    
    # Set region context and profile
    export OCI_CLI_PROFILE="DEFAULT"
    export OCI_CLI_REGION="$region"
    
    # Get availability domains for this region
    AD_RESULT=$(oci iam availability-domain list --query 'data[*].name' --raw-output 2>&1)
    if echo "$AD_RESULT" | grep -q "ServiceError\|NotAuthenticated\|Unauthorized"; then
        ERROR_MSG=$(echo "$AD_RESULT" | jq -r '.message // .' 2>/dev/null | head -3)
        log "❌ Authentication/API error for region $region: $ERROR_MSG"
        return 1
    fi
    ADS=$(echo "$AD_RESULT" | jq -r '.[]' 2>/dev/null || echo "")
    
    if [ -z "$ADS" ]; then
        log "❌ Could not get availability domains for region: $region"
        log "   Response: ${AD_RESULT:0:200}"
        return 1
    fi
    
    AD_COUNT=$(echo "$ADS" | wc -l)
    log "Found $AD_COUNT availability domains in $region"
    
    # Get or create VCN
    VCN_ID=$(get_or_create_vcn "$region")
    if [ -z "$VCN_ID" ]; then
        log "❌ Failed to get/create VCN for region: $region"
        return 1
    fi
    
    # Get image ID
    IMAGE_ID=$(get_image_id "$region")
    if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
        log "❌ Could not find suitable image for region: $region"
        return 1
    fi
    
    log "Using image: $IMAGE_ID"
    
    # Try each availability domain
    for AD in $ADS; do
        log "📍 Trying $AD..."
        
        # Get or create subnet
        SUBNET_ID=$(get_or_create_subnet "$region" "$VCN_ID" "$AD")
        if [ -z "$SUBNET_ID" ]; then
            log "⚠️  Skipping $AD - could not get/create subnet"
            continue
        fi
        
        INSTANCE_NAME="a1-flex-${region}-$(date +%s)"
        
        # Try 4 OCPUs first
        log "   Creating instance with 4 OCPUs, 24GB RAM..."
        RESULT=$(oci compute instance launch \
            --compartment-id "$TENANCY_ID" \
            --availability-domain "$AD" \
            --shape "VM.Standard.A1.Flex" \
            --shape-config '{"ocpus": 4, "memory-in-gbs": 24}' \
            --display-name "$INSTANCE_NAME" \
            --image-id "$IMAGE_ID" \
            --subnet-id "$SUBNET_ID" \
            --assign-public-ip true \
            --metadata "{\"ssh_authorized_keys\": \"$PUBLIC_KEY\"}" \
            --output json 2>&1)
        
        # If out of capacity, try 2 OCPUs
        if echo "$RESULT" | grep -q "Out of host capacity"; then
            log "   Trying with 2 OCPUs, 12GB RAM instead..."
            RESULT=$(oci compute instance launch \
                --compartment-id "$TENANCY_ID" \
                --availability-domain "$AD" \
                --shape "VM.Standard.A1.Flex" \
                --shape-config '{"ocpus": 2, "memory-in-gbs": 12}' \
                --display-name "$INSTANCE_NAME" \
                --image-id "$IMAGE_ID" \
                --subnet-id "$SUBNET_ID" \
                --assign-public-ip true \
                --metadata "{\"ssh_authorized_keys\": \"$PUBLIC_KEY\"}" \
                --output json 2>&1)
        fi
        
        if echo "$RESULT" | grep -q '"id"'; then
            INSTANCE_ID=$(echo "$RESULT" | jq -r '.data.id' 2>/dev/null)
            INSTANCE_STATE=$(echo "$RESULT" | jq -r '.data."lifecycle-state"' 2>/dev/null)
            INSTANCE_SHAPE=$(echo "$RESULT" | jq -r '.data.shape-config // "{}"' 2>/dev/null)
            OCPUS=$(echo "$INSTANCE_SHAPE" | jq -r '.ocpus // 4' 2>/dev/null)
            MEMORY=$(echo "$INSTANCE_SHAPE" | jq -r '."memory-in-gbs" // 24' 2>/dev/null)
            
            log ""
            log "✅✅✅ SUCCESS! ✅✅✅"
            log "=========================================="
            log "Instance created in region: $region"
            log "Availability Domain: $AD"
            log "Instance OCID: $INSTANCE_ID"
            log "Instance Name: $INSTANCE_NAME"
            log "State: $INSTANCE_STATE"
            log "Shape: VM.Standard.A1.Flex ($OCPUS OCPUs, $MEMORY GB RAM)"
            log ""
            
            # Wait and get public IP
            log "⏳ Waiting for public IP assignment..."
            sleep 15
            PUBLIC_IP=$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" --query 'data[0]."public-ip"' --raw-output 2>/dev/null || echo "")
            
            if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ]; then
                log "Public IP: $PUBLIC_IP"
                log "SSH Key: $SSH_KEY_FILE"
                log ""
                log "To connect via SSH:"
                log "  ssh -i $SSH_KEY_FILE opc@$PUBLIC_IP"
            else
                log "Public IP: Not assigned yet (check later with):"
                log "  oci compute instance list-vnics --instance-id $INSTANCE_ID"
            fi
            
            log ""
            log "To check instance status:"
            log "  oci compute instance get --instance-id $INSTANCE_ID --region $region"
            log ""
            
            # Send notification (you can customize this)
            if command -v notify-send &> /dev/null; then
                notify-send "OCI A1.Flex Instance Created!" "Instance $INSTANCE_NAME created in $region"
            fi
            
            return 0
            
        elif echo "$RESULT" | grep -q "Out of host capacity"; then
            log "   ❌ $AD: Out of capacity"
        else
            # Extract error message - try multiple ways
            if echo "$RESULT" | grep -q "ServiceError"; then
                ERROR_MSG=$(echo "$RESULT" | jq -r '.message // .code // .' 2>/dev/null | head -1)
                ERROR_CODE=$(echo "$RESULT" | jq -r '.code // ""' 2>/dev/null | head -1)
                if [ -n "$ERROR_MSG" ] && [ "$ERROR_MSG" != "null" ]; then
                    log "   ❌ $AD: $ERROR_CODE - $ERROR_MSG"
                else
                    log "   ❌ $AD: ServiceError (check full response below)"
                    log "   Full response: ${RESULT:0:500}"
                fi
            else
                # Not a ServiceError, log the raw response
                ERROR_PREVIEW=$(echo "$RESULT" | head -5 | tr '\n' ' ' | cut -c1-200)
                log "   ❌ $AD: Unexpected error - $ERROR_PREVIEW"
            fi
        fi
    done
    
    log "❌ Failed to create instance in region: $region"
    return 1
}

# Main retry loop
main() {
    # Set OCI profile globally
    export OCI_CLI_PROFILE="DEFAULT"
    
    log "🚀 Starting A1.Flex instance creation with multi-region retry"
    log "Retry interval: $RETRY_INTERVAL_HOURS hours"
    log "Log file: $LOG_FILE"
    log "OCI Profile: $OCI_CLI_PROFILE"
    log ""
    
    while true; do
        ATTEMPT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
        log "=========================================="
        log "🔄 New attempt started at: $ATTEMPT_TIME"
        log "=========================================="
        
        # Get all available regions
        log "🔍 Getting subscribed regions..."
        REGIONS=$(oci iam region-subscription list --query 'data[*]."region-name"' --raw-output 2>&1 | jq -r '.[]' 2>/dev/null || echo "")
        
        if [ -z "$REGIONS" ]; then
            log "❌ Could not get region list. Trying default region..."
            REGIONS="us-ashburn-1"
        fi
        
        REGION_COUNT=$(echo "$REGIONS" | wc -l)
        log "Found $REGION_COUNT regions to try"
        log ""
        
        SUCCESS=false
        
        # Try each region
        for REGION in $REGIONS; do
            if try_region "$REGION"; then
                SUCCESS=true
                log ""
                log "🎉 Instance creation successful! Exiting."
                exit 0
            fi
            log ""
        done
        
        if [ "$SUCCESS" = false ]; then
            log "❌ Failed to create instance in all regions"
            log ""
            log "💤 Sleeping for $RETRY_INTERVAL_HOURS hours before next attempt..."
            # Calculate next attempt time (works on both GNU and BSD date)
            if date -d "+$RETRY_INTERVAL_HOURS hours" '+%Y-%m-%d %H:%M:%S' > /dev/null 2>&1; then
                NEXT_TIME=$(date -d "+$RETRY_INTERVAL_HOURS hours" '+%Y-%m-%d %H:%M:%S')
            elif date -v+${RETRY_INTERVAL_HOURS}H '+%Y-%m-%d %H:%M:%S' > /dev/null 2>&1; then
                NEXT_TIME=$(date -v+${RETRY_INTERVAL_HOURS}H '+%Y-%m-%d %H:%M:%S')
            else
                NEXT_TIME="unknown"
            fi
            log "Next attempt will be at: $NEXT_TIME"
            log ""
            sleep "$RETRY_INTERVAL_SECONDS"
        fi
    done
}

# Run main function
main

