#!/bin/bash
set -e

echo "🔐 Flux Secrets Setup Script"
echo "============================"
echo ""
echo "This script will help you create the required secrets for Flux deployment."
echo ""

# Check kubectl access
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ ERROR: Cannot access Kubernetes cluster"
    echo "   Run: kubectl config use-context <your-civo-context>"
    exit 1
fi

echo "✅ kubectl is accessible"
echo ""

# Function to create Docker Hub secret
create_dockerhub_secret() {
    echo "🐳 Docker Hub Secret Setup"
    echo "------------------------"

    if kubectl get secret dockerhub-secret -n flux-system &>/dev/null; then
        echo "⚠️  Secret 'dockerhub-secret' already exists"
        read -p "Do you want to update it? (y/N): " update
        if [[ ! $update =~ ^[Yy]$ ]]; then
            echo "Skipping Docker Hub secret..."
            return
        fi
        kubectl delete secret dockerhub-secret -n flux-system
    fi

    read -p "Docker Hub Username: " DOCKERHUB_USERNAME
    read -sp "Docker Hub Token/Password: " DOCKERHUB_TOKEN
    echo ""
    read -p "Docker Hub Email: " DOCKERHUB_EMAIL

    kubectl create secret docker-registry dockerhub-secret \
      --docker-server=docker.io \
      --docker-username="$DOCKERHUB_USERNAME" \
      --docker-password="$DOCKERHUB_TOKEN" \
      --docker-email="$DOCKERHUB_EMAIL" \
      -n flux-system

    echo "✅ Docker Hub secret created successfully"
    echo ""
}

# Function to create GitHub token secret
create_github_token_secret() {
    echo "🔑 GitHub Token Secret Setup"
    echo "---------------------------"

    if kubectl get secret github-token -n flux-system &>/dev/null; then
        echo "⚠️  Secret 'github-token' already exists"
        read -p "Do you want to update it? (y/N): " update
        if [[ ! $update =~ ^[Yy]$ ]]; then
            echo "Skipping GitHub token secret..."
            return
        fi
        kubectl delete secret github-token -n flux-system
    fi

    echo "You need a GitHub Personal Access Token (PAT) with 'repo' scope."
    echo "Create one at: https://github.com/settings/tokens"
    echo ""
    read -p "GitHub Username: " GITHUB_USERNAME
    read -sp "GitHub Personal Access Token: " GITHUB_TOKEN
    echo ""

    # ImageUpdateAutomation needs username and password fields
    kubectl create secret generic github-token \
      --from-literal=username="$GITHUB_USERNAME" \
      --from-literal=password="$GITHUB_TOKEN" \
      -n flux-system

    echo "✅ GitHub token secret created successfully"
    echo ""
}

# Function to create/update GitRepository secret
create_gitrepo_secret() {
    echo "📦 GitRepository Secret Setup"
    echo "----------------------------"

    if kubectl get secret flux-system -n flux-system &>/dev/null; then
        echo "⚠️  Secret 'flux-system' already exists"
        read -p "Do you want to update it? (y/N): " update
        if [[ ! $update =~ ^[Yy]$ ]]; then
            echo "Skipping GitRepository secret..."
            return
        fi
        kubectl delete secret flux-system -n flux-system
    fi

    read -p "GitHub Username: " GITHUB_USERNAME
    read -sp "GitHub Personal Access Token (for reading repo): " GITHUB_PAT
    echo ""

    kubectl create secret generic flux-system \
      --from-literal=username="$GITHUB_USERNAME" \
      --from-literal=password="$GITHUB_PAT" \
      -n flux-system

    echo "✅ GitRepository secret created successfully"
    echo ""
}

# Main menu
echo "Select which secrets to create:"
echo "1) All secrets (Docker Hub + GitHub Token + GitRepository)"
echo "2) Docker Hub secret only"
echo "3) GitHub Token secret only"
echo "4) GitRepository secret only"
echo "5) Exit"
echo ""
read -p "Choice [1-5]: " choice

case $choice in
    1)
        create_dockerhub_secret
        create_github_token_secret
        create_gitrepo_secret
        ;;
    2)
        create_dockerhub_secret
        ;;
    3)
        create_github_token_secret
        ;;
    4)
        create_gitrepo_secret
        ;;
    5)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Secret setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify secrets exist: kubectl get secrets -n flux-system"
echo "2. Run diagnostic script: ./scripts/diagnose-flux-deployment.sh"
echo "3. Check Flux resource status: kubectl get -n flux-system gitrepository,imagerepository,imagepolicy,imageupdateautomation"
echo ""

