import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Button } from '../ui/button'
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

export interface AuditLogEntry {
  id: string
  userId: string
  action: string
  resource: {
    id: string
    type: string | undefined
  }
  metadata: Record<string, unknown>
  timestamp: string // Will be parsed as Date in code
}

// Simple Table wrapper that doesn't require the complex props
const Table: FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <UITable
      columns={[]}
      dataSource={{ data: [], totalCount: 0 }}
      tableState={{ currentPage: 1, pageSize: 10 }}
      onStateChange={() => {}}
    >
      {children}
    </UITable>
  );
};

interface AuditLogFilters {
  eventType: string
  userId: string
  startDate: string
  endDate: string
  searchTerm: string
}

export function AuditLogDashboard() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<AuditLogFilters>({
    eventType: '',
    userId: '',
    startDate: '',
    endDate: '',
    searchTerm: '',
  })

  // Event type options from our audit system
  const eventTypes = [
    'access',
    'create',
    'modify',
    'delete',
    'export',
    'share',
    'login',
    'logout',
    'system',
    'security',
    'admin',
    'consent',
    'ai',
    'dlp_allowed',
    'dlp_blocked',
    'security_alert',
  ]

  const fetchLogs = React.useCallback(async () => {
    try {
      setLoading(true);
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.eventType) {
        params.append('eventType', filters.eventType);
      }
      if (filters.userId) {
        params.append('userId', filters.userId);
      }
      // Optionally handle pagination/limits here if desired

      const res = await fetch('/api/admin/audit-logs?' + params.toString());
      const data = await res.json();
      let fetchedLogs: AuditLogEntry[] = data.logs || [];

      // Apply date range filter if set
      if (filters.startDate || filters.endDate) {
        fetchedLogs = fetchedLogs.filter((log) => {
          const logDate = new Date(log.timestamp)
          if (filters.startDate && logDate < new Date(filters.startDate)) {
            return false
          }
          if (filters.endDate && logDate > new Date(filters.endDate)) {
            return false
          }
          return true
        })
      }

      // Apply search term filter if set
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase()
        fetchedLogs = fetchedLogs.filter(
          (log) =>
            log.action.toLowerCase().includes(searchLower) ||
            (log.resource.type &&
              log.resource.type.toLowerCase().includes(searchLower)) ||
            (log.resource.id &&
              log.resource.id.toLowerCase().includes(searchLower)) ||
            log.userId.toLowerCase().includes(searchLower),
        )
      }

      setLogs(fetchedLogs)
    } catch (error: unknown) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const getEventTypeStats = () => {
    const stats = logs.reduce(
      (acc, log) => {
        const type = log.action
        acc[type] = (acc[type] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return Object.entries(stats).map(([name, value]) => ({
      name,
      value,
    }))
  }

  const columns = [
    {
      header: 'Timestamp',
      cell: (log: AuditLogEntry) => format(new Date(log.timestamp), 'PPpp'),
    },
    {
      header: 'Action',
      cell: (log: AuditLogEntry) => log.action,
    },
    {
      header: 'User ID',
      cell: (log: AuditLogEntry) => log.userId,
    },
    {
      header: 'Resource Type',
      cell: (log: AuditLogEntry) => log.resource.type,
    },
    {
      header: 'Resource ID',
      cell: (log: AuditLogEntry) => log.resource.id,
    },
    {
      header: 'Details',
      cell: (log: AuditLogEntry) =>
        log.metadata ? JSON.stringify(log.metadata) : '-',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter audit logs by various criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              value={filters.eventType}
              onValueChange={(value: string) =>
                setFilters({ ...filters, eventType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Events</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="User ID"
              value={filters.userId}
              onChange={(e) =>
                setFilters({ ...filters, userId: e.target.value })
              }
            />

            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
            />

            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
            />

            <Input
              placeholder="Search..."
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters({ ...filters, searchTerm: e.target.value })
              }
            />

            <Button onClick={() => fetchLogs()}>Apply Filters</Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Event Distribution</CardTitle>
          <CardDescription>
            Distribution of audit events by type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getEventTypeStats()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>Detailed list of all audit events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.header}>{column.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    {columns.map((column) => (
                      <TableCell key={column.header}>
                        {column.cell(log)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
