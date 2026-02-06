# Traefik Load Balancer Configuration

Traefik is the modern reverse proxy and load balancer for Pixelated Empathy, replacing NGINX with a more dynamic, cloud-native solution.

## Features

### Core Capabilities
- **Automatic Service Discovery**: Integrates with Docker to automatically detect and configure services
- **Let's Encrypt Integration**: Automatic HTTPS certificate generation and renewal
- **Load Balancing**: Distributes traffic across multiple app instances (app1, app2, app3)
- **Health Checks**: Monitors backend health and removes unhealthy instances
- **Sticky Sessions**: Cookie-based session affinity for stateful connections

### Security
- **Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Rate Limiting**: Configurable per endpoint (100req/min general, 5req/min auth, 50req/min API)
- **Circuit Breaker**: Automatically stops routing to failing backends
- **TLS 1.2/1.3**: Modern encryption with automatic certificate management

### Performance
- **Compression**: Automatic gzip compression for responses
- **Retry Logic**: Automatic retry on transient failures (3 attempts)
- **Connection Pooling**: Efficient connection reuse
- **Metrics**: Prometheus metrics on port 8082

## Configuration Files

### traefik.yml
Main static configuration file:
- Entry points (HTTP:80, HTTPS:443, Metrics:8082)
- Certificate resolvers (Let's Encrypt)
- Providers (Docker, File)
- Logging and metrics setup

### dynamic.yml
Dynamic configuration for:
- Middlewares (rate limiting, security headers, compression)
- Services (backend pool with health checks)
- Routers (route definitions and priorities)

## Usage

### Production Deployment
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Development
```bash
cd mcp_server
docker-compose up -d
```

### Access Dashboard
Dashboard is available at `https://traefik.pixelatedempathy.com`
Default credentials: `admin` / Change in production!

To generate new password:
```bash
htpasswd -nb admin your_password
```

## Endpoints

- **HTTP**: Port 80 (auto-redirects to HTTPS)
- **HTTPS**: Port 443 (main traffic)
- **Metrics**: Port 8082 (Prometheus scraping)
- **Dashboard**: https://traefik.pixelatedempathy.com

## Health Checks

Traefik monitors backends at `/health` every 30s with 5s timeout.

## Rate Limiting

| Endpoint | Rate | Burst |
|----------|------|-------|
| General | 100/min | 50 |
| API | 50/min | 100 |
| Auth | 5/min | 10 |

## Monitoring

Prometheus metrics available at `http://traefik:8082/metrics`

Key metrics:
- `traefik_entrypoint_requests_total`
- `traefik_entrypoint_request_duration_seconds`
- `traefik_backend_requests_total`
- `traefik_backend_request_duration_seconds`

## Troubleshooting

### View Logs
```bash
docker logs traefik -f
```

### Check Configuration
```bash
docker exec traefik traefik healthcheck
```

### Test Rate Limiting
```bash
for i in {1..10}; do curl -I https://pixelatedempathy.com/api/test; done
```

## Migration from NGINX

Traefik replaces NGINX with these advantages:
1. **No config reloads**: Changes apply instantly
2. **Automatic HTTPS**: Let's Encrypt integration out of the box
3. **Better observability**: Native Prometheus metrics
4. **Dynamic configuration**: Docker labels for service config
5. **Modern routing**: PathPrefix, Host, Headers, Query params

## Security Notes

1. Change default dashboard password immediately
2. Restrict dashboard access by IP if needed
3. Review rate limits for your traffic patterns
4. Monitor `/metrics` endpoint access
5. Keep Traefik updated (currently v3.2)

## Further Reading

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [Let's Encrypt](https://doc.traefik.io/traefik/https/acme/)
- [Middlewares](https://doc.traefik.io/traefik/middlewares/overview/)
