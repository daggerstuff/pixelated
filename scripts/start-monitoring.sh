#!/bin/bash

# Start Monitoring Services Script
# This script starts the Loki, Promtail, Prometheus, Grafana, and AlertManager services

set -e

echo "🚀 Starting Pixelated Monitoring Stack..."

# Change to project root
cd "$(dirname "$0")/.."

# Create necessary directories
mkdir -p docker/loki/chunks
mkdir -p docker/loki/rules
mkdir -p docker/prometheus/data
mkdir -p docker/grafana/data

echo "📁 Created necessary directories"

# Start monitoring services
echo "🐳 Starting monitoring containers..."
docker compose -f docker/docker-compose.monitoring.yml -f docker/docker-compose.production.yml up -d loki promtail prometheus grafana alertmanager

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker compose -f docker/docker-compose.monitoring.yml -f docker/docker-compose.production.yml ps

# Test Loki connectivity
echo "🧪 Testing Loki connectivity..."
curl -fsS --connect-timeout 5 --max-time 5 http://localhost:3100/ready >/dev/null || echo "❌ Loki not ready"

# Test Prometheus connectivity
echo "🧪 Testing Prometheus connectivity..."
curl -fsS --connect-timeout 5 --max-time 5 http://localhost:9090/-/healthy >/dev/null || echo "❌ Prometheus not ready"

# Test Grafana connectivity
echo "🧪 Testing Grafana connectivity..."
curl -fsS --connect-timeout 5 --max-time 5 http://localhost:3001/api/health >/dev/null || echo "❌ Grafana not ready"

echo "✅ Monitoring stack startup completed!"
echo ""
echo "📊 Access the services at:"
echo "   Prometheus: http://localhost:9090"
echo "   Grafana: http://localhost:3001 (admin:${GRAFANA_ADMIN_PASSWORD:-admin})"
echo "   Loki: http://localhost:3100"
echo "   AlertManager: http://localhost:9093"
echo ""
echo "💡 Next steps:"
echo "   1. Login to Grafana and verify Loki datasource"
echo "   2. Check if logs are appearing in Loki"
echo "   3. Verify Prometheus is scraping metrics"
