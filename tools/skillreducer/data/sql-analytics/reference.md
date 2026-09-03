# SQL dialect reference

## BigQuery

- Use `DATE(event_ts)` for day grain.
- Prefer `APPROX_COUNT_DISTINCT` for very large cardinalities.
- Partition by `DATE` or `TIMESTAMP` on fact tables.

## Snowflake

- Use `DATE_TRUNC('day', event_ts)` for day grain.
- Cluster keys: align with common `WHERE` columns.

## Postgres

- Index `(date_col, user_id)` for cohort queries.
- Use `EXPLAIN ANALYZE` before shipping heavy reports.

## Overlap note (intentional for dedup testing)

Daily active users pattern:

```sql
SELECT DATE(event_ts) AS day, COUNT(DISTINCT user_id) AS dau
FROM events
WHERE event_ts >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1
ORDER BY 1;
```

Warehouse costs scale with bytes scanned. Push filters early.
