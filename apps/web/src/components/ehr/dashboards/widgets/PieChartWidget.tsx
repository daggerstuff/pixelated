import React, { FC, useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export interface PieChartWidgetProps {
  data: Array<{ name: string; value: number; color?: string }>
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  showLabels?: boolean
  unit?: string
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

export const PieChartWidget: FC<PieChartWidgetProps> = ({
  data,
  innerRadius = 0,
  outerRadius = 80,
  showLegend = true,
  showLabels = false,
  unit,
}) => {
  const colors = useMemo(
    () =>
      data.map((d, i) => d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
    [data],
  )

  const isDonut = innerRadius > 0

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={isDonut ? 2 : 1}
            dataKey="value"
            nameKey="name"
            label={
              showLabels
                ? {
                    fill: 'var(--np-text)',
                    fontSize: 11,
                    formatter: (value: number) =>
                      unit ? `${value}${unit}` : String(value),
                  }
                : false
            }
          >
            {data.map((_, idx) => (
              <Cell
                key={idx}
                fill={colors[idx]}
                stroke="var(--np-surface)"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--np-elevated)',
              border: '1px solid var(--np-line)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--np-text)',
            }}
            formatter={(value: number, name: string) => [
              unit ? `${value}${unit}` : String(value),
              name,
            ]}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--np-muted)' }}
              verticalAlign="bottom"
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Convenience alias for donut charts */
export const DonutChartWidget: FC<Omit<PieChartWidgetProps, 'innerRadius'>> = (
  props,
) => <PieChartWidget {...props} innerRadius={40} outerRadius={80} />

export default PieChartWidget
