import {
  AlertTriangle,
  Activity,
  Clock,
  Coins,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// NOTE: the three types below are temporarily un-exported (the consumers that
// import them are still landing). Re-export them when the dashboard page work
// is complete.
interface PerformanceMetric {
  date: string
  model: string
  requestCount: number
  latency: { avg: number; max: number; min: number }
  tokens: { input: number; output: number; total: number }
  successRate: number
  cacheHitRate: number
  optimizationRate: number
}

interface ModelBreakdown {
  model: string
  requestCount: number
  totalTokens: number
  successRate: number
  cacheHitRate: number
  optimizationRate: number
}

interface ErrorBreakdown {
  errorCode: string
  count: number
}

export interface PerformanceMetricsResponse {
  metrics: PerformanceMetric[]
  modelBreakdown: ModelBreakdown[]
  errorBreakdown: ErrorBreakdown[]
}

export type TimeRange = '1h' | '24h' | '7d' | '30d'

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

export interface PerformanceDashboardProps {
  initialTimeRange?: TimeRange
  refreshIntervalMs?: number
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    value,
  )
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function PerformanceDashboard({
  initialTimeRange = '24h',
  refreshIntervalMs,
}: PerformanceDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange)
  const [data, setData] = useState<PerformanceMetricsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/ai/performance-metrics?timeRange=${encodeURIComponent(timeRange)}`,
      )
      if (!response.ok) {
        throw new Error(
          `Failed to fetch performance metrics (${response.status})`,
        )
      }
      const payload = (await response.json()) as PerformanceMetricsResponse
      setData(payload)
      setLastUpdated(new Date())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load metrics data',
      )
    } finally {
      setIsLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    // Deferred via timeout so the initial fetch is not a synchronous
    // setState-in-effect (mirrors AuditLogDashboard's initialLoad pattern)
    const initialLoad = window.setTimeout(() => {
      void fetchData()
    }, 0)
    if (!refreshIntervalMs || refreshIntervalMs <= 0) {
      return () => window.clearTimeout(initialLoad)
    }
    const intervalId = setInterval(() => {
      void fetchData()
    }, refreshIntervalMs)
    return () => {
      window.clearTimeout(initialLoad)
      clearInterval(intervalId)
    }
  }, [fetchData, refreshIntervalMs])

  const summary = useMemo(() => {
    const metrics = data?.metrics ?? []
    const totalRequests = metrics.reduce((sum, m) => sum + m.requestCount, 0)
    const totalTokens = metrics.reduce((sum, m) => sum + m.tokens.total, 0)
    const weightedLatency =
      totalRequests > 0
        ? metrics.reduce((sum, m) => sum + m.latency.avg * m.requestCount, 0) /
          totalRequests
        : 0
    const weightedSuccess =
      totalRequests > 0
        ? metrics.reduce((sum, m) => sum + m.successRate * m.requestCount, 0) /
          totalRequests
        : 0
    return { totalRequests, totalTokens, weightedLatency, weightedSuccess }
  }, [data])

  const trendData = useMemo(() => {
    const metrics = data?.metrics ?? []
    return [...metrics]
      .map((m) => ({
        timestamp: m.date,
        avgLatency: m.latency.avg,
        totalTokens: m.tokens.total,
        successRate: m.successRate,
        model: m.model,
      }))
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
  }, [data])

  const modelRows = data?.modelBreakdown ?? []

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Time range:</span>
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTimeRange(option.value)}
              className={`rounded-none px-3 py-1.5 text-sm font-medium transition-colors ${
                timeRange === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-accent'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-none border border-ring bg-card p-4 font-medium text-foreground"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void fetchData()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4" />
              Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {isLoading ? '—' : formatNumber(summary.totalRequests)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {isLoading ? '—' : `${Math.round(summary.weightedLatency)}ms`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Coins className="h-4 w-4" />
              Token Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {isLoading ? '—' : formatNumber(summary.totalTokens)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {isLoading ? '—' : formatPercent(summary.weightedSuccess)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Latency / token trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Performance Over Time (
            {TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label ??
              timeRange}
            )
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div
              className="flex h-72 items-center justify-center rounded-none bg-secondary"
              aria-busy="true"
            >
              <span className="text-sm text-muted-foreground">
                Loading chart…
              </span>
            </div>
          ) : trendData.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-none bg-secondary">
              <span className="text-sm text-muted-foreground">
                No metrics recorded for this time range.
              </span>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="avgLatency"
                    name="Avg latency (ms)"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalTokens"
                    name="Total tokens"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {modelRows.length === 0 ? (
            <div className="rounded-none bg-secondary py-8 text-center">
              <span className="text-sm text-muted-foreground">
                No model data available.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-secondary">
                    <th className="px-4 py-2 text-left font-medium">Model</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Requests
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Tokens</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Success
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Cache</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Optimized
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modelRows.map((row) => (
                    <tr key={row.model} className="border-b border-border">
                      <td className="px-4 py-2">{row.model}</td>
                      <td className="px-4 py-2 text-right">
                        {formatNumber(row.requestCount)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatNumber(row.totalTokens)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatPercent(row.successRate)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatPercent(row.cacheHitRate)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatPercent(row.optimizationRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PerformanceDashboard
