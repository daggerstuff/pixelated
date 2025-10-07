import { useState, useEffect, useRef } from 'react'
import { DashboardWidget } from './DashboardWidget'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Optional: Import type definitions for better TypeScript support
type ChartType = 'line' | 'bar' | 'pie' | 'doughnut'
type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year'

// Chart.js type for better type safety
type ChartInstance = {
  destroy: () => void
  update: () => void
  resize: () => void
  render: () => void
}

interface DataPoint {
  label: string
  value: number
  color?: string
}

interface DataSeries {
  name: string
  data: number[]
  color?: string
}

export interface ChartWidgetProps {
  title: string
  description?: string
  chartType: ChartType
  labels: string[]
  series: DataSeries[] | DataPoint[]
  isTimeSeries?: boolean
  height?: number
  allowRangeSelection?: boolean
  isLoading?: boolean
  className?: string
  refreshInterval?: number
  fetchData?: (range: TimeRange) => Promise<{
    labels: string[]
    series: DataSeries[] | DataPoint[]
  }>
}

export function ChartWidget({
  title,
  description,
  chartType,
  labels: initialLabels,
  series: initialSeries,
  isTimeSeries = false,
  height = 300,
  allowRangeSelection = false,
  isLoading: initialLoading = false,
  className = '',
  refreshInterval,
  fetchData,
}: ChartWidgetProps) {
  const [labels, setLabels] = useState<string[]>(initialLabels)
  const [series, setSeries] = useState<DataSeries[] | DataPoint[]>(
    initialSeries,
  )
  const [isLoading, setIsLoading] = useState(initialLoading)
  const [range, setRange] = useState<TimeRange>('week')
  const [chart, setChart] = useState<ChartInstance | null>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Dynamically import Chart.js only in browser environment
    if (typeof window !== 'undefined' && chartRef.current) {
      import('chart.js').then((ChartJS) => {
        // Register required controllers and elements
        ChartJS.Chart.register(
          ChartJS.CategoryScale,
          ChartJS.LinearScale,
          ChartJS.PointElement,
          ChartJS.LineElement,
          ChartJS.BarElement,
          ChartJS.ArcElement,
          ChartJS.Tooltip,
          ChartJS.Legend,
        )

        const ctx = chartRef.current?.getContext('2d')
        if (ctx) {
          // Destroy any existing chart
          if (chart) {
            chart.destroy()
          }

          // Create configuration based on chart type
          const config = createChartConfig(chartType, labels, series)

          // Create and store the chart
          const newChart = new ChartJS.Chart(ctx, config) as ChartInstance
          setChart(newChart)
        }
      })
    }

    return () => {
      // Clean up chart on unmount
      if (chart) {
        chart.destroy()
      }
    }
  }, [chartType, labels, series, isTimeSeries, chart])

  // Function to create chart configuration based on type
  const createChartConfig = (
    type: ChartType,
    chartLabels: string[],
    chartSeries: DataSeries[] | DataPoint[],
  ) => {
    // Default color palette
    const defaultColors = [
      'rgba(59, 130, 246, 0.5)', // Blue
      'rgba(16, 185, 129, 0.5)', // Green
      'rgba(249, 115, 22, 0.5)', // Orange
      'rgba(139, 92, 246, 0.5)', // Purple
      'rgba(236, 72, 153, 0.5)', // Pink
      'rgba(245, 158, 11, 0.5)', // Amber
    ]

    // For pie/doughnut charts
    if (type === 'pie' || type === 'doughnut') {
      const dataPoints = chartSeries as DataPoint[]
      return {
        type,
        data: {
          labels: dataPoints.map((dp) => dp.label),
          datasets: [
            {
              data: dataPoints.map((dp) => dp.value),
              backgroundColor: dataPoints.map(
                (dp, i) => dp.color || defaultColors[i % defaultColors.length],
              ),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom' as const,
            },
          },
        },
      }
    }

    // For line/bar charts with multiple series
    const multiSeries = chartSeries as DataSeries[]
    return {
      type,
      data: {
        labels: chartLabels,
        datasets: multiSeries.map((series, i) => ({
          label: series.name,
          data: series.data,
          backgroundColor:
            series.color || defaultColors[i % defaultColors.length],
          borderColor:
            series.color ||
            defaultColors[i % defaultColors.length]?.replace('0.5', '1') ||
            'rgba(59, 130, 246, 1)',
          borderWidth: type === 'line' ? 2 : 1,
          tension: 0.4,
          fill: type === 'line' ? false : undefined,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
          },
        },
        plugins: {
          legend: {
            position: 'bottom' as const,
            display: multiSeries.length > 1,
          },
          tooltip: {
            mode: 'index' as const,
            intersect: false,
          },
        },
        interaction: {
          mode: 'nearest' as const,
          axis: 'x' as const,
          intersect: false,
        },
      },
    }
  }

  // Handle data fetching
  useEffect(() => {
    const loadData = async () => {
      if (fetchData) {
        try {
          setIsLoading(true)
          const data = await fetchData(range)
          setLabels(data.labels)
          setSeries(data.series)
        } catch (error: unknown) {
          console.error('Error fetching chart data:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadData()

    if (refreshInterval && fetchData) {
      const interval = setInterval(loadData, refreshInterval)
      return () => clearInterval(interval)
    }

    // Return undefined explicitly to satisfy TypeScript
    return undefined
  }, [range, fetchData, refreshInterval])

  // Handle refresh
  const handleRefresh = () => {
    if (fetchData) {
      const refreshAsync = async () => {
        try {
          setIsLoading(true)
          const data = await fetchData(range)
          setLabels(data.labels)
          setSeries(data.series)
        } catch (error: unknown) {
          console.error('Error refreshing chart data:', error)
        } finally {
          setIsLoading(false)
        }
      }
      refreshAsync()
    }
  }

  // Custom actions for the widget
  const rangeSelector = allowRangeSelection ? (
    <Select
      value={range}
      onValueChange={(value: string) => setRange(value as TimeRange)}
    >
      <SelectTrigger className="w-[100px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="day">Day</SelectItem>
        <SelectItem value="week">Week</SelectItem>
        <SelectItem value="month">Month</SelectItem>
        <SelectItem value="quarter">Quarter</SelectItem>
        <SelectItem value="year">Year</SelectItem>
      </SelectContent>
    </Select>
  ) : null

  return (
    <DashboardWidget
      title={title}
      description={description || ''}
      isLoading={isLoading}
      {...(fetchData && { onRefresh: handleRefresh })}
      className={className}
      actions={rangeSelector}
    >
      <div
        style={{ height: `${height}px` }}
        aria-label={description ? `${title}: ${description}` : title}
        role="img"
      >
        <div className="sr-only">
          {description ? `${title}: ${description}` : title}
          {/* Optionally, summarize the data here for screen readers */}
        </div>
        <canvas ref={chartRef}></canvas>
      </div>
    </DashboardWidget>
  )
}
