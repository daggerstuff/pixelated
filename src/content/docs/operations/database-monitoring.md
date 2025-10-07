---
title: 'Database Monitoring Configuration'
description: 'Setting up and configuring database performance monitoring'
pubDate: '2025-01-01'
author: 'DevOps Team'
draft: false
toc: true
share: true
date: '2025-04-14'
---

# Database Performance Monitoring

## Overview

This document outlines how to set up comprehensive database performance monitoring for our MongoDB Atlas database. The monitoring system collects metrics on connection counts, query performance, resource utilization, and other critical performance indicators.

## Architecture

Our database monitoring architecture combines several tools:

1. **Prometheus**: For metrics collection and storage
2. **MongoDB Exporter**: For extracting MongoDB-specific metrics
3. **Grafana**: For visualization and alerting
4. **MongoDB Atlas Monitoring**: Built-in Atlas monitoring tools

## Metrics Collected

The monitoring system collects the following key metrics:

### Connection Metrics

- Active connections
- Connection states (active, idle, idle in transaction)
- Connection utilization percentage
- Max connections threshold alerts

### Query Performance

- Query execution time (p50, p95, p99)
- Slow query count and details
- Query cache hit ratio
- Index usage statistics

### Resource Utilization

- CPU usage
- Memory usage
- Disk I/O operations
- Storage utilization and growth rate

### Database Operations

- Transaction rates
- Commit/rollback ratio
- WAL generation rate
- Replication lag (if applicable)

## Installation

### 1. Set Up Postgres Exporter

```bash
# Install postgres_exporter
docker run -d \
  --name postgres-exporter \
  -p 9187:9187 \
  -e DATA_SOURCE_NAME="postgresql://username:password@db-host:5432/postgres?sslmode=disable" \
  quay.io/prometheuscommunity/postgres-exporter
```

### 2. Configure Prometheus

Add the following to your `prometheus.yml` configuration:

```yaml
scrape_configs:
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    metrics_path: /metrics
    scrape_interval: 15s
    scrape_timeout: 10s
```

### 3. Set Up Grafana Dashboard

1. Install the PostgreSQL dashboard from the Grafana marketplace (ID: 9628)
2. Configure the Prometheus data source
3. Import custom dashboards from the `monitoring/dashboards` directory

## Database Query Monitoring

For detailed query monitoring, add the following to your `postgresql.conf`:

```
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
track_activity_query_size = 2048
```

Restart PostgreSQL after making these changes.

## Alert Configuration

### Connection Pool Alerts

Set up the following alerts in Grafana:

1. **High Connection Usage**
   - Condition: Connection count > 80% of max connections
   - Severity: Warning
   - Notification: Slack + Email

2. **Critical Connection Usage**
   - Condition: Connection count > 95% of max connections
   - Severity: Critical
   - Notification: Slack + Email + PagerDuty

### Performance Alerts

1. **Slow Query Alert**
   - Condition: Queries taking > 1s for more than 5 minutes
   - Severity: Warning
   - Notification: Slack

2. **High CPU Usage**
   - Condition: CPU > 85% for more than 10 minutes
   - Severity: Warning
   - Notification: Slack + Email

3. **Disk Space Alert**
   - Condition: Disk space < 20% free
   - Severity: Warning
   - Notification: Slack + Email

## Dashboard Usage

### Main Database Dashboard

The main database dashboard includes:

1. **Overview Panel**
   - Health status
   - Connection counts
   - Transaction rates
   - Cache hit ratio

2. **Performance Panel**
   - Query execution times
   - Slow query count
   - Index usage
   - Lock statistics

3. **Resource Panel**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Storage utilization

### Query Analyzer Dashboard

The query analyzer dashboard provides:

1. **Top Queries by Time**
   - Queries consuming the most execution time
   - Trend analysis over time

2. **Query Performance Breakdown**
   - Execution plans
   - Index recommendations
   - Query optimization suggestions

## Maintenance Procedures

### Regular Maintenance Tasks

1. **Database Vacuum**
   - Scheduled vacuum operations should be visible in the dashboard
   - Monitor vacuum progress and resource impact

2. **Index Maintenance**
   - Track index bloat
   - Monitor index usage to identify unused indexes

### Troubleshooting

Use the dashboard for troubleshooting:

1. **Connection Issues**
   - Check connection count vs. maximum limit
   - Look for idle connections in transaction
   - Review connection source distribution

2. **Performance Issues**
   - Identify slow queries from the Query Analyzer
   - Check resource bottlenecks (CPU, memory, I/O)
   - Review lock contention and blocking queries

## Integration with Monitoring Stack

The database monitoring integrates with our broader monitoring stack:

1. **Centralized Logging**
   - Database logs are shipped to our centralized logging system
   - Error patterns can be correlated with performance metrics

2. **Alerting Integration**
   - Database alerts route through our standard alerting channels
   - Escalation policies follow our global incident management process

3. **SLO Monitoring**
   - Key database metrics contribute to our service level objectives
   - Dashboard includes SLO compliance indicators

## Next Steps

1. Implement automated query analysis and recommendations
2. Set up database growth forecasting and capacity planning
3. Create performance comparison benchmarks across environments

## References

1. [PostgreSQL Documentation on Monitoring](https://www.postgresql.org/docs/current/monitoring.html)
2. [Postgres Exporter Documentation](https://github.com/prometheus-community/postgres_exporter)
3. [Grafana PostgreSQL Dashboard](https://grafana.com/grafana/dashboards/9628)
