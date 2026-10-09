import React from 'react'

import { HomeworkWidget } from './HomeworkWidget'
import { MessagingWidget } from './MessagingWidget'
import { SchedulingWidget } from './SchedulingWidget'
import { StatementWidget } from './StatementWidget'

const cardStyle: React.CSSProperties = {
  background: 'var(--np-surface)',
  border: '1px solid var(--np-line)',
}

export function PortalDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: 'var(--np-text)' }}
        >
          Welcome to Your Portal
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--np-muted)' }}>
          Manage your appointments, messages, homework, and statements in one
          place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded p-4" style={cardStyle}>
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--np-text)' }}
          >
            Upcoming Appointments
          </h3>
          <SchedulingWidget />
        </div>

        <div className="rounded p-4" style={cardStyle}>
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--np-text)' }}
          >
            Recent Messages
          </h3>
          <MessagingWidget />
        </div>

        <div className="rounded p-4" style={cardStyle}>
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--np-text)' }}
          >
            Homework
          </h3>
          <HomeworkWidget />
        </div>

        <div className="rounded p-4" style={cardStyle}>
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--np-text)' }}
          >
            Statements
          </h3>
          <StatementWidget />
        </div>
      </div>
    </div>
  )
}
