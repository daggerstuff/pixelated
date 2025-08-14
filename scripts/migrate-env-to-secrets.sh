#!/bin/bash

# Migrate .env file to Forgejo Secrets
# This script reads your .env file and helps you set up Forgejo secrets

set -e

echo "🔄 Migrating .env file to Forgejo Secrets"
echo "========================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file first or run the setup script"
    exit 1
fi

# Check if forgejo-cli is available
if ! command -v fj >/dev/null 2>&1; then
    echo "❌ Error: forgejo-cli (fj) not found"
    echo "Please install it first:"
    echo "   cargo install forgejo-cli"
    exit 1
fi

echo "📄 Reading .env file..."
echo ""

# Counter for secrets
total_secrets=0
set_secrets=0

# Read .env file and process each line
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
        continue
    fi
    
    # Remove leading/trailing whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    
    # Skip if key is empty
    if [ -z "$key" ]; then
        continue
    fi
    
    total_secrets=$((total_secrets + 1))
    
    echo "🔑 Processing: $key"
    
    # Check if secret already exists
    if fj secret list 2>/dev/null | grep -q "^$key$"; then
        echo "   ⚠️  Secret already exists, skipping..."
    else
        echo "   📝 Setting secret..."
        
        # Set the secret
        if echo "$value" | fj secret set "$key" 2>/dev/null; then
            echo "   ✅ Secret set successfully"
            set_secrets=$((set_secrets + 1))
        else
            echo "   ❌ Failed to set secret"
        fi
    fi
    
    echo ""
    
done < .env

echo "📊 Migration Summary:"
echo "   Total secrets found: $total_secrets"
echo "   Secrets set: $set_secrets"
echo "   Secrets skipped (already exist): $((total_secrets - set_secrets))"
echo ""

if [ $set_secrets -gt 0 ]; then
    echo "🎉 Migration completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Test your workflow by pushing to master"
    echo "2. Or trigger a manual deployment using workflow_dispatch"
    echo "3. Monitor the deployment logs to ensure secrets are working"
else
    echo "ℹ️  No new secrets were set (all already exist)"
fi

echo ""
echo "🔍 To verify your secrets:"
echo "   fj secret list"
