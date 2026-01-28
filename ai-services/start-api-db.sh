#!/bin/bash
# Start Pixelated Empathy Therapeutic AI API with Database

set -e

echo "🚀 Starting Pixelated Empathy Therapeutic AI API (with DB)"
echo "=========================================================="

# Activate virtual environment
# shellcheck source=/dev/null
source ~/pixelated/.venv/bin/activate

# Set Environment Variables
# MONGODB_URI should be set in your environment or .env file
# Never commit credentials to version control!
if [[ -z ${MONGODB_URI} ]]; then
	echo "❌ ERROR: MONGODB_URI environment variable is not set"
	echo "Please set it in your environment or load from .env file"
	exit 1
fi

# Navigate to API directory
cd ~/pixelated/ai-services

# Kill existing process
if [[ -f api.pid ]]; then
	PID=$(cat api.pid)
	# Check if process is actually running
	if kill -0 "${PID}" 2>/dev/null; then
		echo "🛑 Stopping existing API (PID: ${PID})"
		kill "${PID}"
		sleep 2
	else
		echo "⚠️  PID file exists but process ${PID} is not running"
	fi
	rm api.pid
fi

# Start API (Unbuffered output)
echo "📡 Starting Flask API on http://0.0.0.0:5000"
nohup python -u api.py >api.log 2>&1 &
API_PID=$!
echo "${API_PID}" >api.pid

echo "✅ API Started (PID: ${API_PID})"
echo "📝 Logs: ~/pixelated/ai-services/api.log"
