#!/bin/bash

# Bias Detection Service Startup Script

# Activate virtual environment
source .venv/bin/activate

# Load environment variables
if [[ -f ".env.bias-detection" ]]; then
	export $(cat .env.bias-detection | grep -v '#' | xargs)
fi

# Start the bias detection service with Gunicorn
echo "Starting Bias Detection Service with Gunicorn..."
gunicorn -c src/lib/ai/bias-detection/gunicorn_config.py "start-python-service:app"
