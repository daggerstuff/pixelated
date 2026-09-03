/**
 * BiasDashboard.components.charts.tsx — presentational components extracted from
 * BiasDashboard.components.tsx. Pure components; no state, no effects, no API calls.
 */

import React from 'react'
import {
  AlertTriangle,
  BarChart3,
  Eye,
  Users,
} from 'lucide-react'
import { Alert, Card, CardContent, CardHeader, CardTitle, Progress, TabsContent } from '@/components/ui'
import {
  ResponsiveContainer,
  AreaChart,
  BarChart,
  PieChart,
  RadarChart,
  Area,
  Bar,
  Cell,
  Legend,
  Pie,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from '@/components/ui/LazyChart'
import {
  type AlertItem,
  type BiasAnalysisItem,
  type TooltipProps,
} from './BiasDashboard.types'
import type { BiasDashboardData } from '@/lib/ai/bias-detection'
import {
  getBiasScoreColor,
  getChartColors,
  getResponsiveChartHeight,
  getResponsiveGridCols,
} from './BiasDashboard.helpers'

// 1. CustomTooltip
// ---------------------------------------------------------------------------

export const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border-gray-200 rounded-lg border p-3 shadow-lg">
        <p className="font-medium">{`${label}`}</p>
        {payload.map((entry) => (
          <p key={`${entry.name}-${entry.value}`} style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}${entry.payload?.percent ? ` (${entry.payload.percent}%)` : ''}`}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// 9. SummaryCards
// ---------------------------------------------------------------------------

export interface SummaryCardsProps {
  summary: BiasDashboardData['summary']
  filteredSessions: BiasAnalysisItem[]
  filteredAlerts: AlertItem[]
  alerts: AlertItem[]
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  filteredSessions,
  filteredAlerts,
  alerts,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Sessions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Sessions</p>
              <p className="text-2xl font-bold">{summary?.totalSessions ?? 0}</p>
            </div>
            <Users className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Average Bias Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Average Bias Score</p>
              <p
                className={`text-2xl font-bold ${getBiasScoreColor(summary?.averageBiasScore ?? 0)}`}
              >
                {((summary?.averageBiasScore ?? 0) * 100).toFixed(1)}%
              </p>
              <Progress
                value={(summary?.averageBiasScore ?? 0) * 100}
                className="mt-1 h-1"
              />
            </div>
            <BarChart3 className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Filtered Alerts */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Filtered Alerts</p>
              <p className="text-2xl font-bold">{filteredAlerts.length}</p>
              <p className="text-muted-foreground text-xs">
                of {alerts.length} total
              </p>
            </div>
            <AlertTriangle className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Compliance Score</p>
              <p className="text-2xl font-bold">
                {((summary?.complianceScore ?? 0) * 100).toFixed(0)}%
              </p>
              <Progress
                value={(summary?.complianceScore ?? 0) * 100}
                className="mt-1 h-1"
              />
            </div>
            <Eye className="text-primary h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 10. TrendsTab
// ---------------------------------------------------------------------------

export interface TrendsTabProps {
  filteredTrends: Array<{ date: string; biasScore: number; sessionCount: number; alertCount: number }>
  reducedMotion: boolean
  isMobile: boolean
  isTablet: boolean
}

export const TrendsTab: React.FC<TrendsTabProps> = ({
  filteredTrends,
  reducedMotion,
  isMobile,
  isTablet,
}) => {
  const chartHeight = getResponsiveChartHeight(isMobile, isTablet)
  const gridCols = getResponsiveGridCols(2, isMobile, isTablet)

  return (
    <TabsContent value="trends" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Bias Score Trends ({filteredTrends.length} data points)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={filteredTrends}>
              <defs>
                <linearGradient id="biasScoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string | number) =>
                  new Date(value).toLocaleDateString()
                }
              />
              <YAxis domain={[0, 1]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={0.3} stroke="#f59e0b" strokeDasharray="3 3" label="Warning" />
              <ReferenceLine y={0.6} stroke="#ef4444" strokeDasharray="3 3" label="High" />
              <Area
                type="monotone"
                dataKey="biasScore"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#biasScoreGradient)"
                animationDuration={reducedMotion ? 0 : 1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div
        className={`grid grid-cols-1 ${gridCols === 2 ? 'lg:grid-cols-2' : ''} gap-6`}
      >
        <Card>
          <CardHeader>
            <CardTitle>Session Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={chartHeight - 100}>
              <BarChart data={filteredTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string | number) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="sessionCount"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  animationDuration={reducedMotion ? 0 : 1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={chartHeight - 100}>
              <BarChart data={filteredTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string | number) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="alertCount"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  animationDuration={reducedMotion ? 0 : 1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Radar Chart for Bias Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Bias Metrics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RadarChart
              data={[
                { metric: 'Gender', value: 0.3 },
                { metric: 'Age', value: 0.4 },
                { metric: 'Ethnicity', value: 0.2 },
                { metric: 'Language', value: 0.5 },
                { metric: 'Cultural', value: 0.3 },
                { metric: 'Socioeconomic', value: 0.4 },
              ]}
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={30} domain={[0, 1]} />
              <Radar
                name="Bias Score"
                dataKey="value"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
                animationDuration={reducedMotion ? 0 : 1000}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
// 11. DemographicsTab
// ---------------------------------------------------------------------------

export interface DemographicsTabProps {
  demographics: BiasDashboardData['demographics']
}

export const DemographicsTab: React.FC<DemographicsTabProps> = ({ demographics }) => {
  return (
    <TabsContent value="demographics" className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(demographics?.age ?? {}).map(([age, count]) => ({
                    name: age,
                    value: count,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent?: number }) =>
                    `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                  }
                  animationDuration={1000}
                  animationBegin={0}
                >
                  {Object.entries(demographics?.age ?? {}).map(([age, count], index) => (
                    <Cell
                      key={`age-${age}-${String(count)}`}
                      fill={getChartColors(index, Object.keys(demographics?.age ?? {}).length)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({
                    active,
                    payload,
                  }: {
                    active?: boolean
                    payload?: Array<{ name?: string; value?: number; percent?: number }>
                  }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white rounded border p-2 shadow">
                          <p className="font-semibold">{payload[0]?.name}</p>
                          <p>Count: {payload[0]?.value}</p>
                          <p>
                            Percentage: {payload[0]?.percent
                              ? (payload[0].percent * 100).toFixed(1)
                              : 0}
                            %
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(demographics?.gender ?? {}).map(([gender, count]) => ({
                    name: gender,
                    value: count,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#82ca9d"
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent?: number }) =>
                    `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                  }
                  animationDuration={1000}
                  animationBegin={0}
                >
                  {Object.entries(demographics?.gender ?? {}).map(([gender, count], index) => (
                    <Cell
                      key={`gender-${gender}-${String(count)}`}
                      fill={getChartColors(index, Object.keys(demographics?.gender ?? {}).length)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({
                    active,
                    payload,
                  }: {
                    active?: boolean
                    payload?: Array<{ name?: string; value?: number; percent?: number }>
                  }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white rounded border p-2 shadow">
                          <p className="font-semibold">{payload[0]?.name}</p>
                          <p>Count: {payload[0]?.value}</p>
                          <p>
                            Percentage: {payload[0]?.percent
                              ? (payload[0].percent * 100).toFixed(1)
                              : 0}
                            %
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ethnicity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Ethnicity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={Object.entries(demographics?.ethnicity ?? {}).map(([ethnicity, count]) => ({
                ethnicity,
                count,
              }))}
              layout="horizontal"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="ethnicity" type="category" width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="count"
                fill="#8884d8"
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
                animationBegin={0}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
