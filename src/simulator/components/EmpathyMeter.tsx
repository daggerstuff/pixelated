import React, { useEffect, useRef } from 'react'

interface EmpathyMeterProps {
  /** Value between 0 and 1 representing empathy level */
  value: number
  /** Width of the component */
  width?: number
  /** Height of the component */
  height?: number
  /** Optional className for styling */
  className?: string
  /** Show detailed numeric value */
  showValue?: boolean
  /** History of previous values to show trend */
  history?: number[]
}

/**
 * Visual component that displays the current level of empathy detected
 * in therapeutic interactions as a gauge meter with trend information
 */
export default function EmpathyMeter({
  value,
  width = 200,
  height = 100,
  className = '',
  showValue = false,
  history = [],
}: EmpathyMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Ensure value is between 0 and 1
  const normalizedValue = Math.max(0, Math.min(1, value))

  // Map value to angle for gauge visualization
  const angle = normalizedValue * 180 - 90

  // Draw the meter visualization when value changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set dimensions based on props
    canvas.width = width
    canvas.height = height

    // Center point of the gauge
    const centerX = width / 2
    const centerY = height * 0.8
    const radius = Math.min(width, height * 2) * 0.4

    // Draw background arc
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false)
    ctx.lineWidth = 8
    ctx.strokeStyle = '#e5e7eb' // Light gray
    ctx.stroke()

    // Create gradient for the value arc
    const gradient = ctx.createLinearGradient(
      centerX - radius,
      centerY,
      centerX + radius,
      centerY,
    )
    gradient.addColorStop(0, '#ef4444') // Red for low empathy
    gradient.addColorStop(0.5, '#eab308') // Yellow for medium empathy
    gradient.addColorStop(1, '#22c55e') // Green for high empathy

    // Draw value arc
    ctx.beginPath()
    ctx.arc(
      centerX,
      centerY,
      radius,
      Math.PI,
      Math.PI + normalizedValue * Math.PI,
      false,
    )
    ctx.lineWidth = 8
    ctx.strokeStyle = gradient
    ctx.stroke()

    // Draw needle
    const needleLength = radius * 0.95
    const needleAngle = Math.PI + normalizedValue * Math.PI

    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(
      centerX + needleLength * Math.cos(needleAngle),
      centerY + needleLength * Math.sin(needleAngle),
    )
    ctx.lineWidth = 2
    ctx.strokeStyle = '#334155' // Dark blue-gray
    ctx.stroke()

    // Draw needle center point
    ctx.beginPath()
    ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI, false)
    ctx.fillStyle = '#334155'
    ctx.fill()

    // Draw labels
    ctx.font = '10px Arial'
    ctx.fillStyle = '#64748b' // Slate-500
    ctx.textAlign = 'center'

    // Low
    ctx.fillText('Low', centerX - radius * 0.8, centerY - 10)

    // Medium
    ctx.fillText('Medium', centerX, centerY - radius * 0.2 - 10)

    // High
    ctx.fillText('High', centerX + radius * 0.8, centerY - 10)

    // Draw history trend line if provided
    if (history && history.length > 1) {
      const historyHeight = height * 0.2
      const historyTop = 5
      const historyWidth = width - 20
      const historyLeft = 10
      const historyRight = historyLeft + historyWidth

      // Draw history background
      ctx.fillStyle = 'rgba(241, 245, 249, 0.5)' // Very light blue-gray with transparency
      ctx.fillRect(historyLeft, historyTop, historyWidth, historyHeight)

      // Draw history trend line
      ctx.beginPath()

      const pointSpacing = historyWidth / (history.length - 1)

      history.forEach((historyValue, index) => {
        // Normalize history value
        const normalizedHistoryValue = Math.max(0, Math.min(1, historyValue))
        const x = historyLeft + index * pointSpacing
        const y =
          historyTop + historyHeight - normalizedHistoryValue * historyHeight

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.lineWidth = 2
      ctx.strokeStyle = '#3b82f6' // Blue-500
      ctx.stroke()

      // Draw trend arrow
      const lastTwoValues = history.slice(-2)
      if (lastTwoValues.length === 2) {
        const trendDiff = lastTwoValues[1] - lastTwoValues[0]
        const arrowX = historyRight + 5
        const arrowY = historyTop + historyHeight / 2

        // Draw arrow based on trend
        ctx.beginPath()
        ctx.fillStyle =
          trendDiff > 0.03
            ? '#22c55e'
            : trendDiff < -0.03
              ? '#ef4444'
              : '#64748b'

        if (Math.abs(trendDiff) < 0.03) {
          // Horizontal arrow for minimal change
          ctx.moveTo(arrowX - 5, arrowY)
          ctx.lineTo(arrowX + 5, arrowY)
          ctx.lineWidth = 2
          ctx.stroke()
        } else if (trendDiff > 0) {
          // Up arrow
          ctx.moveTo(arrowX, arrowY - 5)
          ctx.lineTo(arrowX + 4, arrowY)
          ctx.lineTo(arrowX - 4, arrowY)
          ctx.fill()
        } else {
          // Down arrow
          ctx.moveTo(arrowX, arrowY + 5)
          ctx.lineTo(arrowX + 4, arrowY)
          ctx.lineTo(arrowX - 4, arrowY)
          ctx.fill()
        }
      }
    }

    // Draw numeric value if enabled
    if (showValue) {
      ctx.font = 'bold 14px Arial'
      ctx.fillStyle = '#1e293b' // Slate-800
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Calculate value as percentage
      const displayValue = Math.round(normalizedValue * 100)
      ctx.fillText(`${displayValue}%`, centerX, centerY + 20)
    }
  }, [value, width, height, showValue, history, normalizedValue, angle])

  return (
    <div className={`empathy-meter relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-auto"
        aria-label={`Empathy level: ${Math.round(normalizedValue * 100)}%`}
      />

      {showValue && (
        <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-gray-600">
          Empathy Level
        </div>
      )}
    </div>
  )
}
