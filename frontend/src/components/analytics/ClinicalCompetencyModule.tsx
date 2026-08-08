import { AlertTriangle, Activity } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { BarChart, Bar } from 'recharts'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEMO_COMPETENCY } from '@/services/analyticsV2Service'
import type {
  StateVelocityDataPoint,
  InterventionRate,
  DeEscalationDataPoint,
  OSCEScoreRow,
} from '@/types/analytics'

// State Transition Velocity Chart
function StateVelocityChart({ data }: { data: StateVelocityDataPoint[] }) {
  // Group by cohort
  const states = [...new Set(data.map((d) => d.state))]
  const cohorts = [...new Set(data.map((d) => d.cohort).filter(Boolean))]
  const colors = ['#2563EB', '#059669', '#D97706', '#8B5CF6']

  const chartData = states.map((state) => {
    const point: any = { state: state.split('→')[0].trim() }
    cohorts.forEach((cohort, i) => {
      const match = data.find((d) => d.state === state && d.cohort === cohort)
      if (match) point[cohort ?? 'All'] = match.medianTimeSeconds
    })
    return point
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">State Transition Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="state"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={50}
                unit="s"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value}s`, undefined]}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {cohorts.map((cohort, i) => (
                <Line
                  key={cohort}
                  type="monotone"
                  dataKey={cohort ?? 'All'}
                  stroke={colors[i]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Intervention Rate Card
function InterventionRateCard({ data }: { data: InterventionRate }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Intervention Rate</CardTitle>
        <AlertTriangle className="text-amber-500 h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <span
              className={`text-3xl font-bold ${data.rate > 5 ? 'text-red-600' : data.rate > 2 ? 'text-amber-600' : 'text-green-600'}`}
            >
              {data.rate}%
            </span>
            <p className="text-muted-foreground text-xs">
              Of all learner turns triggered InputGuard
            </p>
          </div>
          <div className="text-muted-foreground flex justify-between border-t pt-2 text-xs">
            <span>{data.totalTurns.toLocaleString()} total turns</span>
            <span>{data.inputGuardTriggers} interventions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// De-escalation Efficacy Chart
function DeEscalationChart({ data }: { data: DeEscalationDataPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">De-escalation Efficacy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <YAxis
                dataKey="scenario"
                type="category"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value}%`, 'Success Rate']}
              />
              <Bar
                dataKey="successRate"
                radius={[0, 4, 4, 0]}
                barSize={18}
                fill="#059669"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// OSCE Proxy Score Table
function OSCETable({ data }: { data: OSCEScoreRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">OSCE Proxy Scores</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          <div className="text-muted-foreground grid grid-cols-6 gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wider">
            <div className="col-span-2">Learner</div>
            <div className="col-span-1">Info Extr.</div>
            <div className="col-span-1">Comms</div>
            <div className="col-span-1">Crit. Items</div>
            <div className="col-span-1">Turns</div>
          </div>
          {data.map((row) => (
            <div
              key={row.learnerName}
              className="hover:bg-muted/50 grid grid-cols-6 items-center gap-2 px-4 py-2.5 text-xs"
            >
              <div className="col-span-2 flex items-center gap-2">
                <Avatar
                  size="sm"
                  alt={row.learnerName}
                  fallback={row.learnerName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                />
                <span className="truncate font-medium">{row.learnerName}</span>
              </div>
              <div className="col-span-1">
                <Badge
                  variant={
                    row.infoExtractionRate >= 90
                      ? 'success'
                      : row.infoExtractionRate >= 75
                        ? 'warning'
                        : 'destructive'
                  }
                  className="text-[10px]"
                >
                  {row.infoExtractionRate}%
                </Badge>
              </div>
              <div className="col-span-1">{row.communicationScore}</div>
              <div className="col-span-1">
                {row.criticalItemsFound}/{row.criticalItemsTotal}
              </div>
              <div className="col-span-1">{row.totalTurns}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Module 1 Container
export function ClinicalCompetencyModule() {
  const data = DEMO_COMPETENCY

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StateVelocityChart data={data.stateVelocities} />
        </div>
        <div className="lg:col-span-1">
          <InterventionRateCard data={data.interventionRate} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DeEscalationChart data={data.deEscalationEfficacy} />
        <OSCETable data={data.osceScores} />
      </div>
    </div>
  )
}
