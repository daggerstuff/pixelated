import React, { FC, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export interface AreaChartWidgetProps {
  data: Array<Record<string, string | number | null>>
  xKey?: string
  yKeys?: string[]
  yUnit?: string
  stacked?: boolean
}

export const AreaChartWidget: FC<AreaChartWidgetProps> = ({
  data,
  xKey = 'date',
  yKeys = ['value'],
  yUnit,
  stacked = false,
}) => {
  const colors = useMemo(
    () => ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
    [],
  )

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <defs>
            {yKeys.map((key, idx) => (
              <linearGradient
                key={key}
                id={`gradient-${idx}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={colors[idx % colors.length]}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={colors[idx % colors.length]}
                  stopOpacity={0.05}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--np-line)"
            opacity={0.4}
          />
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'var(--np-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--np-line)' }}
            tickLine={{ stroke: 'var(--np-line)' }}
          />
          <YAxis
            tick={{ fill: 'var(--np-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--np-line)' }}
            tickLine={{ stroke: 'var(--np-line)' }}
            tickFormatter={(v: number) => (yUnit ? `${v}${yUnit}` : String(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--np-elevated)',
              border: '1px solid var(--np-line)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--np-text)',
            }}
          />
          {yKeys.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--np-muted)' }} />
          )}
          {yKeys.map((key, idx) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${idx})`}
              stackId={stacked ? '1' : undefined}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default AreaChartWidget
