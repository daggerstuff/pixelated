#!/bin/bash

# Setup Forgejo Secrets for Pixelated Empathy
# This script helps you set up the required secrets in your Forgejo repository

set -e

echo "🔐 Setting up Forgejo Secrets for Pixelated Empathy"
echo "=================================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Get repository info
REPO_OWNER=$(git remote get-url origin | sed -n 's/.*github\.com[:/]\([^/]*\)\/\([^/]*\)\.git.*/\1/p')
REPO_NAME=$(git remote get-url origin | sed -n 's/.*github\.com[:/]\([^/]*\)\/\([^/]*\)\.git.*/\2/p')

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
    echo "❌ Error: Could not determine repository owner/name from git remote"
    echo "Please ensure you have a valid git remote pointing to your Forgejo repository"
    exit 1
fi

echo "📦 Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "📄 Found .env file - will use it to suggest secrets"
    echo ""
    
    # Parse .env file and suggest secrets
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
        
        echo "🔑 Secret: $key"
        echo "   Current value: ${value:0:20}..."
        echo "   To set: fj secret set $key 'your-value-here'"
        echo ""
    done < .env
else
    echo "⚠️  No .env file found. Here are the recommended secrets to set:"
    echo ""
    
    # List recommended secrets
    declare -a secrets=(
        "DATABASE_URL"
        "DATABASE_HOST"
        "DATABASE_PORT"
        "DATABASE_NAME"
        "DATABASE_USER"
        "DATABASE_PASSWORD"
        "JWT_SECRET"
        "SESSION_SECRET"
        "OPENAI_API_KEY"
        "ANTHROPIC_API_KEY"
        "REDIS_URL"
        "SMTP_HOST"
        "SMTP_PORT"
        "SMTP_USER"
        "SMTP_PASSWORD"
        "SENTRY_DSN"
        "LOGTAIL_TOKEN"
        "ENABLE_AI_FEATURES"
        "ENABLE_ANALYTICS"
    )
    
    for secret in "${secrets[@]}"; do
        echo "🔑 Secret: $secret"
        echo "   To set: fj secret set $secret 'your-value-here'"
        echo ""
    done
fi

echo "📋 Instructions:"
echo "1. Install forgejo-cli if you haven't already:"
echo "   cargo install forgejo-cli"
echo ""
echo "2. Set each secret using:"
echo "   fj secret set SECRET_NAME 'your-value'"
echo ""
echo "3. For sensitive values, you can also use:"
echo "   echo 'your-secret-value' | fj secret set SECRET_NAME"
echo ""
echo "4. List all secrets:"
echo "   fj secret list"
echo ""
echo "5. Test your workflow by pushing to master or using workflow_dispatch"
echo ""

# Check if forgejo-cli is available
if command -v fj >/dev/null 2>&1; then
    echo "✅ forgejo-cli (fj) is available"
    echo ""
    echo "Current secrets:"
    fj secret list 2>/dev/null || echo "No secrets found or not authenticated"
else
    echo "⚠️  forgejo-cli (fj) not found. Install it with:"
    echo "   cargo install forgejo-cli"
fi

echo ""
echo "🎉 Setup complete! Add your secrets and test the deployment."
