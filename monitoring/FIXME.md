# ⚠️ monitoring/ — Needs Adaptation

## Problem

This directory was copied from the `business-strategy-cms` project and has
**not** been adapted for Pixelated Empathy. Evidence:

- `docker-compose.monitoring.yml` sets `container_name: business-strategy-cms-*`
  for all services (Prometheus, Grafana, Alertmanager, Node Exporter)
- Alert rules and dashboards reference metrics not emitted by this app
- This stack is **not mounted or started** by any production Docker Compose file

## Current production monitoring

`.github/workflows/monitoring.yml` runs HTTP health checks against
`pixelatedempathy.com` on a daily schedule. That is the only active monitoring.

## To make this useful

1. Rename all `container_name` values to `pixelated-empathy-*`
2. Update `prometheus.yml` scrape targets to match this app's services
3. Adapt or remove `alert_rules.yml` for relevant metrics
4. Mount via `docker-compose.production.yml` (add a `monitoring` profile)
5. Validate dashboards against actual Prometheus metrics

Until the above is done, do **not** run `docker-compose.monitoring.yml` in
production — it will create orphaned containers with the wrong project name.
