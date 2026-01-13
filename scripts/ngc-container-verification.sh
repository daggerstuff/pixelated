#!/bin/bash
# NGC Container Verification and Setup Script
# For Pixelated Empathy Therapeutic Enhancement Project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Container configurations
CONTAINERS=(
    "nvcr.io/nvidia/pytorch:24.12-py3"
    "nvcr.io/nvidia/tensorflow:24.12-tf2-py3" 
    "nvcr.io/nvidia/tritonserver:24.12-py3"
)

# Expected sizes (in GB) - approximate
EXPECTED_SIZES=(
    "15-20"
    "12-18"
    "5-8"
)

# Container names for reference
CONTAINER_NAMES=(
    "PyTorch 24.12-py3"
    "TensorFlow 24.12-tf2-py3"
    "Triton Inference Server 24.12-py3"
)

echo "=========================================="
echo "NGC Container Verification and Setup"
echo "Pixelated Empathy Therapeutic Enhancement"
echo "=========================================="
echo ""

# Function to check if Docker is installed
check_docker() {
    echo "🔍 Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Error: Docker is not installed${NC}"
        echo "Please install Docker first:"
        echo "  - Ubuntu/Debian: sudo apt-get install docker.io"
        echo "  - CentOS/RHEL: sudo yum install docker"
        echo "  - Or follow: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is installed${NC}"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Error: Docker daemon is not running${NC}"
        echo "Please start Docker service:"
        echo "  sudo systemctl start docker"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker daemon is running${NC}"
    echo ""
}

# Function to check NVIDIA Container Toolkit
check_nvidia_toolkit() {
    echo "🔍 Checking NVIDIA Container Toolkit..."
    if ! docker info | grep -q "nvidia"; then
        echo -e "${YELLOW}⚠️  Warning: NVIDIA Container Toolkit not detected${NC}"
        echo "For GPU support, install NVIDIA Container Toolkit:"
        echo "  https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
        echo ""
        read -p "Continue without GPU support? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ NVIDIA Container Toolkit is available${NC}"
    fi
    echo ""
}

# Function to check available disk space
check_disk_space() {
    echo "🔍 Checking available disk space..."
    
    # Calculate total estimated size (upper bound)
    total_size_gb=43  # 20 + 18 + 8 (upper bounds)
    
    # Get available space in GB
    available_space=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    
    echo "Available space: ${available_space}GB"
    echo "Required space: ~${total_size_gb}GB"
    
    if [ "$available_space" -lt "$total_size_gb" ]; then
        echo -e "${YELLOW}⚠️  Warning: Limited disk space available${NC}"
        echo "Consider freeing up space or using external storage"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Sufficient disk space available${NC}"
    fi
    echo ""
}

# Function to verify container integrity
verify_container() {
    local image=$1
    local expected_size=$2
    local container_name=$3
    
    echo -e "${BLUE}Verifying ${container_name}...${NC}"
    
    # Check if image exists locally
    if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image}$"; then
        echo -e "${GREEN}✅ ${container_name} is available locally${NC}"
        
        # Get image details
        image_info=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}\t{{.CreatedAt}}" | grep "^${image}")
        
        if [ -n "$image_info" ]; then
            echo "   Image details:"
            echo "   $image_info"
            
            # Extract size and convert to GB for comparison
            actual_size=$(echo "$image_info" | awk '{print $3}')
            echo "   Actual size: $actual_size"
            echo "   Expected size: ~${expected_size}GB"
        fi
        
        # Test basic functionality
        echo "   Testing basic container functionality..."
        
        # Run a simple test command
        if docker run --rm --gpus all "${image}" python3 -c "import sys; print('Python version:', sys.version)" &> /dev/null; then
            echo -e "${GREEN}   ✅ Container runs successfully${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Container test failed - may need GPU or additional setup${NC}"
        fi
        
        return 0
    else
        echo -e "${YELLOW}⚠️  ${container_name} not found locally${NC}"
        return 1
    fi
}

# Function to pull container with retry
pull_container() {
    local image=$1
    local container_name=$2
    
    echo -e "${BLUE}Pulling ${container_name}...${NC}"
    
    # Attempt to pull the image
    if docker pull "${image}"; then
        echo -e "${GREEN}✅ Successfully pulled ${container_name}${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to pull ${container_name}${NC}"
        
        # Check for common issues
        if docker pull "${image}" 2>&1 | grep -q "unauthorized"; then
            echo "   Authentication issue detected. Please ensure:"
            echo "   1. You have a valid NVIDIA NGC account"
            echo "   2. You have generated an API key from NGC"
            echo "   3. You have authenticated with: docker login nvcr.io"
        elif docker pull "${image}" 2>&1 | grep -q "manifest"; then
            echo "   Image tag issue detected. The specified tag may not exist."
            echo "   Please check available tags at: https://ngc.nvidia.com"
        fi
        
        return 1
    fi
}

# Function to authenticate with NGC
authenticate_ngc() {
    echo "🔍 Checking NGC authentication..."
    
    # Check if already authenticated
    if docker info | grep -q "nvcr.io"; then
        echo -e "${GREEN}✅ Already authenticated with NVIDIA registry${NC}"
        return 0
    fi
    
    echo "Please authenticate with NVIDIA Container Registry:"
    echo "1. Get your API key from: https://ngc.nvidia.com/setup/api-key"
    echo "2. Run: docker login nvcr.io"
    echo "   Username: \$oauthtoken"
    echo "   Password: <your-api-key>"
    echo ""
    
    # Attempt authentication
    echo "Attempting authentication..."
    docker login nvcr.io
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully authenticated with NVIDIA registry${NC}"
    else
        echo -e "${RED}❌ Authentication failed${NC}"
        return 1
    fi
    echo ""
}

# Function to create verification report
create_verification_report() {
    local report_file="ngc_container_verification_report.md"
    
    echo "📋 Creating verification report..."
    
    cat > "${report_file}" << EOF
# NGC Container Verification Report
**Generated on:** $(date)
**Project:** Pixelated Empathy Therapeutic Enhancement

## Container Status

EOF

    for i in "${!CONTAINERS[@]}"; do
        container="${CONTAINERS[$i]}"
        name="${CONTAINER_NAMES[$i]}"
        size="${EXPECTED_SIZES[$i]}"
        
        if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${container}$"; then
            echo "- ✅ **${name}** - Available" >> "${report_file}"
            
            # Get detailed info
            image_info=$(docker images --format "{{.Repository}}:{{.Tag}} | Size: {{.Size}} | Created: {{.CreatedAt}}" | grep "${container}")
            echo "  - ${image_info}" >> "${report_file}"
        else
            echo "- ❌ **${name}** - Not available" >> "${report_file}"
            echo "  - Expected size: ~${size}GB" >> "${report_file}"
        fi
    done
    
    echo "" >> "${report_file}"
    echo "## System Information" >> "${report_file}"
    echo "- Docker Version: $(docker --version)" >> "${report_file}"
    echo "- NVIDIA Container Toolkit: $([ -d /usr/local/nvidia ] && echo 'Available' || echo 'Not detected')" >> "${report_file}"
    echo "- Available Disk Space: $(df -h . | tail -1 | awk '{print $4}')" >> "${report_file}"
    
    echo "" >> "${report_file}"
    echo "## Next Steps" >> "${report_file}"
    echo "1. Pull missing containers using this script" >> "${report_file}"
    echo "2. Verify GPU compatibility" >> "${report_file}"
    echo "3. Test container functionality" >> "${report_file}"
    echo "4. Set up development environment" >> "${report_file}"
    
    echo -e "${GREEN}✅ Report created: ${report_file}${NC}"
}

# Main execution
main() {
    echo "Starting NGC container verification process..."
    echo ""
    
    # Phase 1: System checks
    check_docker
    check_nvidia_toolkit
    check_disk_space
    
    # Phase 2: Authentication
    authenticate_ngc
    
    # Phase 3: Container verification
    echo "🔍 Verifying NGC containers..."
    echo ""
    
    local missing_containers=()
    local missing_names=()
    
    for i in "${!CONTAINERS[@]}"; do
        container="${CONTAINERS[$i]}"
        size="${EXPECTED_SIZES[$i]}"
        name="${CONTAINER_NAMES[$i]}"
        
        if ! verify_container "${container}" "${size}" "${name}"; then
            missing_containers+=("${container}")
            missing_names+=("${name}")
        fi
        echo ""
    done
    
    # Phase 4: Pull missing containers
    if [ ${#missing_containers[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found ${#missing_containers[@]} missing container(s)${NC}"
        echo ""
        
        for i in "${!missing_containers[@]}"; do
            pull_container "${missing_containers[$i]}" "${missing_names[$i]}"
            echo ""
        done
    else
        echo -e "${GREEN}✅ All containers are available!${NC}"
    fi
    
    # Phase 5: Generate report
    create_verification_report
    
    echo ""
    echo "=========================================="
    echo "Verification Complete"
    echo "=========================================="
    
    # Update task status
    if [ ${#missing_containers[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All NGC containers are verified and ready!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Set up development environment"
        echo "2. Configure NeMo microservices"
        echo "3. Test container functionality"
    else
        echo -e "${YELLOW}⚠️  Some containers need to be pulled${NC}"
        echo "Run this script again or manually pull missing containers"
    fi
}

# Run main function
main "$@"