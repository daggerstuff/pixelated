# NGINX to Traefik Migration Guide

## Date: October 10, 2025

### What Changed

**Removed:**
- `/load-balancer/` directory (nginx.conf, nginx-advanced.conf)
- `/docker/nginx/` directory (Dockerfile, nginx.conf)

**Added:**
- `/docker/traefik/` directory with:
  - `traefik.yml` - Static configuration
  - `dynamic.yml` - Dynamic routing and middleware
  - `Dockerfile` - Traefik container build
  - `README.md` - Comprehensive documentation

**Updated Files:**
- `docker-compose.prod.yml` - nginx service replaced with traefik
- `mcp_server/docker-compose.yml` - nginx replaced with traefik
- `mcp_server/docker-compose.integration.yml` - nginx replaced with traefik
- `monitoring/prometheus/prometheus.yml` - nginx-exporter replaced with traefik metrics
- `pytest.ini` - removed load-balancer from exclusions
- `memory-bank/techContext.md` - updated load balancing reference

### Feature Mapping

| NGINX Feature | Traefik Equivalent | Improvement |
|---------------|-------------------|-------------|
| upstream blocks | Docker service discovery | Automatic, no manual config |
| ssl_certificate | Let's Encrypt integration | Automatic renewal |
| limit_req_zone | middleware.rateLimit | Per-route configuration |
| proxy_pass | router.service | Dynamic routing |
| add_header | middleware.headers | Centralized headers |
| health checks | loadBalancer.healthCheck | Built-in, no extra setup |
| nginx_status | Prometheus metrics | Better observability |

### Configuration Equivalents

#### Rate Limiting
**NGINX:**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

**Traefik:**
```yaml
middlewares:
  rate-limit-api:
    rateLimit:
      average: 50
      period: 1m
      burst: 100
```

#### SSL/TLS
**NGINX:**
```nginx
ssl_certificate /etc/ssl/certs/cert.crt;
ssl_certificate_key /etc/ssl/private/key.key;
ssl_protocols TLSv1.2 TLSv1.3;
```

**Traefik:**
```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@pixelated-empathy.com
      httpChallenge:
        entryPoint: web
```

#### Load Balancing
**NGINX:**
```nginx
upstream backend {
    least_conn;
    server app1:3000;
    server app2:3000;
    server app3:3000;
}
```

**Traefik:**
```yaml
services:
  backend:
    loadBalancer:
      servers:
        - url: "http://app1:3000"
        - url: "http://app2:3000"
        - url: "http://app3:3000"
```

### Deployment Steps

1. **Stop existing services:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

2. **Build new Traefik image:**
   ```bash
   docker-compose -f docker-compose.prod.yml build traefik
   ```

3. **Start with Traefik:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Verify health:**
   ```bash
   curl -I https://pixelated-empathy.com/health
   docker logs traefik
   ```

5. **Check metrics:**
   ```bash
   curl http://localhost:8082/metrics
   ```

### Rollback Plan

If issues occur, rollback files are preserved in git history:
```bash
git checkout HEAD~1 -- load-balancer docker/nginx
git checkout HEAD~1 -- docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

### Testing Checklist

- [ ] HTTPS redirect (http → https)
- [ ] SSL certificate generation
- [ ] Rate limiting (/api/auth/login)
- [ ] WebSocket connections (/ws)
- [ ] Health check endpoint (/health)
- [ ] Static file caching
- [ ] Compression (check Content-Encoding header)
- [ ] Security headers (check response headers)
- [ ] Load balancing (check multiple backend hits)
- [ ] Prometheus metrics scraping
- [ ] Dashboard access (traefik.pixelated-empathy.com)

### Benefits Realized

1. **Zero-downtime configuration changes**: No reload needed
2. **Automatic HTTPS**: Let's Encrypt integration
3. **Better observability**: Native Prometheus metrics
4. **Simpler configuration**: YAML instead of NGINX syntax
5. **Docker-native**: Service discovery via labels
6. **Modern middleware**: Circuit breaker, retry, compression built-in

### Known Issues & Limitations

1. **Dashboard password**: Change default `admin/admin` immediately
2. **Let's Encrypt rate limits**: 50 certificates per week
3. **Docker socket**: Traefik needs access to `/var/run/docker.sock`
4. **Label-based config**: Some services need Docker labels added

### Support & Documentation

- Traefik docs: https://doc.traefik.io/traefik/
- Project README: `/docker/traefik/README.md`
- Project memory: Check `mcp_openmemory_search-memories` for "traefik"

### Contact

For issues related to this migration, check project documentation or the development team.
