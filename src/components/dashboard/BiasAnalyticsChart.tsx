import React, { useEffect, useRef } from 'react'

interface BiasAnalyticsChartProps {
  data: Array<{
    date: string
    biasScore: number
    sessionCount: number
    alertCount: number
  }>
  title: string
  height?: number
}

export const BiasAnalyticsChart: React.FC<BiasAnalyticsChartProps> = ({
  data,
  title,
  height = 300
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !data.length) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, height)

    // Chart dimensions
    const padding = 60
    const chartWidth = rect.width - padding * 2
    const chartHeight = height - padding * 2

    // Data ranges
    const biasScores = data.map(d => d.biasScore)
    const sessionCounts = data.map(d => d.sessionCount)
    const alertCounts = data.map(d => d.alertCount)

    const maxBias = Math.max(...biasScores, 1)
    const maxSessions = Math.max(...sessionCounts, 1)
    const maxAlerts = Math.max(...alertCounts, 1)

    // Draw grid lines
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight * i) / 5
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(rect.width - padding, y)
      ctx.stroke()

      // Y-axis labels
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText((maxBias * (5 - i) / 5 * 100).toFixed(0) + '%', padding - 10, y + 4)
    }

    ctx.setLineDash([])

    // Draw bias score line
    ctx.strokeStyle = '#EF4444'
    ctx.lineWidth = 3
    ctx.beginPath()

    data.forEach((point, index) => {
      const x = padding + (chartWidth * index) / (data.length - 1)
      const y = padding + chartHeight - (chartHeight * point.biasScore) / maxBias

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      // Draw data points
      ctx.fillStyle = '#EF4444'
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.stroke()

    // Draw session count bars
    const barWidth = chartWidth / data.length * 0.3
    ctx.fillStyle = '#3B82F6'

    data.forEach((point, index) => {
      const x = padding + (chartWidth * index) / (data.length - 1) - barWidth / 2
      const barHeight = (chartHeight * point.sessionCount) / maxSessions
      const y = padding + chartHeight - barHeight

      ctx.fillRect(x, y, barWidth, barHeight)
    })

    // Draw alert count line
    ctx.strokeStyle = '#F59E0B'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()

    data.forEach((point, index) => {
      const x = padding + (chartWidth * index) / (data.length - 1)
      const y = padding + chartHeight - (chartHeight * point.alertCount) / maxAlerts

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()
    ctx.setLineDash([])

    // Draw X-axis labels
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'center'

    data.forEach((point, index) => {
      if (index % Math.ceil(data.length / 7) === 0) { // Show every nth label
        const x = padding + (chartWidth * index) / (data.length - 1)
        const date = new Date(point.date)
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        ctx.fillText(label, x, height - 20)
      }
    })

    // Draw legend
    const legendY = 30
    const legendItems = [
      { color: '#EF4444', label: 'Bias Score' },
      { color: '#3B82F6', label: 'Sessions' },
      { color: '#F59E0B', label: 'Alerts' }
    ]

    legendItems.forEach((item, index) => {
      const x = padding + index * 120

      // Color indicator
      ctx.fillStyle = item.color
      ctx.fillRect(x, legendY - 8, 12, 12)

      // Label
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(item.label, x + 16, legendY)
    })

  }, [data, height])

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-600/30">
      <h3 className="text-lg font-semibold text-blue-200 mb-4">{title}</h3>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: `${height}px` }}
        />
        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>No data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BiasAnalyticsChart
