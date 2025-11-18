## User Defined Namespaces
- monitoring
- infrastructure

## Components
- **Monitoring Memory Deployment (monitoring/memory-alerts.yaml)** — Single-replica `memory-monitor` Deployment in `gitlab-runner` namespace that now pins `prom/node-exporter` by digest, forces `imagePullPolicy: Always`, and includes a scoped `NetworkPolicy` allowing Prometheus scrapes while restricting egress to DNS plus general outbound traffic.
- **Edge Proxy (docker/traefik/Dockerfile)** — Builds on `traefik:v3.2`, installs `libcap`, grants `cap_net_bind_service`, and runs Traefik as an unprivileged `traefik` user so it can bind 80/443 without root.
- **Pixelated Runtime Image (Dockerfile)** — Multi-stage Node 24 image that now exposes a Node-driven `HEALTHCHECK` checking `http://127.0.0.1:4321/` so orchestrators and scanners can detect unhealthy containers.

## Patterns
- Pin third-party monitoring images via digest and set `imagePullPolicy: Always` to satisfy CKV_K8S_43 / CKV_K8S_15.
- Pair privileged-port listeners with `cap_net_bind_service` and drop to non-root users inside container images (Traefik example).
- Implement lightweight application-layer health checks in production images to appease CKV_DOCKER_2 and give Kubernetes better signals.

