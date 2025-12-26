#!/bin/bash
set -e

# Pixelated Empathy - Monitoring Setup Script
# ===========================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="pixelated-empathy"
MONITORING_DIR="monitoring"
DOCKER_COMPOSE_MONITORING="docker/docker-compose.monitoring.yml"

# Functions
log_info() {
    echo -e "${BLUE}[MONITORING]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking monitoring setup prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if monitoring directory exists
    if [ ! -d "$MONITORING_DIR" ]; then
        log_error "Monitoring directory not found: $MONITORING_DIR"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_monitoring_compose() {
    log_info "Creating monitoring Docker Compose configuration..."
    
    cat > "$DOCKER_COMPOSE_MONITORING" << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: pixelated-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - monitoring
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: pixelated-grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning
      - ./monitoring/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    networks:
      - monitoring
    restart: unless-stopped
    depends_on:
      - prometheus

  node-exporter:
    image: prom/node-exporter:latest
    container_name: pixelated-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - monitoring
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: pixelated-cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    devices:
      - /dev/kmsg:/dev/kmsg
    networks:
      - monitoring
    restart: unless-stopped

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: pixelated-postgres-exporter
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require
    networks:
      - monitoring
    restart: unless-stopped

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: pixelated-redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://${REDIS_HOST}:${REDIS_PORT}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    networks:
      - monitoring
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    container_name: pixelated-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager:/etc/alertmanager
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    networks:
      - monitoring
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    container_name: pixelated-loki
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki:/etc/loki
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    container_name: pixelated-promtail
    volumes:
      - ./monitoring/promtail:/etc/promtail
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring
    restart: unless-stopped
    depends_on:
      - loki

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  loki_data:

networks:
  monitoring:
    driver: bridge
EOF

    log_success "Monitoring Docker Compose configuration created"
}

create_alertmanager_config() {
    log_info "Creating Alertmanager configuration..."
    
    mkdir -p monitoring/alertmanager
    
    cat > monitoring/alertmanager/alertmanager.yml << 'EOF'
global:
  smtp_smarthost: '${SMTP_HOST}:${SMTP_PORT}'
  smtp_from: '${ALERT_EMAIL_FROM}'
  smtp_auth_username: '${SMTP_USERNAME}'
  smtp_auth_password: '${SMTP_PASSWORD}'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://localhost:5001/'

  - name: 'critical-alerts'
    email_configs:
      - to: '${CRITICAL_ALERT_EMAIL}'
        subject: '[CRITICAL] Pixelated Empathy Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: 'Critical Alert - Pixelated Empathy'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'warning-alerts'
    email_configs:
      - to: '${WARNING_ALERT_EMAIL}'
        subject: '[WARNING] Pixelated Empathy Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF

    log_success "Alertmanager configuration created"
}

create_loki_config() {
    log_info "Creating Loki configuration..."
    
    mkdir -p monitoring/loki
    
    cat > monitoring/loki/local-config.yaml << 'EOF'
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

compactor:
  working_directory: /loki/boltdb-shipper-compactor
  shared_store: filesystem
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150
EOF

    log_success "Loki configuration created"
}

create_promtail_config() {
    log_info "Creating Promtail configuration..."
    
    mkdir -p monitoring/promtail
    
    cat > monitoring/promtail/config.yml << 'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*log

    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag:
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*))\|
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output

  - job_name: syslog
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          __path__: /var/log/syslog

  - job_name: application
    static_configs:
      - targets:
          - localhost
        labels:
          job: pixelated-empathy
          __path__: /var/log/pixelated-empathy/*.log
EOF

    log_success "Promtail configuration created"
}

setup_monitoring() {
    log_info "Setting up monitoring infrastructure..."
    
    # Create configurations
    create_monitoring_compose
    create_alertmanager_config
    create_loki_config
    create_promtail_config
    
    # Start monitoring services
    log_info "Starting monitoring services..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$DOCKER_COMPOSE_MONITORING" up -d
    else
        docker compose -f "$DOCKER_COMPOSE_MONITORING" up -d
    fi
    
    log_success "Monitoring services started"
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_service_health
}

check_service_health() {
    log_info "Checking monitoring service health..."
    
    local services=("prometheus:9090" "grafana:3001" "alertmanager:9093")
    
    for service in "${services[@]}"; do
        local name=$(echo "$service" | cut -d':' -f1)
        local port=$(echo "$service" | cut -d':' -f2)
        
        if curl -f "http://localhost:$port" &> /dev/null; then
            log_success "$name is healthy"
        else
            log_warning "$name may not be ready yet"
        fi
    done
}

show_monitoring_info() {
    log_info "Monitoring services information:"
    echo ""
    echo "  Prometheus:   http://localhost:9090"
    echo "  Grafana:      http://localhost:3001 (admin/admin)"
    echo "  Alertmanager: http://localhost:9093"
    echo "  Node Exporter: http://localhost:9100"
    echo "  cAdvisor:     http://localhost:8080"
    echo ""
    log_info "Import dashboards from monitoring/dashboards/ into Grafana"
}

stop_monitoring() {
    log_info "Stopping monitoring services..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$DOCKER_COMPOSE_MONITORING" down
    else
        docker compose -f "$DOCKER_COMPOSE_MONITORING" down
    fi
    
    log_success "Monitoring services stopped"
}

show_help() {
    echo "Pixelated Empathy Monitoring Setup"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup       Setup and start monitoring infrastructure"
    echo "  start       Start monitoring services"
    echo "  stop        Stop monitoring services"
    echo "  restart     Restart monitoring services"
    echo "  status      Check monitoring service status"
    echo "  info        Show monitoring service information"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup     # Setup and start monitoring"
    echo "  $0 status    # Check service status"
    echo "  $0 stop      # Stop all monitoring services"
}

# Main execution
main() {
    local command=${1:-help}
    
    case $command in
        "setup")
            check_prerequisites
            setup_monitoring
            show_monitoring_info
            ;;
        "start")
            check_prerequisites
            if command -v docker-compose &> /dev/null; then
                docker-compose -f "$DOCKER_COMPOSE_MONITORING" up -d
            else
                docker compose -f "$DOCKER_COMPOSE_MONITORING" up -d
            fi
            log_success "Monitoring services started"
            ;;
        "stop")
            stop_monitoring
            ;;
        "restart")
            stop_monitoring
            sleep 5
            if command -v docker-compose &> /dev/null; then
                docker-compose -f "$DOCKER_COMPOSE_MONITORING" up -d
            else
                docker compose -f "$DOCKER_COMPOSE_MONITORING" up -d
            fi
            log_success "Monitoring services restarted"
            ;;
        "status")
            check_service_health
            ;;
        "info")
            show_monitoring_info
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
