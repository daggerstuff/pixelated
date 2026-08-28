import React, { FC, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'

import type { WidgetDefinition } from '../types'

export interface LineChartWidgetProps {
  widget: WidgetDefinition
  data: Array<Record<string, string | number | null>>
  loading?: boolean
  xKey?: string
  yKeys?: string[]
  yUnit?: string
  referenceLines?: Array<{ value: number; label: string; color?: string }>
}

export const LineChartWidget: FC<LineChartWidgetProps> = ({
  data,
  xKey = 'date',
  yKeys = ['value'],
  yUnit,
  referenceLines,
}) => {
  const colors = useMemo(
    () => ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
    [],
  )

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
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
              border: `1px solid var(--np-line)`,
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--np-text)',
            }}
            labelStyle={{ color: 'var(--np-text)' }}
          />
          {yKeys.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--np-muted)' }} />
          )}
          {referenceLines?.map((ref, idx) => (
            <ReferenceLine
              key={idx}
              y={ref.value}
              label={{
                value: ref.label,
                fill: ref.color ?? 'var(--np-danger)',
                fontSize: 10,
                position: 'right',
              }}
              stroke={ref.color ?? 'var(--np-danger)'}
              strokeDasharray="4 4"
              opacity={0.6}
            />
          ))}
          {yKeys.map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={{ r: 2, fill: colors[idx % colors.length] }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default LineChartWidget
