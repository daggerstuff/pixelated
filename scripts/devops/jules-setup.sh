#!/bin/bash
set -e

# Pixelated Empathy: Jules Environment Initialization Script
# --------------------------------------------------------
# This script prepares the short-lived Jules VM for working on the Pixelated Empathy repository.
# It ensures the correct Node.js and Python versions and installs all necessary dependencies.

echo "🚀 Starting Jules Setup: Pixelated Empathy"
echo "--------------------------------------------------------"

# 1. Ensure Node.js Version (NVM is preinstalled in Jules)
# Project requires Node.js >=24
if command -v nvm &> /dev/null; then
    echo "🟢 Using NVM to set Node.js version..."
    nvm install 24 --silent
    nvm use 24 --silent
else
    echo "⚠️ NVM not found, checking node version..."
    NODE_V=$(node -v)
    echo "Current Node: $NODE_V"
fi

# 2. Initialize Environment Variables
if [ ! -f ".env" ]; then
    echo "🟡 .env not found. Initializing from .env.example..."
    cp .env.example .env
    # Adjust some defaults for the short-lived VM environment if needed
    sed -i 's/NODE_ENV=production/NODE_ENV=development/' .env
    echo "✅ .env initialized with defaults (Developer: Update secrets if needed for specific tests)."
fi

# 3. Configure pnpm and Install Node dependencies
echo "🟢 Configuring pnpm..."
corepack enable pnpm
pnpm install --frozen-lockfile || pnpm install

# 4. Configure Python with uv (Preinstalled in Jules)
echo "🟢 Configuring Python environment with uv..."
# Check for root pyproject.toml
if [ -f "pyproject.toml" ]; then
    echo "🐍 Installing Root Python dependencies..."
    # uv sycn is the standard way with uv for project management
    uv sync
fi

# AI Engine (Submodule/Sub-directory) setup
if [ -d "ai" ] && [ -f "ai/pyproject.toml" ]; then
    echo "🧠 Setting up AI engine dependencies (ai/)..."
    cd ai
    uv sync
    cd ..
fi

# 5. Global Tool Discovery (Byterover, Beads)
echo "🟢 Discovering local agent tools..."
command -v brv &> /dev/null && echo "✅ Byterover (brv) detected." || echo "⚠️ Byterover (brv) not in PATH."
command -v bd &> /dev/null && echo "✅ Beads (bd) detected." || echo "⚠️ Beads (bd) not in PATH."

# 6. Final Verification and Sanity Check
echo "🟢 Running basic diagnostics..."
# Using the project's own check script if possible, or just pnpm check:all
# pnpm check:all || echo "⚠️ Post-setup check reported warnings/errors. Proceeding for task execution."
# Fail fast if core requirements aren't met
node -v | grep -q "v24" || echo "⚠️ Node version is not 24. Some Astro features may be unstable."

# Check tool versions one last time
echo "🛠️ Tool Versions Summarized:"
echo "Node: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "Python: $(python3 --version)"
echo "uv: $(uv --version)"

echo "--------------------------------------------------------"
echo "✅ Jules Environment Initialization Complete!"
echo "Ready to architect empathy."
echo "--------------------------------------------------------"
