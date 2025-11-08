/**
 * Database Connection Pool Event Types
 * 
 * TODO/TECHDEBT: These event types are defined for a future event system.
 * Currently unused but preserved for planned implementation of enhanced
 * pool event monitoring and observability features.
 * 
 * @see src/lib/db/connection-pool-optimizer.ts
 */

import type { PoolClient } from 'pg'
import type { PoolMetrics } from './connection-pool-optimizer'

/**
 * Event types emitted by the OptimizedConnectionPool
 * 
 * Planned events for future implementation:
 * - Connection lifecycle events (acquired, released, error)
 * - Performance monitoring events (slow queries, pool exhaustion)
 * - Health status changes
 * - Failover activation
 * - Metrics updates
 */
export interface PoolEvents {
    'connection-acquired': [client: PoolClient]
    'connection-released': [client: PoolClient]
    'connection-error': [error: Error, client?: PoolClient]
    'pool-exhausted': []
    'slow-query': [query: string, duration: number]
    'health-changed': [
        score: number,
        status: 'healthy' | 'degraded' | 'unhealthy',
    ]
    'failover-activated': [host: string]
    'metrics-updated': [metrics: PoolMetrics]
}
