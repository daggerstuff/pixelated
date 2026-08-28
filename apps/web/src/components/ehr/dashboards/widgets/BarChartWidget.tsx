import React, { FC, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'

export interface BarChartWidgetProps {
  data: Array<Record<string, string | number | null>>
  xKey?: string
  yKeys?: string[]
  yUnit?: string
  horizontal?: boolean
  colors?: string[]
  stacked?: boolean
}

export const BarChartWidget: FC<BarChartWidgetProps> = ({
  data,
  xKey = 'label',
  yKeys = ['value'],
  yUnit,
  horizontal = false,
  colors,
  stacked = false,
}) => {
  const defaultColors = useMemo(
    () => ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
    [],
  )
  const barColors = colors ?? defaultColors

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, bottom: 8, left: horizontal ? 40 : 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--np-line)"
            opacity={0.4}
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: 'var(--np-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--np-line)' }}
                tickFormatter={(v: number) =>
                  yUnit ? `${v}${yUnit}` : String(v)
                }
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fill: 'var(--np-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--np-line)' }}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fill: 'var(--np-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--np-line)' }}
                tickLine={{ stroke: 'var(--np-line)' }}
              />
              <YAxis
                tick={{ fill: 'var(--np-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--np-line)' }}
                tickFormatter={(v: number) =>
                  yUnit ? `${v}${yUnit}` : String(v)
                }
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--np-elevated)',
              border: '1px solid var(--np-line)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--np-text)',
            }}
            cursor={{ fill: 'var(--np-hover)', opacity: 0.3 }}
          />
          {yKeys.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--np-muted)' }} />
          )}
          {yKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              fill={barColors[idx % barColors.length]}
              radius={[4, 4, 0, 0]}
              stackId={stacked ? '1' : undefined}
            >
              {yKeys.length === 1 &&
                data.map((_, cellIdx) => {
                  const value = data[cellIdx] as Record<string, unknown>
                  const status = (value['status'] as string) ?? ''
                  let cellColor = barColors[idx % barColors.length]
                  if (status === 'critical') cellColor = 'var(--np-danger)'
                  else if (status === 'warning') cellColor = '#f59e0b'
                  else if (status === 'good') cellColor = 'var(--np-success)'
                  return <Cell key={cellIdx} fill={cellColor} />
                })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default BarChartWidget
