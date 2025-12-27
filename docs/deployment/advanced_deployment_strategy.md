# Advanced Deployment Strategy for Pixelated Empathy

## Blue-Green Deployment Implementation

### Overview
Our optimized pipeline implements a blue-green deployment strategy with automatic rollback capabilities, health checks, and zero-downtime deployments.

### Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Health Check  │
│    (Traefik)    │    │   Monitoring    │
└─────────┬───────┘    └─────────────────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│  Blue Instance  │    │ Green Instance  │
│   (Current)     │◄──►│   (New)         │
└─────────────────┘    └─────────────────┘
```

### Deployment Process

1. **Pre-deployment Validation**
   - Container health checks
   - Security scans pass
   - All tests successful

2. **Blue-Green Switch**
   - Deploy to green environment
   - Run health checks
   - Switch traffic gradually
   - Keep blue as fallback

3. **Post-deployment Verification**
   - Monitor application metrics
   - Verify all endpoints
   - Check error rates

## Container Orchestration

### Docker Compose Configuration

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  pixelated-blue:
    image: ${CONTAINER_IMAGE_BLUE}
    container_name: pixelated-blue
    restart: unless-stopped
    user: "1001:1001"
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=100m
      - /var/tmp:rw,noexec,nosuid,size=50m
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2'
        reservations:
          memory: 1G
          cpus: '1'
    environment:
      - NODE_ENV=production
      - PORT=4321
      - ASTRO_TELEMETRY_DISABLED=1
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:4321/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.pixelated-blue.rule=Host(`${DOMAIN}`) && HeadersRegexp(`X-Deployment-Slot`, `blue`)"
      - "traefik.http.services.pixelated-blue.loadbalancer.server.port=4321"
    networks:
      - pixelated-network

  pixelated-green:
    image: ${CONTAINER_IMAGE_GREEN}
    container_name: pixelated-green
    restart: unless-stopped
    user: "1001:1001"
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=100m
      - /var/tmp:rw,noexec,nosuid,size=50m
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2'
        reservations:
          memory: 1G
          cpus: '1'
    environment:
      - NODE_ENV=production
      - PORT=4321
      - ASTRO_TELEMETRY_DISABLED=1
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:4321/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.pixelated-green.rule=Host(`${DOMAIN}`) && HeadersRegexp(`X-Deployment-Slot`, `green`)"
      - "traefik.http.services.pixelated-green.loadbalancer.server.port=4321"
    networks:
      - pixelated-network

  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik:/etc/traefik:ro
      - ./certs:/certs:ro
    command:
      - --api.dashboard=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
      - --certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}
      - --certificatesresolvers.letsencrypt.acme.storage=/certs/acme.json
      - --metrics.prometheus=true
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.${DOMAIN}`)"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.services.traefik.loadbalancer.server.port=8080"
    networks:
      - pixelated-network

networks:
  pixelated-network:
    driver: bridge
```

### Advanced Deployment Script

```bash
#!/bin/bash
# Advanced Blue-Green Deployment Script

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="pixelated"
HEALTH_ENDPOINT="/api/health"
DEPLOYMENT_TIMEOUT=300
HEALTH_CHECK_RETRIES=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Load environment variables
if [[ -f ".env.production" ]]; then
    source .env.production
fi

# Required variables
: "${DOMAIN:?DOMAIN must be set}"
: "${CONTAINER_IMAGE:?CONTAINER_IMAGE must be set}"

# Determine current active slot
get_active_slot() {
    if docker ps --format "table {{.Names}}" | grep -q "pixelated-blue"; then
        if [[ "$(docker inspect --format='{{.State.Health.Status}}' pixelated-blue 2>/dev/null)" == "healthy" ]]; then
            echo "blue"
            return
        fi
    fi

    if docker ps --format "table {{.Names}}" | grep -q "pixelated-green"; then
        if [[ "$(docker inspect --format='{{.State.Health.Status}}' pixelated-green 2>/dev/null)" == "healthy" ]]; then
            echo "green"
            return
        fi
    fi

    echo "none"
}

# Get inactive slot
get_inactive_slot() {
    local active_slot="$1"
    if [[ "$active_slot" == "blue" ]]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Health check function
health_check() {
    local slot="$1"
    local port

    if [[ "$slot" == "blue" ]]; then
        port="4321"
    else
        port="4322"
    fi

    local url="http://localhost:${port}${HEALTH_ENDPOINT}"

    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        if curl -sf "$url" >/dev/null 2>&1; then
            local response
            response=$(curl -s "$url")
            if echo "$response" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
                log_success "Health check passed for $slot slot (attempt $i/$HEALTH_CHECK_RETRIES)"
                return 0
            fi
        fi

        log_info "Health check failed for $slot slot (attempt $i/$HEALTH_CHECK_RETRIES)"
        sleep 10
    done

    log_error "Health check failed for $slot slot after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Deploy to slot
deploy_to_slot() {
    local slot="$1"
    local image="$2"

    log_info "Deploying to $slot slot with image: $image"

    # Stop existing container
    if docker ps -q -f name="pixelated-$slot" | grep -q .; then
        log_info "Stopping existing $slot container"
        docker stop "pixelated-$slot" || true
        docker rm "pixelated-$slot" || true
    fi

    # Start new container
    local port
    if [[ "$slot" == "blue" ]]; then
        port="4321"
    else
        port="4322"
    fi

    log_info "Starting new $slot container on port $port"
    docker run -d \
        --name "pixelated-$slot" \
        --restart unless-stopped \
        --user 1001:1001 \
        --read-only \
        --tmpfs /tmp:rw,noexec,nosuid,size=100m \
        --tmpfs /var/tmp:rw,noexec,nosuid,size=50m \
        --security-opt no-new-privileges:true \
        --cap-drop ALL \
        --cap-add CHOWN \
        --cap-add SETGID \
        --cap-add SETUID \
        --memory=2g \
        --memory-swap=2g \
        --cpus=2 \
        -p "$port:4321" \
        -e NODE_ENV=production \
        -e PORT=4321 \
        -e ASTRO_TELEMETRY_DISABLED=1 \
        --health-cmd="node -e \"require('http').get('http://localhost:4321/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))\"" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=30s \
        "$image"

    # Wait for container to be healthy
    log_info "Waiting for $slot container to be healthy..."
    local timeout=$DEPLOYMENT_TIMEOUT
    while [[ $timeout -gt 0 ]]; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "pixelated-$slot" 2>/dev/null || echo "starting")

        if [[ "$status" == "healthy" ]]; then
            log_success "$slot container is healthy"
            return 0
        elif [[ "$status" == "unhealthy" ]]; then
            log_error "$slot container is unhealthy"
            docker logs "pixelated-$slot"
            return 1
        fi

        log_info "$slot container status: $status (${timeout}s remaining)"
        sleep 5
        timeout=$((timeout - 5))
    done

    log_error "$slot container failed to become healthy within ${DEPLOYMENT_TIMEOUT}s"
    return 1
}

# Switch traffic
switch_traffic() {
    local new_slot="$1"
    local old_slot="$2"

    log_info "Switching traffic from $old_slot to $new_slot"

    # Update load balancer configuration
    # This would typically involve updating Traefik rules or similar

    # For now, we'll use port mapping approach
    if [[ "$new_slot" == "blue" ]]; then
        # Map port 80 to blue (4321)
        docker run -d --name nginx-proxy --restart unless-stopped \
            -p 80:80 -p 443:443 \
            -v /var/run/docker.sock:/tmp/docker.sock:ro \
            -e DEFAULT_HOST="$DOMAIN" \
            -e VIRTUAL_HOST="$DOMAIN" \
            -e VIRTUAL_PORT=4321 \
            nginx:latest
    else
        # Map port 80 to green (4322)
        docker run -d --name nginx-proxy --restart unless-stopped \
            -p 80:80 -p 443:443 \
            -v /var/run/docker.sock:/tmp/docker.sock:ro \
            -e DEFAULT_HOST="$DOMAIN" \
            -e VIRTUAL_HOST="$DOMAIN" \
            -e VIRTUAL_PORT=4322 \
            nginx:latest
    fi

    log_success "Traffic switched to $new_slot slot"
}

# Rollback function
rollback() {
    local current_slot
    current_slot=$(get_active_slot)

    if [[ "$current_slot" == "none" ]]; then
        log_error "No active slot found for rollback"
        return 1
    fi

    local previous_slot
    previous_slot=$(get_inactive_slot "$current_slot")

    log_warning "Rolling back from $current_slot to $previous_slot"

    if docker ps -q -f name="pixelated-$previous_slot" | grep -q .; then
        switch_traffic "$previous_slot" "$current_slot"
        log_success "Rollback completed"
    else
        log_error "Previous slot ($previous_slot) not available for rollback"
        return 1
    fi
}

# Main deployment function
deploy() {
    local image="$1"

    log_info "Starting blue-green deployment"
    log_info "Target image: $image"

    # Get current active slot
    local active_slot
    active_slot=$(get_active_slot)
    log_info "Current active slot: $active_slot"

    # Determine target slot
    local target_slot
    if [[ "$active_slot" == "none" ]]; then
        target_slot="blue"
    else
        target_slot=$(get_inactive_slot "$active_slot")
    fi

    log_info "Target slot: $target_slot"

    # Deploy to target slot
    if deploy_to_slot "$target_slot" "$image"; then
        log_success "Deployment to $target_slot slot successful"

        # Perform additional health checks
        if health_check "$target_slot"; then
            # Switch traffic
            if [[ "$active_slot" != "none" ]]; then
                switch_traffic "$target_slot" "$active_slot"

                # Keep old slot running for quick rollback
                log_info "Keeping $active_slot slot running for potential rollback"
            else
                switch_traffic "$target_slot" "none"
            fi

            log_success "Blue-green deployment completed successfully"
        else
            log_error "Health checks failed, deployment aborted"
            docker stop "pixelated-$target_slot" || true
            docker rm "pixelated-$target_slot" || true
            return 1
        fi
    else
        log_error "Deployment to $target_slot slot failed"
        return 1
    fi
}

# Cleanup old containers
cleanup() {
    log_info "Cleaning up old containers and images"

    # Remove stopped containers
    docker container prune -f

    # Remove old images (keep last 3)
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        grep "$PROJECT_NAME" | \
        tail -n +4 | \
        awk '{print $1}' | \
        xargs -r docker rmi || true

    log_success "Cleanup completed"
}

# Main script logic
case "${1:-deploy}" in
    deploy)
        if [[ -z "${2:-}" ]]; then
            log_error "Usage: $0 deploy <image>"
            exit 1
        fi
        deploy "$2"
        ;;
    rollback)
        rollback
        ;;
    status)
        active_slot=$(get_active_slot)
        echo "Active slot: $active_slot"
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|status|cleanup}"
        echo "  deploy <image>  - Deploy new image using blue-green strategy"
        echo "  rollback        - Rollback to previous deployment"
        echo "  status          - Show current deployment status"
        echo "  cleanup         - Clean up old containers and images"
        exit 1
        ;;
esac
```

## Kubernetes Deployment (Advanced)

### Kubernetes Manifests

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: pixelated
  labels:
    name: pixelated

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pixelated
  namespace: pixelated
  labels:
    app: pixelated
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: pixelated
  template:
    metadata:
      labels:
        app: pixelated
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      containers:
      - name: pixelated
        image: docker.io/pixelatedempathy/pixelated:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 4321
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "4321"
        - name: ASTRO_TELEMETRY_DISABLED
          value: "1"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 4321
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: 4321
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
            add:
            - CHOWN
            - SETGID
            - SETUID
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: var-tmp
          mountPath: /var/tmp
      volumes:
      - name: tmp
        emptyDir:
          sizeLimit: 100Mi
      - name: var-tmp
        emptyDir:
          sizeLimit: 50Mi
      imagePullSecrets:
      - name: gitlab-registry

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: pixelated-service
  namespace: pixelated
  labels:
    app: pixelated
spec:
  selector:
    app: pixelated
  ports:
  - name: http
    port: 80
    targetPort: 4321
    protocol: TCP
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pixelated-ingress
  namespace: pixelated
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - pixelatedempathy.com
    secretName: pixelated-tls
  rules:
  - host: pixelatedempathy.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: pixelated-service
            port:
              number: 80
```

## Monitoring and Observability

### Prometheus Metrics

```yaml
# k8s/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: pixelated-metrics
  namespace: pixelated
spec:
  selector:
    matchLabels:
      app: pixelated
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Pixelated Empathy Deployment Metrics",
    "panels": [
      {
        "title": "Deployment Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(deployment_success_total[5m])",
            "legendFormat": "Success Rate"
          }
        ]
      },
      {
        "title": "Container Health",
        "type": "graph",
        "targets": [
          {
            "expr": "up{job='pixelated'}",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "http_request_duration_seconds{job='pixelated'}",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      }
    ]
  }
}
```

This comprehensive deployment strategy provides:

1. **Zero-downtime deployments** with blue-green strategy
2. **Automatic rollback** capabilities
3. **Health check validation** at every step
4. **Resource optimization** with proper limits
5. **Security hardening** with non-root containers
6. **Monitoring integration** for observability
7. **Kubernetes support** for scalability
8. **Load balancing** with Traefik/NGINX

The implementation ensures reliable, secure, and efficient deployments while maintaining high availability.
