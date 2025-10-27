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
  Filler
)

interface ChartComponentProps {
  type?: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap'
  data?: any
  options?: any
  title?: string
  className?: string
}

const ChartComponent: React.FC<ChartComponentProps> = ({
  type = 'line',
  data,
  options = {},
  title = 'Analytics Chart',
  className = '',
}) => {
  const [chartData, setChartData] = useState(data)
  const [isLoading, setIsLoading] = useState(!data)

  // Default data for demonstration
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
          data: Array.from({ length: 50 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
          })),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
        },
      ],
    },
  }

  // Default options
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
      },
    },
    scales: type !== 'pie' ? {
      x: {
        grid: {
          color: 'rgba(156, 163, 175, 0.3)',
        },
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.3)',
        },
      },
    } : {},
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart',
    },
  }

  useEffect(() => {
    if (!data) {
      // Simulate loading data
      const timer = setTimeout(() => {
        setChartData(defaultData[type] || defaultData.line)
        setIsLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setChartData(data)
      setIsLoading(false)
    }
  }, [data, type])

  const mergedOptions = { ...defaultOptions, ...options }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading chart...</span>
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
    <div className={`w-full h-64 ${className}`}>
      {renderChart()}
    </div>
  )
}

export default ChartComponent
