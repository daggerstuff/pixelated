#!/bin/bash

# Configure Clerk secrets in Azure Key Vault
# This script reads Clerk configuration from environment variables and stores them securely in Azure Key Vault

set -euo pipefail

# Color output functions
red() { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
blue() { echo -e "\033[34m$1\033[0m"; }
bold() { echo -e "\033[1m$1\033[0m"; }

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse command line arguments
AUTO_CONFIRM=false
SHOW_HELP=false
for arg in "$@"; do
    case $arg in
        --auto-confirm)
            AUTO_CONFIRM=true
            ;;
        --help|-h)
            SHOW_HELP=true
            ;;
    esac
done

# Show usage if --help is requested (before loading .env)
if [[ "$SHOW_HELP" == "true" ]]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "This script configures Clerk authentication secrets in Azure Key Vault."
    echo ""
    echo "Options:"
    echo "  --auto-confirm          Automatically confirm loading .env file without prompting"
    echo "  -h, --help             Show this help message and exit"
    echo ""
    echo "Required environment variables:"
    echo "  CLERK_PUBLISHABLE_KEY    - Clerk publishable key (pk_live_...)"
    echo "  CLERK_SECRET_KEY         - Clerk secret key (sk_live_...)"
    echo "  AZURE_KEY_VAULT_NAME     - Azure Key Vault name"
    echo ""
    echo "Optional environment variables:"
    echo "  CLERK_DOMAIN            - Custom Clerk domain"
    echo "  CLERK_WEBHOOK_SECRET    - Clerk webhook signing secret"
    echo "  AZURE_RESOURCE_GROUP    - Azure resource group (for auto-discovery)"
    echo ""
    echo "Examples:"
    echo "  # Interactive mode (prompts for .env confirmation)"
    echo "  $0"
    echo ""
    echo "  # Automated mode (auto-confirms .env loading)"
    echo "  $0 --auto-confirm"
    echo ""
    echo "  # Set environment variables manually and run"
    echo "  export CLERK_PUBLISHABLE_KEY=\"pk_live_...\""
    echo "  export CLERK_SECRET_KEY=\"sk_live_...\""
    echo "  export AZURE_KEY_VAULT_NAME=\"my-key-vault\""
    echo "  $0"
    echo ""
    echo "Security Note:"
    echo "  By default, the script will prompt before loading .env files to prevent"
    echo "  accidental exposure of secrets in shared environments. Use --auto-confirm"
    echo "  only in trusted, automated environments."
    exit 0
fi

# Function to prompt for user confirmation
prompt_user_confirmation() {
    local message="$1"
    local response
    
    while true; do
        read -p "$(yellow "$message") [y/N]: " response
        case "$response" in
            [Yy]|[Yy][Ee][Ss])
                return 0
                ;;
            [Nn]|[Nn][Oo]|"")
                return 1
                ;;
            *)
                echo "$(red "Please answer yes or no.")"
                ;;
        esac
    done
}

# Load environment variables if .env file exists (with user confirmation)
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    echo "$(blue "📋 Found .env file at: $PROJECT_ROOT/.env")"
    
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        echo "$(blue "📋 Auto-confirming .env file loading (--auto-confirm flag used)")"
        echo "$(blue "📋 Loading environment variables from .env file...")"
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
        green "✅ Environment variables loaded successfully"
    else
        echo "$(yellow "⚠️  This file may contain sensitive environment variables.")"
        
        if prompt_user_confirmation "🔒 Do you want to load environment variables from the .env file?"; then
            echo "$(blue "📋 Loading environment variables from .env file...")"
            set -a
            source "$PROJECT_ROOT/.env"
            set +a
            green "✅ Environment variables loaded successfully"
        else
            echo "$(yellow "⏭️  Skipped loading .env file - please ensure required variables are set in your environment")"
        fi
    fi
else
    echo "$(blue "📋 No .env file found at: $PROJECT_ROOT/.env")"
    echo "$(yellow "💡 You can create one with your environment variables or set them manually")"
fi

# Function to check if Azure CLI is installed and logged in
check_azure_cli() {
    if ! command -v az &> /dev/null; then
        red "❌ Azure CLI is not installed. Please install it first:"
        echo "   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
        exit 1
    fi
    
    if ! az account show &> /dev/null; then
        red "❌ You are not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    
    green "✅ Azure CLI is installed and authenticated"
}

# Function to validate required environment variables
validate_env_vars() {
    local missing_vars=()
    
    # Check for Clerk variables
    if [[ -z "${CLERK_PUBLISHABLE_KEY:-}" ]]; then
        missing_vars+=("CLERK_PUBLISHABLE_KEY")
    fi
    
    if [[ -z "${CLERK_SECRET_KEY:-}" ]]; then
        missing_vars+=("CLERK_SECRET_KEY")
    fi
    
    # Check for Key Vault name (try multiple possible variable names)
    if [[ -z "${AZURE_KEY_VAULT_NAME:-}" && -z "${KEY_VAULT_NAME:-}" ]]; then
        missing_vars+=("AZURE_KEY_VAULT_NAME or KEY_VAULT_NAME")
    fi
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        red "❌ Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "   - $var"
        done
        echo ""
        echo "$(yellow "💡 Set these variables in your environment or .env file:")"
        echo "   export CLERK_PUBLISHABLE_KEY=\"pk_live_YOUR_CLERK_PUBLISHABLE_KEY\""
        echo "   export CLERK_SECRET_KEY=\"sk_live_YOUR_CLERK_SECRET_KEY\""
        echo "   export AZURE_KEY_VAULT_NAME=\"your-key-vault-name\""
        echo ""
        echo "$(yellow "💡 You can also get the Key Vault name from your Azure deployment:")"
        echo "   az deployment group show --resource-group YOUR_RG --name pixel-deployment --query 'properties.outputs.keyVaultName.value' -o tsv"
        exit 1
    fi
    
    green "✅ All required environment variables are set"
}

# Function to get Key Vault name from environment or Azure deployment
get_key_vault_name() {
    local vault_name=""
    
    # Try to get from environment variables
    if [[ -n "${AZURE_KEY_VAULT_NAME:-}" ]]; then
        vault_name="$AZURE_KEY_VAULT_NAME"
    elif [[ -n "${KEY_VAULT_NAME:-}" ]]; then
        vault_name="$KEY_VAULT_NAME"
    else
        # Try to get from Azure deployment output
        if [[ -n "${AZURE_RESOURCE_GROUP:-}" ]]; then
            echo "$(blue "🔍 Attempting to retrieve Key Vault name from Azure deployment...")"
            vault_name=$(az deployment group show \
                --resource-group "$AZURE_RESOURCE_GROUP" \
                --name "pixel-deployment" \
                --query 'properties.outputs.keyVaultName.value' \
                -o tsv 2>/dev/null || echo "")
            
            if [[ -n "$vault_name" && "$vault_name" != "null" ]]; then
                echo "$(green "✅ Found Key Vault from deployment: $vault_name")"
            fi
        fi
    fi
    
    echo "$vault_name"
}

# Function to verify Key Vault access
verify_key_vault_access() {
    local vault_name="$1"
    
    echo "$(blue "🔐 Verifying access to Key Vault: $vault_name")"
    
    if ! az keyvault show --name "$vault_name" --output none 2>/dev/null; then
        red "❌ Cannot access Key Vault '$vault_name'."
        echo "   Please check:"
        echo "   1. The Key Vault name is correct"
        echo "   2. You have the necessary permissions (Key Vault Secrets Officer or Contributor)"
        echo "   3. The Key Vault exists in your current subscription"
        echo ""
        echo "$(yellow "💡 Current subscription:")"
        az account show --query '{name:name, id:id}' -o table
        exit 1
    fi
    
    green "✅ Successfully verified access to Key Vault: $vault_name"
}

# Function to set a secret in Key Vault
set_key_vault_secret() {
    local vault_name="$1"
    local secret_name="$2"
    local secret_value="$3"
    local description="$4"
    
    echo "$(blue "🔑 Setting secret: $secret_name")"
    
    if az keyvault secret set \
        --vault-name "$vault_name" \
        --name "$secret_name" \
        --value "$secret_value" \
        --description "$description" \
        --output none; then
        green "✅ Successfully set secret: $secret_name"
    else
        red "❌ Failed to set secret: $secret_name"
        return 1
    fi
}

# Function to configure Clerk secrets
configure_clerk_secrets() {
    local vault_name="$1"
    
    echo "$(bold "🔐 Configuring Clerk secrets in Key Vault: $vault_name")"
    echo ""
    
    # Set Clerk Publishable Key
    set_key_vault_secret \
        "$vault_name" \
        "CLERK-PUBLISHABLE-KEY" \
        "$CLERK_PUBLISHABLE_KEY" \
        "Clerk publishable key for client-side authentication"
    
    # Alternative naming convention for compatibility
    set_key_vault_secret \
        "$vault_name" \
        "PUBLIC-CLERK-PUBLISHABLE-KEY" \
        "$CLERK_PUBLISHABLE_KEY" \
        "Clerk publishable key (alternative naming)"
    
    # Set Clerk Secret Key
    set_key_vault_secret \
        "$vault_name" \
        "CLERK-SECRET-KEY" \
        "$CLERK_SECRET_KEY" \
        "Clerk secret key for server-side authentication"
    
    # Optional: Set Clerk domain if provided
    if [[ -n "${CLERK_DOMAIN:-}" ]]; then
        set_key_vault_secret \
            "$vault_name" \
            "CLERK-DOMAIN" \
            "$CLERK_DOMAIN" \
            "Clerk domain for custom domain setup"
    fi
    
    # Optional: Set Clerk webhook signing secret if provided
    if [[ -n "${CLERK_WEBHOOK_SECRET:-}" ]]; then
        set_key_vault_secret \
            "$vault_name" \
            "CLERK-WEBHOOK-SECRET" \
            "$CLERK_WEBHOOK_SECRET" \
            "Clerk webhook signing secret for webhook verification"
    fi
}

# Function to display configuration summary
display_summary() {
    local vault_name="$1"
    
    echo ""
    echo "$(bold "📊 Configuration Summary")"
    echo "========================"
    echo "Key Vault: $vault_name"
    echo "Secrets configured:"
    echo "  ✅ CLERK-PUBLISHABLE-KEY"
    echo "  ✅ PUBLIC-CLERK-PUBLISHABLE-KEY"
    echo "  ✅ CLERK-SECRET-KEY"
    
    if [[ -n "${CLERK_DOMAIN:-}" ]]; then
        echo "  ✅ CLERK-DOMAIN"
    fi
    
    if [[ -n "${CLERK_WEBHOOK_SECRET:-}" ]]; then
        echo "  ✅ CLERK-WEBHOOK-SECRET"
    fi
    
    echo ""
    echo "$(yellow "💡 Next steps:")"
    echo "1. Update your application configuration to use these secrets"
    echo "2. Ensure your Azure App Service has the necessary Key Vault access policies"
    echo "3. Configure your application to retrieve secrets from Key Vault at runtime"
    echo ""
    echo "$(yellow "💡 Useful commands:")"
    echo "  # List all secrets in the Key Vault"
    echo "  az keyvault secret list --vault-name $vault_name"
    echo ""
    echo "  # Get a specific secret value"
    echo "  az keyvault secret show --vault-name $vault_name --name CLERK-PUBLISHABLE-KEY --query value -o tsv"
    echo ""
    echo "  # Update App Service to use Key Vault references"
    echo "  az webapp config appsettings set --resource-group YOUR_RG --name YOUR_APP \\"
    echo "    --settings CLERK_PUBLISHABLE_KEY=\"@Microsoft.KeyVault(VaultName=$vault_name;SecretName=CLERK-PUBLISHABLE-KEY)\""
}

# Main execution
main() {
    echo "$(bold "🔐 Clerk Secrets Configuration for Azure Key Vault")"
    echo "=================================================="
    echo ""
    
    # Check prerequisites
    check_azure_cli
    validate_env_vars
    
    # Get Key Vault name
    vault_name=$(get_key_vault_name)
    if [[ -z "$vault_name" ]]; then
        red "❌ Could not determine Key Vault name."
        echo "   Please set AZURE_KEY_VAULT_NAME or KEY_VAULT_NAME environment variable."
        exit 1
    fi
    
    # Verify Key Vault access
    verify_key_vault_access "$vault_name"
    
    # Configure secrets
    configure_clerk_secrets "$vault_name"
    
    # Display summary
    display_summary "$vault_name"
    
    echo ""
    green "🎉 Clerk secrets have been successfully configured in Azure Key Vault!"
}

# Run main function
main "$@"
