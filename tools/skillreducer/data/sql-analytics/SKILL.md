---
name: sql-analytics
description: >-
  Write and optimize SQL queries for analytics warehouses (BigQuery, Snowflake,
  Postgres). Use when the user asks for SQL, dashboards, metrics, cohort analysis,
  or data warehouse queries.
---

# SQL Analytics

## Rules

- Prefer CTEs over nested subqueries for readability.
- Always filter on partition/date columns first in BigQuery and Snowflake.
- Use `COUNT(DISTINCT user_id)` for unique users, not `COUNT(*)`.
- Document assumed grain (per user, per day, per session) in a comment above each query.
- Never `SELECT *` in production analytics queries.

## Quick patterns

**Daily active users:**

```sql
SELECT DATE(event_ts) AS day, COUNT(DISTINCT user_id) AS dau
FROM events
WHERE event_ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1
ORDER BY 1;
```

## Background

Warehouse costs scale with bytes scanned. Push filters early, avoid cross joins on
large fact tables, and materialize heavy intermediate results when queries run hourly.

See [reference.md](reference.md) for dialect-specific syntax notes.
