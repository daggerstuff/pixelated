import { Users, Zap, Clock } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEMO_CONSUMPTION } from '@/services/analyticsV2Service'
import type {
  BurnRateData,
  SeatActivationData,
  TokenExpenditureCategory,
} from '@/types/analytics'

const DONUT_COLORS = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#8B5CF6',
  '#DC2626',
  '#06B6D4',
]

// Sim Hour Burn Rate — circular progress
function BurnRateGauge({ data }: { data: BurnRateData }) {
  const pct = Math.round((data.hoursConsumed / data.hoursAllocated) * 100)
  const remaining = data.hoursAllocated - data.hoursConsumed

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sim Hour Burn Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative h-28 w-28 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={pct > 85 ? '#EF4444' : pct > 65 ? '#EAB308' : '#22C55E'}
                strokeWidth="8"
                strokeDasharray={`${pct * 2.64} ${(100 - pct) * 2.64}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">{pct}%</span>
              <span className="text-muted-foreground text-[10px]">used</span>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Consumed</span>
              <span className="font-medium">{data.hoursConsumed}h</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Allocated</span>
              <span className="font-medium">{data.hoursAllocated}h</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-medium">{remaining}h</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Seat Activation — dual metric card
function SeatActivationCard({ data }: { data: SeatActivationData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Seat Activation & Concurrency</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 space-y-1 rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              Licenses
            </div>
            <span className="text-xl font-bold">
              {data.licensesProvisioned}
            </span>
          </div>
          <div className="bg-muted/50 space-y-1 rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              Active
            </div>
            <span className="text-xl font-bold">{data.activeMonthlyUsers}</span>
          </div>
          <div className="bg-muted/50 space-y-1 rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Zap className="h-3.5 w-3.5" />
              Peak Concurrent
            </div>
            <span className="text-xl font-bold">{data.peakConcurrent}</span>
          </div>
          <div className="bg-muted/50 space-y-1 rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              Utilization
            </div>
            <span
              className={`text-xl font-bold ${data.utilizationRate > 80 ? 'text-red-600' : data.utilizationRate > 50 ? 'text-amber-600' : 'text-green-600'}`}
            >
              {data.utilizationRate}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Token Expenditure — donut chart
function TokenDonut({ data }: { data: TokenExpenditureCategory[] }) {
  const total = data.reduce((sum, d) => sum + d.tokens, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Token Expenditure by Scenario</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  dataKey="tokens"
                  stroke="none"
                >
                  {data.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [
                    `${(value / 1000000).toFixed(2)}M tokens`,
                    undefined,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 text-xs">
            {data.map((item, idx) => (
              <div key={item.category} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: DONUT_COLORS[idx] }}
                />
                <span className="max-w-[120px] truncate">{item.category}</span>
                <span className="ml-auto font-medium">
                  {(item.tokens / 1000000).toFixed(1)}M
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t pt-1 font-medium">
              <span>Total</span>
              <span className="ml-auto">{(total / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Module 2 Container
export function ConsumptionModule() {
  const data = DEMO_CONSUMPTION
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <BurnRateGauge data={data.burnRate} />
      </div>
      <div className="lg:col-span-1">
        <SeatActivationCard data={data.seatActivation} />
      </div>
      <div className="lg:col-span-1">
        <TokenDonut data={data.tokenExpenditure} />
      </div>
    </div>
  )
}
