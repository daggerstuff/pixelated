---
description: Production hardening configuration for the API gateway layer
pubDate: '2026-07-23'
author: Platform Team
tags:
  - security
  - infrastructure
  - gateway
  - traefik
draft: false
toc: true
title: API Gateway Hardening Guide
---

# API Gateway Hardening Guide

## Overview

This document describes the production hardening configuration for the Pixelated
Empathy API gateway layer. The gateway sits in front of all application services
and enforces security, rate limiting, and traffic management policies.

## Architecture

```
Internet → Cloudflare (edge DDoS) → Traefik/Caddy (gateway) → App services
```

Two gateway implementations are maintained:

| Gateway             | Use Case                           | Config Files                                               |
| ------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Traefik             | Primary (Docker Compose, K8s/Civo) | `docker/traefik/traefik.yml`, `docker/traefik/dynamic.yml` |
| Caddy               | Alternate (subdomains, Ollama)     | `docker/caddy/Caddyfile`                                   |
| K8s GCE Ingress     | GKE production                     | `k8s/base/ingress.yaml`                                    |
| K8s Traefik Ingress | Civo production                    | `k8s/civo/ingress.yaml`                                    |

## TLS Termination

### Traefik

- Let's Encrypt ACME with DNS challenge (Cloudflare provider)
- Auto-renewal via Traefik's built-in ACME client
- HTTP (port 80) auto-redirects to HTTPS (port 443)
- Certificate storage: `/ssl-certs/acme.json`

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@pixelatedempathy.com
      storage: /ssl-certs/acme.json
      dnsChallenge:
        provider: cloudflare
```

### Caddy

- Automatic HTTPS via Caddy's built-in ACME client
- `auto_https on` in global options

### K8s

- GKE: `networking.gke.io/managed-certificates` annotation
- Civo: `traefik.ingress.kubernetes.io/router.tls: true`

## CORS Policy

Enforced at gateway level to prevent cross-origin attacks.

### Allowed Origins

- `https://pixelatedempathy.com`
- `https://www.pixelatedempathy.com`
- `https://pixelatedempathy.tech`

### Allowed Methods

GET, POST, PUT, PATCH, DELETE, OPTIONS

### Allowed Headers

Authorization, Content-Type, X-API-Key, X-Request-Id

### Max Age

600 seconds (10 minutes)

### Preflight Handling

OPTIONS requests receive a 204 response with CORS headers. No backend processing
for preflight requests.

## Request Body Size Limits

Maximum request body size: **10 MB** (10,485,760 bytes)

- Traefik: `buffering.maxRequestBodyBytes: 10485760`
- Caddy: `request_body { max_size 10MB }`
- K8s: `nginx.ingress.kubernetes.io/proxy-body-size: 10m`

In-memory buffering: 2 MB. Larger bodies spill to disk.

## Timeout Policies

| Timeout                 | Value | Scope                    |
| ----------------------- | ----- | ------------------------ |
| Dial timeout            | 10s   | Connection to backend    |
| Response header timeout | 30s   | Backend response headers |
| Read timeout            | 60s   | Client request body      |
| Write timeout           | 60s   | Response to client       |
| Idle timeout            | 120s  | Keep-alive idle          |
| Idle conn timeout       | 90s   | Connection pool idle     |

## Rate Limiting (DDoS Protection)

Two layers of rate limiting operate independently:

### Layer 1: Gateway-Level (Traefik)

| Endpoint | Average     | Burst | Period |
| -------- | ----------- | ----- | ------ |
| General  | 100 req/min | 50    | 1m     |
| API      | 50 req/min  | 100   | 1m     |
| Auth     | 5 req/min   | 10    | 1m     |

This protects against DDoS and volumetric attacks at the edge.

### Layer 2: Per-Key (Application, PIX-4095)

Per-API-key rate limiting with tier-based quotas:

| Tier         | Rate Limit | Daily Quota | Monthly Quota |
| ------------ | ---------- | ----------- | ------------- |
| Free         | 60/min     | 1,000       | 10,000        |
| Developer    | 200/min    | 5,000       | 50,000        |
| Professional | 1,000/min  | 25,000      | 250,000       |
| Enterprise   | 5,000/min  | 100,000     | 1,000,000     |

See: `src/lib/rate-limit/` for implementation.

## Request/Response Logging

- Format: JSON (Traefik) / console (Caddy)
- Traefik filters: status codes 400-599 only (reduces log volume)
- Buffering: 100 entries
- Prometheus metrics on port 8082

## Health Check Endpoint

- Path: `/api/health` (Traefik), `/health` (K8s GCE, Caddy)
- Interval: 30s
- Timeout: 5s
- Unhealthy backends are removed from rotation

## Graceful Shutdown

- Traefik: `server.gracefulShutdownTimeout: 30s`
- In-flight requests are given 30s to complete before forcing shutdown
- Keep-alive ping interval: 15s

## Additional Security

### Security Headers (Traefik)

- HSTS: 31536000s (1 year), includeSubdomains, preload
- X-Frame-Options: DENY (via frameDeny)
- X-Content-Type-Options: nosniff
- Browser XSS filter: enabled
- Referrer-Policy: strict-origin-when-cross-origin
- CSP: restrictive (self + Sentry + CDN only)
- X-Robots-Tag: none,noarchive,nosnippet

### Circuit Breaker

- Triggers when:
  `NetworkErrorRatio() > 0.3 || ResponseCodeRatio(500, 600, 0, 600) > 0.3`
- Effect: stops routing to failing backend

### Retry

- Attempts: 3
- Initial interval: 100ms

### Metrics Access Control

Metrics endpoint (port 8082) is restricted to private IP ranges:

- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16
- 127.0.0.1/32

## Cloudflare Edge Protection

Cloudflare sits in front of the gateway for:

- L3/L4 DDoS protection (automatic)
- L7 DDoS protection (rate limiting rules)
- WAF (managed rules)
- Bot management
- TLS termination (optional — can pass through to gateway)

Cloudflare trusted proxy IPs are configured in Caddy. Traefik receives traffic
from Cloudflare via the DNS challenge provider.

## Verification

### Validate Traefik Config

```bash
docker exec traefik traefik healthcheck
```

### Test Rate Limiting

```bash
for i in {1..200}; do
  curl -s -o /dev/null -w '%{http_code}\n' https://pixelatedempathy.com/api/health
done
# Expect 429 after 150 requests in 1 minute
```

### Test CORS

```bash
curl -I -X OPTIONS https://pixelatedempathy.com/api/health \
  -H 'Origin: https://pixelatedempathy.com' \
  -H 'Access-Control-Request-Method: GET'
# Expect 204 with Access-Control-Allow-Origin header
```

### Test Request Size Limit

```bash
dd if=/dev/zero of=/tmp/large.bin bs=1M count=11
curl -X POST https://pixelatedempathy.com/api/v1/health \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @/tmp/large.bin
# Expect 413 Request Entity Too Large
```

### Test Timeout

```bash
curl -w '\n%{time_total}s\n' -o /dev/null -s https://pixelatedempathy.com/api/health
# Expect response within 60s
```
