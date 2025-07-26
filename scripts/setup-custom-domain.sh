#!/bin/bash

# Azure Container Apps Custom Domain Setup Script
# Usage: ./setup-custom-domain.sh <domain> <container-app-name> <resource-group>

set -e

DOMAIN="$1"
APP_NAME="$2"
RESOURCE_GROUP="$3"

if [ -z "$DOMAIN" ] || [ -z "$APP_NAME" ] || [ -z "$RESOURCE_GROUP" ]; then
    echo "Usage: $0 <domain> <container-app-name> <resource-group>"
    echo "Example: $0 myapp.com pixel-195 pixelated-rg"
    exit 1
fi

echo "🌐 Setting up custom domain: $DOMAIN for Container App: $APP_NAME"

# Get Container App details
echo "Fetching Container App details..."
APP_FQDN=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn \
    --output tsv)

if [ -z "$APP_FQDN" ]; then
    echo "❌ Could not find Container App: $APP_NAME in resource group: $RESOURCE_GROUP"
    exit 1
fi

echo "✅ Found Container App FQDN: $APP_FQDN"

# Get Container App Environment
APP_ENV=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.managedEnvironmentId \
    --output tsv | xargs basename)

echo "✅ Container App Environment: $APP_ENV"

echo ""
echo "📋 DNS Configuration Required:"
echo "Create a CNAME record in your DNS provider:"
echo "   Name: $DOMAIN (or @ for root domain)"
echo "   Value: $APP_FQDN"
echo ""
echo "For root domains, you may need an ALIAS/ANAME record pointing to: $APP_FQDN"
echo ""
read -p "Have you configured the DNS record? (y/n): " dns_configured

if [ "$dns_configured" != "y" ]; then
    echo "Please configure DNS first and run this script again."
    exit 1
fi

echo "🔧 Adding custom domain to Container App..."

# Add hostname
az containerapp hostname add \
    --hostname "$DOMAIN" \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" || {
    echo "❌ Failed to add hostname. Check DNS configuration and try again."
    exit 1
}

echo "✅ Hostname added successfully"

echo "🔐 Creating managed certificate..."

# Create managed certificate
CERT_NAME="${DOMAIN//./-}-cert"
az containerapp env certificate create \
    --name "$CERT_NAME" \
    --environment "$APP_ENV" \
    --resource-group "$RESOURCE_GROUP" \
    --hostname "$DOMAIN" \
    --validation-method CNAME || {
    echo "❌ Failed to create managed certificate"
    echo "You may need to manually create and upload a certificate"
    exit 1
}

echo "✅ Managed certificate created"

echo "🔗 Binding certificate to hostname..."

# Get certificate ID
CERT_ID=$(az containerapp env certificate list \
    --environment "$APP_ENV" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?properties.subjectName=='$DOMAIN'].id | [0]" \
    --output tsv)

if [ -z "$CERT_ID" ]; then
    echo "❌ Could not find certificate for domain: $DOMAIN"
    exit 1
fi

# Bind certificate
az containerapp hostname bind \
    --hostname "$DOMAIN" \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --certificate "$CERT_ID" || {
    echo "❌ Failed to bind certificate"
    exit 1
}

echo "✅ Certificate bound successfully"

echo ""
echo "🎉 Custom domain setup completed!"
echo "Your app should now be accessible at: https://$DOMAIN"
echo ""
echo "Note: SSL certificate provisioning may take a few minutes."
echo "You can check the status with:"
echo "az containerapp hostname list --name $APP_NAME --resource-group $RESOURCE_GROUP"
