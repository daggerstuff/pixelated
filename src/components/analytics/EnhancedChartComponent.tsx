import React, { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar, Pie, Scatter } from 'react-chartjs-2'
import { useChartData } from '@/hooks/useComponentIntegration'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

interface EnhancedChartComponentProps {
  type?: 'line' | 'bar' | 'pie' | 'scatter'
  title?: string
  className?: string
  data?: {
    category?: 'progress' | 'emotions' | 'sessions' | 'outcomes'
    timeRange?: number
    clientId?: string
    sessionId?: string
    dataPoints?: number
    useBackendData?: boolean
    autoRefresh?: boolean
    refreshInterval?: number
  }
  options?: any
  fallbackData?: any
}

const EnhancedChartComponent: React.FC<EnhancedChartComponentProps> = ({
  type = 'line',
  title = 'Analytics Chart',
  className = '',
  data: dataConfig,
  options = {},
  fallbackData,
}) => {
  const [useBackend, setUseBackend] = useState(
    dataConfig?.useBackendData || false,
  )
  const [error, setError] = useState<string | null>(null)

  // Use backend integration hook when enabled
  const {
    chartData: backendData,
    loading: backendLoading,
    error: backendError,
    refresh: refreshBackendData,
  } = useChartData({
    type,
    category: dataConfig?.category || 'progress',
    timeRange: dataConfig?.timeRange || 30,
    clientId: dataConfig?.clientId,
    sessionId: dataConfig?.sessionId,
    dataPoints: dataConfig?.dataPoints || 50,
    autoRefresh: dataConfig?.autoRefresh || false,
    refreshInterval: dataConfig?.refreshInterval || 60000,
  })

  // Fallback to default data if backend is not available
  const defaultData = {
    line: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Progress Tracking',
          data: [65, 59, 80, 81, 56, 55],
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    },
    bar: {
      labels: ['Anxiety', 'Depression', 'Stress', 'Mood', 'Energy'],
      datasets: [
        {
          label: 'Session Metrics',
          data: [12, 19, 8, 15, 20],
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(59, 130, 246, 0.8)',
          ],
        },
      ],
    },
    pie: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [
        {
          label: 'Emotion Distribution',
          data: [45, 30, 25],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(156, 163, 175, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
        },
      ],
    },
    scatter: {
      datasets: [
        {
          label: 'Correlation Analysis',
          data: Array.from({ length: 30 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
          })),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
        },
      ],
    },
  }

  // Determine which data to use
  const chartData =
    useBackend && backendData?.data
      ? backendData.data
      : fallbackData || defaultData[type] || defaultData.line

  // Handle backend errors gracefully
  useEffect(() => {
    if (backendError && useBackend) {
      console.warn(
        'Backend chart data unavailable, falling back to demo data:',
        backendError,
      )
      setError('Live data temporarily unavailable')
      // Optionally fall back to demo data
      setUseBackend(false)
    } else if (error && !backendError && useBackend) {
      setError(null)
    }
  }, [backendError, useBackend, error])

  // Default chart options with therapy-specific styling
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          // Add custom tooltip content for therapy context
          afterBody: function (context: any) {
            if (useBackend && backendData?.metadata) {
              return [
                '',
                `Data Source: ${backendData.metadata.source}`,
                `Last Updated: ${new Date(backendData.metadata.lastUpdated).toLocaleTimeString()}`,
              ]
            }
            return []
          },
        },
      },
    },
    scales:
      type !== 'pie'
        ? {
            x: {
              grid: {
                color: 'rgba(156, 163, 175, 0.2)',
                drawBorder: false,
              },
              ticks: {
                color: 'rgba(75, 85, 99, 0.8)',
                font: {
                  size: 11,
                },
              },
            },
            y: {
              grid: {
                color: 'rgba(156, 163, 175, 0.2)',
                drawBorder: false,
              },
              ticks: {
                color: 'rgba(75, 85, 99, 0.8)',
                font: {
                  size: 11,
                },
              },
              beginAtZero: true,
            },
          }
        : {},
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart',
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  const mergedOptions = { ...defaultOptions, ...options }

  // Loading state
  if (useBackend && backendLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <span className="text-gray-600">Loading chart data...</span>
          {dataConfig?.autoRefresh && (
            <span className="text-xs text-gray-500 mt-1">
              Auto-refreshing every{' '}
              {(dataConfig.refreshInterval || 60000) / 1000}s
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return <Bar data={chartData} options={mergedOptions} />
      case 'pie':
        return <Pie data={chartData} options={mergedOptions} />
      case 'scatter':
        return <Scatter data={chartData} options={mergedOptions} />
      case 'line':
      default:
        return <Line data={chartData} options={mergedOptions} />
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Chart container */}
      <div className="w-full h-64">{renderChart()}</div>

      {/* Status indicators */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          {/* Data source indicator */}
          <div className="flex items-center space-x-1">
            <div
              className={`w-2 h-2 rounded-full ${
                useBackend && !backendError
                  ? 'bg-green-500'
                  : error
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
              }`}
            ></div>
            <span>
              {useBackend && !backendError
                ? 'Live Data'
                : error
                  ? 'Demo Data'
                  : 'Static Data'}
            </span>
          </div>

          {/* Refresh button for manual updates */}
          {useBackend && (
            <button
              onClick={refreshBackendData}
              className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
              title="Refresh data"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh</span>
            </button>
          )}
        </div>

        {/* Metadata display */}
        {useBackend && backendData?.metadata && (
          <div className="text-right">
            <div>{backendData.metadata.totalDataPoints} data points</div>
            {backendData.metadata.timeRange && (
              <div>Range: {backendData.metadata.timeRange}</div>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          <div className="flex items-center space-x-1">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedChartComponent
