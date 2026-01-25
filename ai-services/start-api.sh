#!/bin/bash
# Start Pixelated Empathy Therapeutic AI API

set -e

echo "🚀 Starting Pixelated Empathy Therapeutic AI API"
echo "================================================="

# Activate virtual environment
source ~/pixelated/.venv/bin/activate

# Navigate to API directory
cd ~/pixelated/ai-services

# Check if already running
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  API already running on port 5000"
    echo "Kill with: lsof -ti:5000 | xargs kill -9"
    exit 1
fi

# Start API
echo "📡 Starting Flask API on http://0.0.0.0:5000"
echo "Press Ctrl+C to stop"
echo ""

python api.py
