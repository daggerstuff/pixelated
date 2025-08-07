#!/bin/bash

# Fully Automated Oracle Cloud Deployment with OCI CLI
# Creates infrastructure and deploys Pixelated app in one command

set -e

# Configuration
APP_NAME="pixelated"
CONTAINER_NAME="pixelated-app"
PORT=4321
INSTANCE_SHAPE="VM.Standard.A1.Flex"
INSTANCE_OCPUS=4
INSTANCE_MEMORY=24
UBUNTU_IMAGE_ID="ocid1.image.oc1..aaaaaaaaqcayxsrhx5dg7xakvjlyk5q6ql6z6z5q5q5q5q5q5q5q5q5q"  # Will be auto-detected

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

# Check if OCI CLI is configured with proper error handling
check_oci_cli() {
    print_header "Checking OCI CLI configuration..."

    if ! command -v oci &> /dev/null; then
        print_error "OCI CLI not found. Please install it first."
        print_error "Installation guide: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm"
        exit 1
    fi

    print_status "OCI CLI found at: $(which oci)"

    # Test OCI CLI authentication with better error handling
    print_status "Testing OCI CLI authentication..."
    if ! oci iam region list --query 'data[0]."region-name"' --raw-output &> /dev/null; then
        print_error "OCI CLI authentication failed."
        print_error "Please run: oci setup config"
        print_error "Or check your ~/.oci/config file"
        exit 1
    fi

    print_status "✅ OCI CLI is configured and authenticated"
}

# Get current configuration using proper OCI CLI patterns
get_oci_config() {
    print_header "Getting OCI configuration..."

    # Try multiple regions for ARM capacity
    REGIONS=("us-ashburn-1" "us-phoenix-1")
    print_status "Will try multiple regions for ARM capacity: ${REGIONS[*]}"

    # Get tenancy OCID from config
    if [[ -f ~/.oci/config ]]; then
        TENANCY_OCID=$(grep "tenancy" ~/.oci/config | head -1 | cut -d'=' -f2 | tr -d ' ')
    fi

    # Fallback: get tenancy from IAM
    if [[ -z "$TENANCY_OCID" ]]; then
        TENANCY_OCID=$(oci iam compartment list --all --query 'data[?name==`root`].id | [0]' --raw-output 2>/dev/null)
    fi

    # Use root compartment (tenancy) for resources
    COMPARTMENT_OCID=${TENANCY_OCID}

    print_status "Tenancy: $TENANCY_OCID"
    print_status "Compartment: $COMPARTMENT_OCID"

    # Validate we have required values
    if [[ -z "$TENANCY_OCID" ]]; then
        print_error "Could not determine tenancy OCID. Please check OCI CLI configuration."
        exit 1
    fi
}

# Get the latest Ubuntu image using proper OCI CLI patterns
get_ubuntu_image() {
    print_header "Finding latest Ubuntu 22.04 image..."

    # First, try to get ARM-compatible Ubuntu images
    print_status "Searching for ARM-compatible Ubuntu 22.04 images..."
    print_status "Debug: Using compartment $COMPARTMENT_OCID"
    print_status "Debug: Using region $REGION"

    # Use proper OCI CLI query for ARM shapes with verbose output
    print_status "Debug: Running OCI image list command..."

    # Temporarily disable exit on error for this command
    set +e

    # Capture both stdout and stderr - fix TypeError by using simpler query
    UBUNTU_IMAGE_RESULT=$(oci compute image list \
        --region $REGION \
        --compartment-id $COMPARTMENT_OCID \
        --operating-system "Canonical Ubuntu" \
        --operating-system-version "22.04" \
        --sort-by TIMECREATED \
        --sort-order DESC \
        --all \
        --query 'data[0].id' \
        --raw-output 2>&1)

    local exit_code=$?

    # Re-enable exit on error
    set -e

    print_status "Debug: Command exit code: $exit_code"
    print_status "Debug: Full command output: '$UBUNTU_IMAGE_RESULT'"

    if [[ $exit_code -ne 0 ]]; then
        print_error "OCI image list command failed with exit code $exit_code"
        print_error "Error output: $UBUNTU_IMAGE_RESULT"
        UBUNTU_IMAGE_ID=""
    else
        UBUNTU_IMAGE_ID="$UBUNTU_IMAGE_RESULT"
    fi

    # Fallback: try without architecture filter
    if [[ -z "$UBUNTU_IMAGE_ID" || "$UBUNTU_IMAGE_ID" == "null" || "$UBUNTU_IMAGE_ID" == *"Error"* ]]; then
        print_status "Debug: First search failed, trying broader Ubuntu 22.04 search..."
        UBUNTU_IMAGE_ID=$(oci compute image list \
            --compartment-id $COMPARTMENT_OCID \
            --operating-system "Canonical Ubuntu" \
            --operating-system-version "22.04" \
            --sort-by TIMECREATED \
            --sort-order DESC \
            --all \
            --query 'data[0].id' \
            --raw-output 2>&1)
        print_status "Debug: Broader search result: '$UBUNTU_IMAGE_ID'"
    fi

    # Final fallback: use Oracle Linux if Ubuntu not found
    if [[ -z "$UBUNTU_IMAGE_ID" || "$UBUNTU_IMAGE_ID" == "null" || "$UBUNTU_IMAGE_ID" == *"Error"* ]]; then
        print_warning "Ubuntu 22.04 not found, trying Oracle Linux 8..."
        UBUNTU_IMAGE_ID=$(oci compute image list \
            --compartment-id $COMPARTMENT_OCID \
            --operating-system "Oracle Linux" \
            --operating-system-version "8" \
            --sort-by TIMECREATED \
            --sort-order DESC \
            --all \
            --query 'data[0].id' \
            --raw-output 2>&1)
        print_status "Debug: Oracle Linux search result: '$UBUNTU_IMAGE_ID'"
    fi

    # If still no image found, show detailed error
    if [[ -z "$UBUNTU_IMAGE_ID" || "$UBUNTU_IMAGE_ID" == "null" || "$UBUNTU_IMAGE_ID" == *"Error"* ]]; then
        print_error "Could not find any compatible OS image for ARM shape"
        print_error "Debug: Final image ID result: '$UBUNTU_IMAGE_ID'"
        print_error "Please check your compartment permissions and region"

        # Show available images for debugging
        print_status "Debug: Listing first 5 available images in compartment..."
        oci compute image list --compartment-id $COMPARTMENT_OCID --limit 5 --query 'data[].{"Name":"display-name","OS":"operating-system","Version":"operating-system-version","ID":"id"}' --output table 2>&1 || print_error "Failed to list images"

        exit 1
    fi

    print_status "✅ Found OS image: $UBUNTU_IMAGE_ID"
}

# Create or get VCN
setup_networking() {
    print_header "Setting up networking..."
    
    # Check if VCN already exists
    print_status "Checking for existing VCN..."

    set +e
    VCN_LIST=$(oci network vcn list \
        --region $REGION \
        --compartment-id $COMPARTMENT_OCID \
        --all \
        --output json 2>/dev/null)

    if [[ $? -eq 0 && -n "$VCN_LIST" ]]; then
        VCN_OCID=$(echo "$VCN_LIST" | jq -r '.data[] | select(."display-name" == "'${APP_NAME}'-vcn") | .id' | head -1)
        if [[ -z "$VCN_OCID" || "$VCN_OCID" == "null" ]]; then
            VCN_OCID="null"
        fi
    else
        VCN_OCID="null"
    fi
    set -e

    print_status "Debug: VCN search result: '$VCN_OCID'"
    
    if [[ "$VCN_OCID" == "null" ]]; then
        print_status "No VCN with name '${APP_NAME}-vcn' found, checking for any existing VCN..."

        # Try to find any existing VCN to use
        VCN_OCID=$(echo "$VCN_LIST" | jq -r '.data[0].id // "null"' 2>/dev/null)

        if [[ "$VCN_OCID" != "null" && -n "$VCN_OCID" ]]; then
            VCN_NAME=$(echo "$VCN_LIST" | jq -r '.data[0]."display-name"' 2>/dev/null)
            print_status "✅ Using existing VCN: $VCN_NAME ($VCN_OCID)"
        else
            print_error "No existing VCN found and cannot create new VCN due to service limits"
            print_error "Please either:"
            print_error "1. Delete an existing VCN from Oracle Cloud Console"
            print_error "2. Request a service limit increase"
            print_error "3. Use an existing VCN by renaming it to '${APP_NAME}-vcn'"
            exit 1
        fi
    fi
    
    print_status "✅ VCN: $VCN_OCID"
    
    # Create Internet Gateway
    IGW_OCID=$(oci network internet-gateway list \
        --compartment-id $COMPARTMENT_OCID \
        --vcn-id $VCN_OCID \
        --query 'data[0].id' \
        --raw-output 2>/dev/null || echo "null")
    
    if [[ "$IGW_OCID" == "null" ]]; then
        print_status "Creating Internet Gateway..."
        IGW_OCID=$(oci network internet-gateway create \
            --compartment-id $COMPARTMENT_OCID \
            --vcn-id $VCN_OCID \
            --display-name "${APP_NAME}-igw" \
            --is-enabled true \
            --query 'data.id' \
            --raw-output)
    fi
    
    # Create Route Table
    print_status "Checking for existing route table..."

    set +e
    RT_LIST=$(oci network route-table list \
        --compartment-id $COMPARTMENT_OCID \
        --vcn-id $VCN_OCID \
        --all \
        --output json 2>/dev/null)

    if [[ $? -eq 0 && -n "$RT_LIST" ]]; then
        RT_OCID=$(echo "$RT_LIST" | jq -r '.data[] | select(."display-name" == "'${APP_NAME}'-rt") | .id' | head -1)
        if [[ -z "$RT_OCID" || "$RT_OCID" == "null" ]]; then
            RT_OCID="null"
        fi
    else
        RT_OCID="null"
    fi
    set -e

    print_status "Debug: Route table search result: '$RT_OCID'"

    if [[ "$RT_OCID" == "null" ]]; then
        print_status "Creating Route Table..."
        RT_OCID=$(oci network route-table create \
            --compartment-id $COMPARTMENT_OCID \
            --vcn-id $VCN_OCID \
            --display-name "${APP_NAME}-rt" \
            --route-rules '[{"destination": "0.0.0.0/0", "destinationType": "CIDR_BLOCK", "networkEntityId": "'$IGW_OCID'"}]' \
            --query 'data.id' \
            --raw-output)
        print_status "Route table created: $RT_OCID"
    fi
    
    # Create Security List
    print_status "Checking for existing security list..."

    set +e
    SL_LIST=$(oci network security-list list \
        --compartment-id $COMPARTMENT_OCID \
        --vcn-id $VCN_OCID \
        --all \
        --output json 2>/dev/null)

    if [[ $? -eq 0 && -n "$SL_LIST" ]]; then
        SL_OCID=$(echo "$SL_LIST" | jq -r '.data[] | select(."display-name" == "'${APP_NAME}'-sl") | .id' | head -1)
        if [[ -z "$SL_OCID" || "$SL_OCID" == "null" ]]; then
            SL_OCID="null"
        fi
    else
        SL_OCID="null"
    fi
    set -e

    print_status "Debug: Security list search result: '$SL_OCID'"

    if [[ "$SL_OCID" == "null" ]]; then
        print_status "Creating Security List..."
        SL_OCID=$(oci network security-list create \
            --compartment-id $COMPARTMENT_OCID \
            --vcn-id $VCN_OCID \
            --display-name "${APP_NAME}-sl" \
            --egress-security-rules '[{"destination": "0.0.0.0/0", "protocol": "all", "isStateless": false}]' \
            --ingress-security-rules '[
                {"source": "0.0.0.0/0", "protocol": "6", "isStateless": false, "tcpOptions": {"destinationPortRange": {"min": 22, "max": 22}}},
                {"source": "0.0.0.0/0", "protocol": "6", "isStateless": false, "tcpOptions": {"destinationPortRange": {"min": 80, "max": 80}}},
                {"source": "0.0.0.0/0", "protocol": "6", "isStateless": false, "tcpOptions": {"destinationPortRange": {"min": 443, "max": 443}}},
                {"source": "0.0.0.0/0", "protocol": "6", "isStateless": false, "tcpOptions": {"destinationPortRange": {"min": 4321, "max": 4321}}}
            ]' \
            --query 'data.id' \
            --raw-output)
        print_status "Security list created: $SL_OCID"
    fi
    
    # Create Subnet
    print_status "Checking for existing subnet..."

    # List all subnets and filter by name (simpler approach)
    set +e
    SUBNET_LIST=$(oci network subnet list \
        --compartment-id $COMPARTMENT_OCID \
        --vcn-id $VCN_OCID \
        --all \
        --output json 2>/dev/null)

    if [[ $? -eq 0 && -n "$SUBNET_LIST" ]]; then
        SUBNET_OCID=$(echo "$SUBNET_LIST" | jq -r '.data[] | select(."display-name" == "'${APP_NAME}'-subnet") | .id' | head -1)
        if [[ -z "$SUBNET_OCID" || "$SUBNET_OCID" == "null" ]]; then
            SUBNET_OCID="null"
        fi
    else
        SUBNET_OCID="null"
    fi
    set -e

    print_status "Debug: Subnet search result: '$SUBNET_OCID'"
    
    if [[ "$SUBNET_OCID" == "null" ]]; then
        print_status "Creating Subnet..."
        print_status "Debug: Using VCN: $VCN_OCID"
        print_status "Debug: Using Route Table: $RT_OCID"
        print_status "Debug: Using Security List: $SL_OCID"

        # Create subnet with timeout
        set +e
        timeout 120 oci network subnet create \
            --compartment-id $COMPARTMENT_OCID \
            --vcn-id $VCN_OCID \
            --display-name "${APP_NAME}-subnet" \
            --cidr-block "10.0.1.0/24" \
            --route-table-id $RT_OCID \
            --security-list-ids '["'$SL_OCID'"]' \
            --query 'data.id' \
            --raw-output > /tmp/subnet_creation.out 2>&1

        local subnet_exit_code=$?
        set -e

        if [[ $subnet_exit_code -eq 124 ]]; then
            print_error "Subnet creation timed out after 2 minutes"
            print_error "This might indicate API issues or resource conflicts"
            exit 1
        elif [[ $subnet_exit_code -ne 0 ]]; then
            print_error "Subnet creation failed with exit code: $subnet_exit_code"
            print_error "Error output:"
            cat /tmp/subnet_creation.out
            exit 1
        fi

        SUBNET_OCID=$(cat /tmp/subnet_creation.out)
        print_status "Subnet created: $SUBNET_OCID"

        # Wait for subnet to be available with timeout (manual polling since --wait-for-state not supported)
        print_status "Waiting for subnet to be available..."
        local wait_count=0
        local max_wait=60  # 5 minutes

        while [[ $wait_count -lt $max_wait ]]; do
            local subnet_state=$(oci network subnet get --subnet-id $SUBNET_OCID --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "UNKNOWN")

            if [[ "$subnet_state" == "AVAILABLE" ]]; then
                print_status "✅ Subnet is now available"
                break
            elif [[ "$subnet_state" == "FAILED" || "$subnet_state" == "TERMINATED" ]]; then
                print_error "Subnet creation failed with state: $subnet_state"
                exit 1
            fi

            print_status "Subnet state: $subnet_state, waiting... ($wait_count/$max_wait)"
            sleep 5
            ((wait_count++))
        done

        if [[ $wait_count -ge $max_wait ]]; then
            print_error "Subnet failed to reach AVAILABLE state within 5 minutes"
            exit 1
        fi
    fi
    
    print_status "✅ Networking setup complete"
}

# Generate SSH key if needed
setup_ssh_key() {
    print_header "Setting up SSH key..."
    
    SSH_KEY_PATH="$HOME/.ssh/pixelated_oracle"
    
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        print_status "Generating SSH key pair..."
        ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "" -C "pixelated-oracle-$(date +%Y%m%d)"
        chmod 600 "$SSH_KEY_PATH"
        chmod 644 "${SSH_KEY_PATH}.pub"
    fi
    
    SSH_PUBLIC_KEY=$(cat "${SSH_KEY_PATH}.pub")
    print_status "✅ SSH key ready: $SSH_KEY_PATH"
}

# Create compute instance
create_instance() {
    print_header "Creating compute instance..."
    
    # Check if instance already exists
    print_status "Checking for existing instances..."

    set +e  # Disable exit on error temporarily

    # First, try to find instance by name
    INSTANCE_OCID=$(oci compute instance list \
        --region $REGION \
        --compartment-id $COMPARTMENT_OCID \
        --display-name "${APP_NAME}-instance" \
        --lifecycle-state RUNNING \
        --all \
        --query 'data[0].id' \
        --raw-output 2>&1)

    # If not found by name, try to find ANY running instance
    if [[ -z "$INSTANCE_OCID" || "$INSTANCE_OCID" == "null" || "$INSTANCE_OCID" == *"Error"* ]]; then
        print_status "No instance found with name '${APP_NAME}-instance', checking for any running instances..."

        ALL_INSTANCES=$(oci compute instance list \
            --region $REGION \
            --compartment-id $COMPARTMENT_OCID \
            --lifecycle-state RUNNING \
            --all \
            --output json 2>&1)

        if [[ $? -eq 0 && -n "$ALL_INSTANCES" ]]; then
            INSTANCE_OCID=$(echo "$ALL_INSTANCES" | jq -r '.data[0].id // "null"' 2>/dev/null)
            if [[ "$INSTANCE_OCID" != "null" && -n "$INSTANCE_OCID" ]]; then
                INSTANCE_NAME=$(echo "$ALL_INSTANCES" | jq -r '.data[0]."display-name"' 2>/dev/null)
                print_status "Found existing running instance: $INSTANCE_NAME ($INSTANCE_OCID)"
            fi
        fi
    fi
    local exit_code=$?
    set -e  # Re-enable exit on error

    print_status "Debug: Instance query exit code: $exit_code"
    print_status "Debug: Instance query result: '$INSTANCE_OCID'"

    if [[ $exit_code -eq 0 && -n "$INSTANCE_OCID" && "$INSTANCE_OCID" != "null" && "$INSTANCE_OCID" != *"Error"* ]]; then
        print_status "✅ Instance already exists: $INSTANCE_OCID"
    else
        print_status "Creating new instance..."

        # Get all availability domains for the current region
        print_status "Getting availability domains for region $REGION..."
        set +e
        AD_LIST=$(oci iam availability-domain list --region $REGION --compartment-id $COMPARTMENT_OCID --all --output json 2>&1)
        local ad_exit_code=$?
        set -e

        if [[ $ad_exit_code -ne 0 || -z "$AD_LIST" ]]; then
            print_error "Failed to get availability domains for region $REGION: $AD_LIST"
            exit 1
        fi

        # Extract all AD names for this region
        AVAILABILITY_DOMAINS=($(echo "$AD_LIST" | jq -r '.data[].name' 2>/dev/null))

        if [[ ${#AVAILABILITY_DOMAINS[@]} -eq 0 ]]; then
            print_error "No availability domains found in region $REGION"
            exit 1
        fi

        print_status "Found ${#AVAILABILITY_DOMAINS[@]} availability domains in $REGION: ${AVAILABILITY_DOMAINS[*]}"

        # Create cloud-init script
        CLOUD_INIT=$(cat <<EOF
#cloud-config
package_update: true
package_upgrade: true
packages:
  - docker.io
  - docker-compose
  - git
  - curl
  - wget
  - unzip

runcmd:
  - systemctl start docker
  - systemctl enable docker
  - usermod -aG docker ubuntu
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  - apt update
  - apt install -y caddy
  - systemctl start caddy
  - systemctl enable caddy
EOF
)

        # Create cloud-init file for user-data-file parameter
        echo "$CLOUD_INIT" > /tmp/cloud-init.yaml

        print_status "Launching instance with timeout..."
        print_status "Debug: Using image: $UBUNTU_IMAGE_ID"
        print_status "Debug: Using subnet: $SUBNET_OCID"

        # Try each availability domain until one works
        INSTANCE_OCID=""
        for AVAILABILITY_DOMAIN in "${AVAILABILITY_DOMAINS[@]}"; do
            print_status "Trying availability domain: $AVAILABILITY_DOMAIN in region $REGION"

            # Add delay to avoid rate limiting
            sleep 5

            # Launch instance with timeout
            set +e
            timeout 300 oci compute instance launch \
                --region $REGION \
                --compartment-id $COMPARTMENT_OCID \
                --availability-domain "$AVAILABILITY_DOMAIN" \
                --display-name "${APP_NAME}-instance" \
                --image-id $UBUNTU_IMAGE_ID \
                --shape $INSTANCE_SHAPE \
                --shape-config '{"ocpus": '$INSTANCE_OCPUS', "memoryInGBs": '$INSTANCE_MEMORY'}' \
                --subnet-id $SUBNET_OCID \
                --assign-public-ip true \
                --ssh-authorized-keys-file "${SSH_KEY_PATH}.pub" \
                --user-data-file /tmp/cloud-init.yaml \
                --query 'data.id' \
                --raw-output > /tmp/instance_creation.out 2>&1

            local launch_exit_code=$?
            set -e

            if [[ $launch_exit_code -eq 124 ]]; then
                print_warning "Instance creation timed out in $AVAILABILITY_DOMAIN, trying next AD..."
                continue
            elif [[ $launch_exit_code -eq 0 ]]; then
                INSTANCE_OCID=$(cat /tmp/instance_creation.out)
                print_status "✅ Instance created successfully in $AVAILABILITY_DOMAIN: $INSTANCE_OCID"
                break
            else
                # Check if it's a capacity issue or rate limiting
                local error_output=$(cat /tmp/instance_creation.out)
                if echo "$error_output" | grep -q "Out of host capacity\|InternalError"; then
                    print_warning "⚠️  No capacity in $AVAILABILITY_DOMAIN, trying next AD..."
                    continue
                elif echo "$error_output" | grep -q "TooManyRequests\|429"; then
                    print_warning "⚠️  Rate limited in $AVAILABILITY_DOMAIN, waiting 60 seconds before retry..."
                    sleep 60
                    continue
                else
                    print_error "Instance creation failed in $AVAILABILITY_DOMAIN with exit code: $launch_exit_code"
                    print_error "Error output: $error_output"
                    exit 1
                fi
            fi
        done

        if [[ -z "$INSTANCE_OCID" ]]; then
            print_error "Failed to create instance in any availability domain in region $REGION"
            print_error "All ADs either have no capacity or other issues"

            # Try next region if available
            local current_region_index=-1
            for i in "${!REGIONS[@]}"; do
                if [[ "${REGIONS[$i]}" == "$REGION" ]]; then
                    current_region_index=$i
                    break
                fi
            done

            local next_region_index=$((current_region_index + 1))
            if [[ $next_region_index -lt ${#REGIONS[@]} ]]; then
                local next_region="${REGIONS[$next_region_index]}"
                print_status "🌍 Trying next region: $next_region"

                # Update region and retry entire deployment
                REGION="$next_region"
                print_status "Switching to region: $REGION"

                # Reset all region-specific variables
                UBUNTU_IMAGE_ID=""
                VCN_OCID=""
                IGW_OCID=""
                RT_OCID=""
                SL_OCID=""
                SUBNET_OCID=""
                AVAILABILITY_DOMAINS=()

                # Retry entire deployment process for new region
                print_status "Re-running deployment process for new region..."
                get_ubuntu_image
                setup_networking
                create_instance
                return
            else
                print_error "No more regions to try. All regions exhausted: ${REGIONS[*]}"
                exit 1
            fi
        fi

        print_status "Waiting for instance to be running (with timeout)..."
        timeout 600 oci compute instance get --instance-id $INSTANCE_OCID --wait-for-state RUNNING || {
            print_error "Instance failed to reach RUNNING state within 10 minutes"
            exit 1
        }
    fi
    
    # Get public IP
    PUBLIC_IP=$(oci compute instance list-vnics \
        --instance-id $INSTANCE_OCID \
        --query 'data[0]."public-ip"' \
        --raw-output)
    
    print_status "✅ Instance ready: $INSTANCE_OCID"
    print_status "✅ Public IP: $PUBLIC_IP"
    
    # Save connection info
    echo "INSTANCE_OCID=$INSTANCE_OCID" > .oracle_deployment
    echo "PUBLIC_IP=$PUBLIC_IP" >> .oracle_deployment
    echo "SSH_KEY_PATH=$SSH_KEY_PATH" >> .oracle_deployment
}

# Main function
main() {
    print_header "🚀 Starting fully automated Oracle Cloud deployment..."

    check_oci_cli
    get_oci_config

    # Start with first region
    REGION="${REGIONS[0]}"
    print_status "Starting with region: $REGION"

    get_ubuntu_image
    setup_networking
    setup_ssh_key
    create_instance
    
    print_status "🎉 Infrastructure deployment completed!"
    print_status ""
    print_status "Next steps:"
    print_status "1. Wait 2-3 minutes for cloud-init to finish installing Docker/Caddy"
    print_status "2. Run: ./scripts/deploy-app-to-oracle.sh"
    print_status ""
    print_status "Connection details saved to .oracle_deployment"
    print_status "SSH command: ssh -i $SSH_KEY_PATH ubuntu@$PUBLIC_IP"
}

main "$@"
