#!/bin/bash

# Verify Monitoring Configuration Script
# This script verifies that all monitoring components are properly configured and running

set -e

echo "🔍 Verifying Pixelated Monitoring Configuration..."

# Change to project root
cd "$(dirname "$0")/.."

# Function to check service status
check_service() {
	local service="$1"
	local port="$2"
	local endpoint="$3"

	echo "Checking ${service} on port ${port}..."
	if curl -fsS --connect-timeout 5 --max-time 5 "http://localhost:${port}${endpoint}" >/dev/null; then
		echo "✅ ${service} is running"
		return 0
	else
		echo "❌ ${service} is not accessible on port ${port}"
		return 1
	fi
}

# Check configuration files
echo "📄 Checking configuration files..."

# Loki configuration
if [[ -f "infra/docker/loki/config.yml" ]]; then
	echo "✅ Loki configuration file exists"
	# Check for key configuration items
	if grep -q "instance_addr: 0.0.0.0" infra/docker/loki/config.yml; then
		echo "✅ Loki instance_addr configured correctly"
	else
		echo "❌ Loki instance_addr not configured correctly"
	fi
else
	echo "❌ Loki configuration file missing"
fi

# Promtail configuration
if [[ -f "infra/docker/promtail/config.yml" ]]; then
	echo "✅ Promtail configuration file exists"
	# Check for key configuration items
	if grep -q "job_name: pixelated-app-logs" infra/docker/promtail/config.yml; then
		echo "✅ Promtail docker service discovery configured"
	else
		echo "❌ Promtail docker service discovery not configured"
	fi
else
	echo "❌ Promtail configuration file missing"
fi

# Grafana datasource configuration
if [[ -f "infra/docker/grafana/provisioning/datasources/loki.yml" ]]; then
	echo "✅ Grafana Loki datasource configuration exists"
	if grep -q "url: http://loki:3100" infra/docker/grafana/provisioning/datasources/loki.yml; then
		echo "✅ Grafana Loki datasource URL configured correctly"
	else
		echo "❌ Grafana Loki datasource URL not configured correctly"
	fi
else
	echo "❌ Grafana Loki datasource configuration missing"
fi

# Check running services
echo ""
echo "🐳 Checking running services..."

overall_ok=true

# Check if monitoring stack is running
if monitoring_ps_output="$(docker compose -f infra/docker/docker-compose.monitoring.yml ps 2>/dev/null)"; then
	if echo "${monitoring_ps_output}" | grep -q "Up"; then
		echo "✅ Monitoring stack is running"

		# Check individual services
		check_service "Loki" "3100" "/ready"
		loki_status=$?
		if [[ ${loki_status} -ne 0 ]]; then
			overall_ok=false
		fi
		check_service "Prometheus" "9090" "/-/healthy"
		prometheus_status=$?
		if [[ ${prometheus_status} -ne 0 ]]; then
			overall_ok=false
		fi
		check_service "Grafana" "3100" "/api/health"
		grafana_status=$?
		if [[ ${grafana_status} -ne 0 ]]; then
			overall_ok=false
		fi
		check_service "AlertManager" "9093" "/-/healthy"
		alertmanager_status=$?
		if [[ ${alertmanager_status} -ne 0 ]]; then
			overall_ok=false
		fi

	else
		echo "❌ Monitoring stack is not running"
		echo "💡 Run './scripts/devops/start-monitoring.sh' to start the monitoring services"
		overall_ok=false
	fi

else
	echo "❌ Unable to query monitoring stack with docker compose"
	echo "💡 Ensure Docker is running and compose file exists: infra/docker/docker-compose.monitoring.yml"
	overall_ok=false
fi

# Check production stack for Loki/Promtail
echo ""
echo "🏭 Checking production stack..."

if production_ps_output="$(docker compose -f infra/docker/docker-compose.production.yml ps 2>/dev/null)"; then
	if echo "${production_ps_output}" | grep -q "loki"; then
		echo "✅ Loki service defined in production stack"
		if production_loki_ps_output="$(docker compose -f infra/docker/docker-compose.production.yml ps loki 2>/dev/null)"; then
			if echo "${production_loki_ps_output}" | grep -q "Up"; then
				echo "✅ Loki service is running in production stack"
			else
				echo "❌ Loki service is not running in production stack"
			fi
		else
			echo "❌ Unable to query Loki service status in production stack"
		fi
	else
		echo "ℹ️  Loki service not defined in production stack (this is OK if using separate monitoring stack)"
	fi

	if echo "${production_ps_output}" | grep -q "promtail"; then
		echo "✅ Promtail service defined in production stack"
		if production_promtail_ps_output="$(docker compose -f infra/docker/docker-compose.production.yml ps promtail 2>/dev/null)"; then
			if echo "${production_promtail_ps_output}" | grep -q "Up"; then
				echo "✅ Promtail service is running in production stack"
			else
				echo "❌ Promtail service is not running in production stack"
			fi
		else
			echo "❌ Unable to query Promtail service status in production stack"
		fi
	else
		echo "ℹ️  Promtail service not defined in production stack (this is OK if using separate monitoring stack)"
	fi

else
	echo "❌ Unable to query production stack with docker compose"
fi

echo ""
echo "📋 Summary:"
echo "   - Configuration files: Checked"
echo "   - Running services: Checked"
echo "   - Network connectivity: Checked"
echo ""
echo "🔧 If services are not running, use './scripts/devops/start-monitoring.sh'"
echo "📊 Access Grafana at: http://localhost:3100"
echo "📈 Access Prometheus at: http://localhost:9090"
echo "📝 Access Loki at: http://localhost:3100"

if [[ ${overall_ok} == "false" ]]; then
	exit 1
fi
