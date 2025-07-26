#!/bin/bash

# Migration script from build-specific to stable deployment
# This script helps migrate from pixel-{buildid} to stable pixelated-web deployment

set -e

RESOURCE_GROUP="pixelated-rg"
STABLE_APP_NAME="pixelated-web"

echo "🚀 Migrating to Stable Deployment Strategy"
echo "=========================================="

# Function to list old container apps
list_old_apps() {
    echo "📋 Current Container Apps:"
    az containerapp list \
        --resource-group "$RESOURCE_GROUP" \
        --query "[?starts_with(name, 'pixel-')].{Name:name, Status:properties.provisioningState, URL:properties.configuration.ingress.fqdn}" \
        --output table
}

# Function to check if stable app exists
check_stable_app() {
    if az containerapp show --name "$STABLE_APP_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
        echo "✅ Stable container app '$STABLE_APP_NAME' already exists"
        return 0
    else
        echo "ℹ️  Stable container app '$STABLE_APP_NAME' does not exist yet"
        return 1
    fi
}

# Function to clean up old apps
cleanup_old_apps() {
    echo "🧹 Cleaning up old build-specific container apps..."
    
    OLD_APPS=$(az containerapp list \
        --resource-group "$RESOURCE_GROUP" \
        --query "[?starts_with(name, 'pixel-') && name != '$STABLE_APP_NAME'].name" \
        --output tsv)
    
    if [ -z "$OLD_APPS" ]; then
        echo "✅ No old container apps to clean up"
        return
    fi
    
    echo "Old apps to delete:"
    echo "$OLD_APPS"
    echo ""
    
    read -p "❓ Delete these old container apps? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$OLD_APPS" | while read app_name; do
            if [ ! -z "$app_name" ]; then
                echo "🗑️  Deleting: $app_name"
                az containerapp delete \
                    --name "$app_name" \
                    --resource-group "$RESOURCE_GROUP" \
                    --yes \
                    --only-show-errors || {
                    echo "⚠️  Failed to delete $app_name, continuing..."
                }
            fi
        done
        echo "✅ Cleanup completed"
    else
        echo "⏭️  Skipping cleanup"
    fi
}

# Function to show DNS instructions
show_dns_instructions() {
    echo ""
    echo "🌐 DNS Configuration Required"
    echo "=============================="
    
    if check_stable_app; then
        APP_FQDN=$(az containerapp show \
            --name "$STABLE_APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --query "properties.configuration.ingress.fqdn" \
            --output tsv)
        
        echo "✅ Stable app FQDN: $APP_FQDN"
        echo ""
        echo "Update your DNS records to point to:"
        echo "  $APP_FQDN"
        echo ""
        echo "Example DNS record:"
        echo "  Type: CNAME"
        echo "  Name: yourdomain.com (or @)"
        echo "  Value: $APP_FQDN"
    else
        echo "ℹ️  Run the pipeline with deploymentStrategy='update' to create the stable app"
        echo "   Then update your DNS to point to: pixelated-web.{environment-domain}"
    fi
}

# Function to show pipeline configuration
show_pipeline_config() {
    echo ""
    echo "⚙️  Required Pipeline Configuration"
    echo "=================================="
    echo "Update your azure-pipelines.yml variables:"
    echo ""
    echo "variables:"
    echo "- name: deploymentStrategy"
    echo "  value: 'update'  # STABLE - DNS never changes!"
    echo "- name: customDomain"
    echo "  value: 'yourdomain.com'  # Your actual domain"
    echo ""
    echo "Then commit and run your pipeline!"
}

# Main execution
echo "Checking current state..."
list_old_apps
echo ""

cleanup_old_apps
show_dns_instructions
show_pipeline_config

echo ""
echo "🎉 Migration checklist:"
echo "  1. ✅ Review old container apps"
echo "  2. ✅ Clean up old apps (if desired)" 
echo "  3. 🔄 Update pipeline variables (deploymentStrategy='update')"
echo "  4. 🔄 Update DNS records to point to stable app"
echo "  5. 🔄 Run pipeline to create/update stable container app"
echo ""
echo "After migration:"
echo "  ✅ DNS records never need to change again"
echo "  ✅ Container app updates in place"
echo "  ✅ No more pixel-{buildid} bullshit!"
