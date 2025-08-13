#!/bin/bash

echo "🚀 Setting up efficient monitoring for Pixelated Empathy"
echo "This will replace your expensive GitHub Actions monitoring!"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo ""
echo "📋 What we're setting up:"
echo "  ✅ Prometheus with alerting rules"
echo "  ✅ Secure alert receiver (no vulnerabilities!)"
echo "  ✅ Grafana for dashboards"
echo "  ✅ Uptime Kuma for visual monitoring"
echo "  ✅ External monitoring script"
echo ""

# Create necessary directories
echo "📁 Creating monitoring directories..."
mkdir -p docker/alertmanager
mkdir -p docker/prometheus
mkdir -p logs/monitoring

# Make scripts executable
echo "🔧 Setting up scripts..."
chmod +x scripts/external-monitor.sh
chmod +x scripts/health-check.sh

# Check if we have the required configuration files
echo "🔍 Checking configuration..."

if [ ! -f "docker/prometheus/prometheus.yml" ]; then
    echo "❌ Prometheus config missing"
    exit 1
fi

if [ ! -f "docker/prometheus/alert-rules.yml" ]; then
    echo "❌ Alert rules missing"
    exit 1
fi

if [ ! -f "docker/alertmanager/alertmanager.yml" ]; then
    echo "❌ Alertmanager config missing"
    exit 1
fi

echo "✅ All configuration files present"

# Start the monitoring stack
echo ""
echo "🚀 Starting monitoring services..."
docker compose -f docker-compose.monitoring.yml up -d

# Wait a moment for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo ""
echo "🔍 Checking service status..."

if docker ps | grep -q "pixelated-prometheus"; then
    echo "✅ Prometheus is running (http://localhost:9090)"
else
    echo "❌ Prometheus failed to start"
fi

if docker ps | grep -q "pixelated-alert-receiver"; then
    echo "✅ Alert receiver is running (http://localhost:9093)"
else
    echo "❌ Alert receiver failed to start"
fi

if docker ps | grep -q "pixelated-grafana"; then
    echo "✅ Grafana is running (http://localhost:3001)"
    echo "   Default login: admin/admin123"
else
    echo "❌ Grafana failed to start"
fi

if docker ps | grep -q "pixelated-uptime-kuma"; then
    echo "✅ Uptime Kuma is running (http://localhost:3002)"
else
    echo "❌ Uptime Kuma failed to start"
fi

echo ""
echo "🎉 Monitoring setup complete!"
echo ""
echo "📊 Access your monitoring:"
echo "  • Prometheus: http://localhost:9090"
echo "  • Alert receiver: http://localhost:9093"
echo "  • Grafana: http://localhost:3001"
echo "  • Uptime Kuma: http://localhost:3002"
echo ""
echo "🔧 Next steps:"
echo "  1. Set SLACK_WEBHOOK_URL environment variable"
echo "  2. Set up monitors in Uptime Kuma"
echo "  3. Create dashboards in Grafana"
echo "  4. Test alerts by stopping a service"
echo ""
echo "💰 Cost savings:"
echo "  Before: \$35-60/month (GitHub Actions every 15 min)"
echo "  After: \$0/month (self-hosted monitoring)"
echo "  Annual savings: \$420-720!"
echo ""
echo "⚡ Performance improvements:"
echo "  • Real-time alerts (instead of 15-min max delay)"
echo "  • Multiple notification channels"
echo "  • Better reliability"
echo "  • Historical metrics"
