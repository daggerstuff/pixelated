import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, Activity, Zap } from 'lucide-react'

interface BrainRegion {
  id: string
  name: string
  x: number
  y: number
  z: number
  activity: number
  color: string
  size: number
}

interface BrainVisualizationProps {
  moodVector?: {
    emotional_intensity: number
    cognitive_clarity: number
    energy_level: number
    social_connection: number
    coherence_index: number
  }
  archetype?: string
  className?: string
}

export const BrainVisualization: FC<BrainVisualizationProps> = ({
  moodVector,
  archetype,
  className = ""
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(undefined)
  const timeRef = useRef(0)

  // Generate brain regions based on mood vector
  const brainRegions = useMemo((): BrainRegion[] => {
    if (!moodVector) {
      return []
    }

    return [
      // Frontal Cortex - Cognitive Clarity
      {
        id: 'frontal',
        name: 'Frontal Cortex',
        x: 0,
        y: -20,
        z: 30,
        activity: moodVector.cognitive_clarity,
        color: '#3B82F6',
        size: 25
      },
      // Limbic System - Emotional Intensity
      {
        id: 'limbic',
        name: 'Limbic System',
        x: 0,
        y: 10,
        z: 0,
        activity: moodVector.emotional_intensity,
        color: '#EF4444',
        size: 20
      },
      // Brain Stem - Energy Level
      {
        id: 'brainstem',
        name: 'Brain Stem',
        x: 0,
        y: 40,
        z: -10,
        activity: moodVector.energy_level,
        color: '#F59E0B',
        size: 15
      },
      // Temporal Lobe - Social Connection
      {
        id: 'temporal_left',
        name: 'Left Temporal',
        x: -30,
        y: 15,
        z: 0,
        activity: moodVector.social_connection,
        color: '#10B981',
        size: 18
      },
      {
        id: 'temporal_right',
        name: 'Right Temporal',
        x: 30,
        y: 15,
        z: 0,
        activity: moodVector.social_connection,
        color: '#10B981',
        size: 18
      },
      // Parietal Lobe - Coherence
      {
        id: 'parietal',
        name: 'Parietal Lobe',
        x: 0,
        y: -10,
        z: -20,
        activity: moodVector.coherence_index,
        color: '#8B5CF6',
        size: 22
      }
    ]

  }, [moodVector])

  // Animation function
  const animate = useCallback(() => {
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

    // Set up 3D-like perspective
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const scale = 2

    timeRef.current += 0.02

    // Draw brain outline
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(centerX, centerY, 80, 60, 0, 0, 2 * Math.PI)
    ctx.stroke()

    // Draw neural connections
    brainRegions.forEach((region, i) => {
      brainRegions.forEach((otherRegion, j) => {
        if (i >= j) {
          return
        }

        const distance = Math.sqrt(
          Math.pow(region.x - otherRegion.x, 2) +
          Math.pow(region.y - otherRegion.y, 2) +
          Math.pow(region.z - otherRegion.z, 2)
        )

        if (distance < 50) {
          const connectionStrength = (region.activity + otherRegion.activity) / 2
          
          ctx.strokeStyle = `rgba(99, 102, 241, ${connectionStrength * 0.3})`
          ctx.lineWidth = connectionStrength * 2
          ctx.beginPath()
          ctx.moveTo(
            centerX + region.x * scale,
            centerY + region.y * scale
          )
          ctx.lineTo(
            centerX + otherRegion.x * scale,
            centerY + otherRegion.y * scale
          )
          ctx.stroke()
        }
      })
    })

    // Draw brain regions
    brainRegions.forEach((region) => {
      const x = centerX + region.x * scale
      const y = centerY + region.y * scale
      
      // Pulsing effect based on activity
      const pulse = 1 + Math.sin(timeRef.current * 3 + region.x * 0.1) * 0.2 * region.activity
      const radius = (region.size * region.activity * pulse) / 2

      // Glow effect
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2)
      gradient.addColorStop(0, region.color + 'AA')
      gradient.addColorStop(0.5, region.color + '44')
      gradient.addColorStop(1, region.color + '00')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius * 2, 0, 2 * Math.PI)
      ctx.fill()

      // Core region
      ctx.fillStyle = region.color
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fill()

      // Activity indicator
      if (region.activity > 0.7) {
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI)
        ctx.stroke()
      }
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [brainRegions])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    // Set canvas size
    canvas.width = 300
    canvas.height = 200

    // Start animation
    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  const getActivityLevel = (activity: number) => {
    if (activity > 0.8) {
      return { label: 'Very High', color: 'bg-red-500' }
    }
    if (activity > 0.6) {
      return { label: 'High', color: 'bg-orange-500' }
    }
    if (activity > 0.4) {
      return { label: 'Moderate', color: 'bg-yellow-500' }
    }
    if (activity > 0.2) {
      return { label: 'Low', color: 'bg-blue-500' }
    }
    return { label: 'Very Low', color: 'bg-gray-500' }
  }

  return (
    <Card className={`border-0 shadow-lg ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <span>Neural Activity Map</span>
          {archetype && (
            <Badge variant="outline" className="ml-auto">
              {archetype}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 3D Brain Visualization */}
        <div className="relative bg-gradient-to-br from-slate-900 to-purple-900 rounded-lg p-4">
          <canvas
            ref={canvasRef}
            className="w-full h-auto rounded"
            style={{ maxHeight: '200px' }}
          />
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-white/20 text-white">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </div>
        </div>

        {/* Region Activity Indicators */}
        {moodVector && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {brainRegions.slice(0, 4).map((region) => {
              const activityInfo = getActivityLevel(region.activity)
              return (
                <div key={region.id} className="flex items-center space-x-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${activityInfo.color}`}
                    style={{ backgroundColor: region.color }}
                  />
                  <span className="text-gray-600 truncate">{region.name}</span>
                  <Badge variant="outline" className="text-xs py-0 px-1 ml-auto">
                    {Math.round(region.activity * 100)}%
                  </Badge>
                </div>
              )
            })}
          </div>
        )}

        {/* Neural Activity Summary */}
        {moodVector && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Overall Neural Activity</span>
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">
                  {Math.round(
                    (Object.values(moodVector).reduce((a, b) => a + b, 0) / 
                     Object.values(moodVector).length) * 100
                  )}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default BrainVisualization
