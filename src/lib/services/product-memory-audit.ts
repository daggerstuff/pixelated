export interface AuditEvent {
  type:
    | 'auth.success'
    | 'auth.failure'
    | 'scope.validated'
    | 'scope.rejected'
    | 'quota.checked'
    | 'downstream.success'
    | 'downstream.failure'
  actorId: string
  userId: string
  operation: string
  correlationId: string
  latencyMs?: number
  details?: Record<string, unknown>
  timestamp: number
}

export interface AuditLogger {
  log(event: AuditEvent): void
}

export function createConsoleAuditLogger(): AuditLogger {
  return {
    log(event: AuditEvent) {
      const logEntry = {
        ...event,
        timestamp: event.timestamp ?? Date.now(),
      }

      if (
        event.type === 'auth.failure' ||
        event.type === 'scope.rejected' ||
        event.type === 'downstream.failure'
      ) {
        console.error(JSON.stringify(logEntry))
      } else {
        console.info(JSON.stringify(logEntry))
      }
    },
  }
}

export class NoOpAuditLogger implements AuditLogger {
  log(_event: AuditEvent): void {
    return
  }
}
