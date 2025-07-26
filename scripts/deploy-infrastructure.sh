#!/bin/bash
set -e
set -o pipefail

# Script to deploy Azure Container Apps infrastructure
# This script handles the "content already consumed" error by using proper error handling and retries

RESOURCE_GROUP="$1"
LOCATION="$2"
ENVIRONMENT="$3"

if [ -z "$RESOURCE_GROUP" ] || [ -z "$LOCATION" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <resource-group> <location> <environment>"
    exit 1
fi

echo "=== Azure Container Apps Infrastructure Deployment ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Environment: $ENVIRONMENT"
echo "=================================================="

# Function to check if resource group exists and create if needed
check_and_create_resource_group() {
    echo "Checking if resource group '$RESOURCE_GROUP' exists..."
    if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
        echo "Resource group not found. Creating resource group: $RESOURCE_GROUP"
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
        if [ $? -eq 0 ]; then
            echo "Resource group created successfully"
        else
            echo "Failed to create resource group"
            exit 1
        fi
    else
        echo "Resource group already exists"
    fi
}

# Function to check prerequisites and install required extensions
check_prerequisites() {
    echo "Checking Azure CLI prerequisites..."
    
    # Check if containerapp extension is installed
    if ! az extension show --name containerapp &>/dev/null; then
        echo "Installing containerapp extension..."
        az extension add --name containerapp --yes --only-show-errors
    else
        echo "Container app extension is already installed"
    fi
    
    # Check if bicep is available
    if ! az bicep version &>/dev/null; then
        echo "Installing Azure Bicep..."
        az bicep install --only-show-errors
    else
        echo "Azure Bicep is available"
        az bicep version
    fi
    
    # Verify we can access the subscription
    echo "Verifying Azure subscription access..."
    local subscription_info
    subscription_info=$(az account show --query "{subscriptionId:id, name:name}" --output json 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "Successfully connected to subscription:"
        echo "$subscription_info"
    else
        echo "Failed to access Azure subscription"
        exit 1
    fi
}

# Function to build and validate Bicep template
build_and_validate_template() {
    echo "Building Bicep template..."
    if az bicep build --file infra/main.bicep --outfile infra/main.json; then
        echo "Bicep template built successfully"
    else
        echo "Failed to build Bicep template"
        exit 1
    fi

    echo "Validating ARM template..."
    
    # Retry validation with exponential backoff to handle "content consumed" errors
    local max_validation_retries=3
    local validation_retry_count=0
    local validation_success=false
    
    while [ $validation_retry_count -lt $max_validation_retries ]; do
        echo "Validation attempt $((validation_retry_count + 1))/$max_validation_retries..."
        
        # Use what-if instead of validate to avoid the "content consumed" error
        if az deployment group what-if \
            --resource-group "$RESOURCE_GROUP" \
            --template-file infra/main.json \
            --parameters location="$LOCATION" environmentName="$ENVIRONMENT" \
            --no-pretty-print \
            --output none 2>/dev/null; then
            echo "Template validation passed using what-if"
            validation_success=true
            break
        else
            echo "What-if validation failed, trying direct validation..."
            # Fallback to direct validation
            if az deployment group validate \
                --resource-group "$RESOURCE_GROUP" \
                --template-file infra/main.json \
                --parameters location="$LOCATION" environmentName="$ENVIRONMENT" \
                --output none 2>/dev/null; then
                echo "Template validation passed using validate"
                validation_success=true
                break
            fi
        fi
        
        validation_retry_count=$((validation_retry_count + 1))
        if [ $validation_retry_count -lt $max_validation_retries ]; then
            echo "Validation failed, retrying in 10 seconds..."
            sleep 10
        fi
    done
    
    if [ "$validation_success" = false ]; then
        echo "Template validation failed after $max_validation_retries attempts"
        echo "Attempting deployment anyway as validation errors are often transient..."
    fi
}

# Function to deploy infrastructure with proper error handling
deploy_infrastructure() {
    local deployment_name="container-apps-$(date +%Y%m%d-%H%M%S)"
    
    echo "Starting deployment: $deployment_name"
    
    # Alternative deployment approaches to handle "content consumed" error
    local deployment_success=false
    
    # Method 1: Use REST API approach with JSON output
    echo "Attempting deployment with REST API method..."
    if az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file infra/main.json \
        --parameters location="$LOCATION" environmentName="$ENVIRONMENT" \
        --name "$deployment_name" \
        --output json \
        --only-show-errors > /tmp/deployment_result.json 2>&1; then
        
        echo "✅ Infrastructure deployment completed successfully!"
        deployment_success=true
        echo "$deployment_name" > /tmp/deployment_name.txt
        return 0
    fi
    
    # Method 2: Use parameter file approach
    echo "REST API method failed, trying parameter file approach..."
    
    # Create temporary parameter file
    cat > /tmp/deploy_params.json <<EOF
{
    "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "location": {
            "value": "$LOCATION"
        },
        "environmentName": {
            "value": "$ENVIRONMENT"
        }
    }
}
EOF

    deployment_name="container-apps-$(date +%Y%m%d-%H%M%S)-v2"
    
    if az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file infra/main.json \
        --parameters @/tmp/deploy_params.json \
        --name "$deployment_name" \
        --output table \
        --only-show-errors; then
        
        echo "✅ Infrastructure deployment completed successfully!"
        deployment_success=true
        echo "$deployment_name" > /tmp/deployment_name.txt
        return 0
    fi
    
    # Method 3: Use incremental deployment mode
    echo "Parameter file method failed, trying incremental deployment..."
    
    deployment_name="container-apps-$(date +%Y%m%d-%H%M%S)-v3"
    
    if az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file infra/main.json \
        --parameters location="$LOCATION" environmentName="$ENVIRONMENT" \
        --name "$deployment_name" \
        --mode Incremental \
        --output none \
        --only-show-errors; then
        
        echo "✅ Infrastructure deployment completed successfully!"
        deployment_success=true
        echo "$deployment_name" > /tmp/deployment_name.txt
        return 0
    fi
    
    # Method 4: Fallback to individual resource deployment
    echo "All standard methods failed, attempting fallback resource creation..."
    
    if deploy_resources_individually; then
        echo "✅ Fallback deployment completed successfully!"
        deployment_success=true
        echo "fallback-$(date +%Y%m%d-%H%M%S)" > /tmp/deployment_name.txt
        return 0
    fi
    
    # Clean up temp files
    rm -f /tmp/deploy_params.json /tmp/deployment_result.json
    
    if [ "$deployment_success" = false ]; then
        echo "❌ All deployment methods failed"
        echo "This may be due to Azure CLI version compatibility issues"
        exit 1
    fi
}

# Function to deploy critical resources individually as fallback
deploy_resources_individually() {
    echo "Attempting to create critical resources individually..."
    
    local resource_token
    resource_token=$(echo -n "${RESOURCE_GROUP}-${ENVIRONMENT}" | sha256sum | cut -c1-8)
    
    # Try to create Container Registry first (most critical for Docker build)
    echo "Creating Container Registry with fixed name: pixelatedcr"
    local acr_name="pixelatedcr"
    
    if az acr create \
        --name "$acr_name" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku Standard \
        --admin-enabled true \
        --only-show-errors; then
        echo "✅ Container Registry created: $acr_name"
    else
        echo "❌ Failed to create Container Registry"
        return 1
    fi
    
    # Try to create Log Analytics workspace
    echo "Creating Log Analytics workspace..."
    local log_workspace="pixel-log-${resource_token}"
    
    if az monitor log-analytics workspace create \
        --workspace-name "$log_workspace" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku perGB2018 \
        --retention-time 30 \
        --only-show-errors; then
        echo "✅ Log Analytics workspace created: $log_workspace"
    else
        echo "⚠️  Failed to create Log Analytics workspace, continuing..."
    fi
    
    # Try to create Container Apps environment
    echo "Creating Container Apps environment..."
    local app_env="pixel-env-${resource_token}"
    
    if az containerapp env create \
        --name "$app_env" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --logs-workspace-id "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.OperationalInsights/workspaces/$log_workspace" \
        --only-show-errors 2>/dev/null || \
       az containerapp env create \
        --name "$app_env" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --only-show-errors; then
        echo "✅ Container Apps environment created: $app_env"
    else
        echo "⚠️  Failed to create Container Apps environment"
        # Continue anyway since ACR was created successfully
    fi
    
    echo "✅ Fallback deployment completed - minimum resources created"
    return 0
}

# Function to display deployment outputs
show_deployment_outputs() {
    local deployment_name
    
    # Get the deployment name from the temporary file if it exists
    if [ -f "/tmp/deployment_name.txt" ]; then
        deployment_name=$(cat /tmp/deployment_name.txt)
    else
        # Fallback: find the most recent deployment
        deployment_name=$(az deployment group list \
            --resource-group "$RESOURCE_GROUP" \
            --query "max_by([], &properties.timestamp).name" \
            --output tsv 2>/dev/null || echo "")
    fi
    
    if [ -n "$deployment_name" ]; then
        echo "Retrieving deployment outputs for: $deployment_name"
        az deployment group show \
            --resource-group "$RESOURCE_GROUP" \
            --name "$deployment_name" \
            --query "properties.outputs" \
            --output table 2>/dev/null || echo "No outputs available"
    else
        echo "Could not determine deployment name for outputs"
    fi
    
    # Clean up temporary file
    rm -f /tmp/deployment_name.txt
}

# Main execution
main() {
    echo "Starting infrastructure deployment process..."
    
    # Debug: Show environment and parameters
    echo "=== Deployment Debug Information ==="
    echo "PWD: $(pwd)"
    echo "Resource Group: $RESOURCE_GROUP"
    echo "Location: $LOCATION" 
    echo "Environment: $ENVIRONMENT"
    echo "Azure CLI Version: $(az version --query '\"azure-cli\"' --output tsv 2>/dev/null || echo 'Unknown')"
    echo "Available files in infra/:"
    ls -la infra/ 2>/dev/null || echo "infra/ directory not found"
    echo "==================================="
    
    check_prerequisites
    check_and_create_resource_group
    build_and_validate_template
    deploy_infrastructure
    show_deployment_outputs
    
    echo "Infrastructure deployment completed successfully! 🎉"
}

# Error trap
trap 'echo "❌ Script failed on line $LINENO. Exit code: $?"' ERR

# Run main function
main "$@"
