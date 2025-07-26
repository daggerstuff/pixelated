import React, { useRef, useEffect, useState } from 'react'

interface EmotionDataPoint {
  id: string
  timestamp: Date
  valence: number // -1 to 1 (negative to positive)
  arousal: number // -1 to 1 (calm to excited)
  dominance: number // -1 to 1 (submissive to dominant)
  emotion?: string
}

interface MultidimensionalEmotionChartProps {
  emotionData?: EmotionDataPoint[]
  isLoading?: boolean
}

const MultidimensionalEmotionChart: React.FC<MultidimensionalEmotionChartProps> = ({
  emotionData = [],
  isLoading = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Mock data for demo purposes
  const mockData: EmotionDataPoint[] = [
    { id: '1', timestamp: new Date('2024-01-01'), valence: 0.3, arousal: 0.2, dominance: 0.1, emotion: 'Content' },
    { id: '2', timestamp: new Date('2024-01-02'), valence: -0.2, arousal: 0.5, dominance: -0.1, emotion: 'Anxious' },
    { id: '3', timestamp: new Date('2024-01-03'), valence: 0.7, arousal: 0.6, dominance: 0.4, emotion: 'Excited' },
    { id: '4', timestamp: new Date('2024-01-04'), valence: -0.4, arousal: -0.3, dominance: -0.2, emotion: 'Sad' },
    { id: '5', timestamp: new Date('2024-01-05'), valence: 0.1, arousal: -0.1, dominance: 0.2, emotion: 'Calm' },
    { id: '6', timestamp: new Date('2024-01-06'), valence: 0.5, arousal: 0.3, dominance: 0.3, emotion: 'Happy' },
    { id: '7', timestamp: new Date('2024-01-07'), valence: -0.1, arousal: 0.7, dominance: 0.1, emotion: 'Stressed' },
    { id: '8', timestamp: new Date('2024-01-08'), valence: 0.8, arousal: 0.4, dominance: 0.6, emotion: 'Confident' }
  ]

  const data = emotionData.length > 0 ? emotionData : mockData

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    if (isLoading) {
      ctx.fillStyle = '#666'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Loading emotion data...', rect.width / 2, rect.height / 2)
      return
    }

    // Draw 3D coordinate system
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const scale = Math.min(rect.width, rect.height) * 0.3

    // Apply rotation
    const cosX = Math.cos(rotation.x)
    const sinX = Math.sin(rotation.x)
    const cosY = Math.cos(rotation.y)
    const sinY = Math.sin(rotation.y)

    // Project 3D point to 2D
    const project3D = (x: number, y: number, z: number) => {
      // Apply rotation
      const x1 = x * cosY - z * sinY
      const z1 = x * sinY + z * cosY
      const y1 = y * cosX - z1 * sinX
      const z2 = y * sinX + z1 * cosX

      return {
        x: centerX + x1 * scale,
        y: centerY - y1 * scale,
        z: z2
      }
    }

    // Draw axes
    ctx.strokeStyle = '#888'
    ctx.lineWidth = 2

    // X-axis (Valence)
    const xStart = project3D(-1, 0, 0)
    const xEnd = project3D(1, 0, 0)
    ctx.beginPath()
    ctx.moveTo(xStart.x, xStart.y)
    ctx.lineTo(xEnd.x, xEnd.y)
    ctx.stroke()

    // Y-axis (Arousal)
    const yStart = project3D(0, -1, 0)
    const yEnd = project3D(0, 1, 0)
    ctx.beginPath()
    ctx.moveTo(yStart.x, yStart.y)
    ctx.lineTo(yEnd.x, yEnd.y)
    ctx.stroke()

    // Z-axis (Dominance)
    const zStart = project3D(0, 0, -1)
    const zEnd = project3D(0, 0, 1)
    ctx.beginPath()
    ctx.moveTo(zStart.x, zStart.y)
    ctx.lineTo(zEnd.x, zEnd.y)
    ctx.stroke()

    // Draw axis labels
    ctx.fillStyle = '#444'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Valence (+)', xEnd.x + 20, xEnd.y)
    ctx.fillText('Arousal (+)', yEnd.x, yEnd.y - 10)
    ctx.fillText('Dominance (+)', zEnd.x + 15, zEnd.y + 5)

    // Draw emotion data points
    data.forEach((point, index) => {
      const projected = project3D(point.valence, point.arousal, point.dominance)
      
      // Color based on time (newer = brighter)
      const intensity = (index + 1) / data.length
      const hue = 240 - (intensity * 120) // Blue to green gradient
      ctx.fillStyle = `hsl(${hue}, 70%, ${50 + intensity * 30}%)`
      
      // Draw point
      ctx.beginPath()
      ctx.arc(projected.x, projected.y, 6, 0, 2 * Math.PI)
      ctx.fill()
      
      // Draw emotion label
      if (point.emotion) {
        ctx.fillStyle = '#333'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(point.emotion, projected.x, projected.y - 10)
      }
    })

    // Connect points with lines
    if (data.length > 1) {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      
      const firstPoint = data[0]
      if (firstPoint) {
        const projectedFirst = project3D(firstPoint.valence, firstPoint.arousal, firstPoint.dominance)
        ctx.moveTo(projectedFirst.x, projectedFirst.y)
        
        for (let i = 1; i < data.length; i++) {
          const currentPoint = data[i]
          if (currentPoint) {
            const point = project3D(currentPoint.valence, currentPoint.arousal, currentPoint.dominance)
            ctx.lineTo(point.x, point.y)
          }
        }
        
        ctx.stroke()
      }
    }

  }, [data, rotation, isLoading])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) {
      return
    }

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    setRotation(prev => ({
      x: prev.x + deltaY * 0.01,
      y: prev.y + deltaX * 0.01
    }))

    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      <div className="absolute top-4 left-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-md">
        <h3 className="text-sm font-semibold mb-2">3D Emotion Space</h3>
        <div className="text-xs space-y-1">
          <div><span className="font-medium">Valence:</span> Pleasure/Displeasure</div>
          <div><span className="font-medium">Arousal:</span> Activation/Deactivation</div>
          <div><span className="font-medium">Dominance:</span> Control/Submission</div>
        </div>
        <div className="text-xs mt-2 text-gray-600">
          Click and drag to rotate
        </div>
      </div>

      {data.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500 text-center">
            <div className="text-lg mb-2">No emotion data available</div>
            <div className="text-sm">Start a therapy session to see emotion patterns</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MultidimensionalEmotionChart
