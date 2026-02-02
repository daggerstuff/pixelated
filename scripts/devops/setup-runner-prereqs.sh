#!/bin/bash
# Setup script for Pixelated Empathy Azure DevOps Runner
# This script installs Docker, Node.js, Python, pnpm, and uv.
set -euo pipefail

# Work in /home/azureuser
export HOME=/home/azureuser
cd $HOME

echo "Updating system..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release build-essential make g++ python3 python3-dev jq git libssl-dev libffi-dev python3-pip

echo "Installing Docker..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "Configuring Docker permissions..."
usermod -aG docker azureuser
chmod 666 /var/run/docker.sock

echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
corepack enable pnpm

echo "Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sudo -u azureuser sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> $HOME/.bashrc

echo "Downloading Azure DevOps Agent..."
mkdir -p $HOME/azagent
cd $HOME/azagent
# Get latest agent version url (typically x64 linux)
AGENT_VERSION=$(curl -s https://api.github.com/repos/Microsoft/vsts-agent/releases/latest | jq -r .tag_name | sed 's/^v//')
curl -LSs -o vsts-agent-linux-x64-$AGENT_VERSION.tar.gz https://vstsagentpackage.azureedge.net/agent/$AGENT_VERSION/vsts-agent-linux-x64-$AGENT_VERSION.tar.gz
tar zxvf vsts-agent-linux-x64-$AGENT_VERSION.tar.gz
chown -R azureuser:azureuser $HOME/azagent

echo "✅ Prerequisites installed."
echo "--------------------------------------------------------"
echo "NEXT STEPS:"
echo "1. SSH into the VM: ssh azureuser@172.190.155.52"
echo "2. Run the agent configuration:"
echo "   cd ~/azagent"
echo "   ./config.sh"
echo "3. Enter your Azure DevOps URL and PAT when prompted."
echo "--------------------------------------------------------"
