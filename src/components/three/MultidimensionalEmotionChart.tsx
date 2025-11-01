import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei'
import * as THREE from 'three'

// Extend Three.js objects for react-three-fiber
extend({ OrbitControls })

interface EmotionPoint {
  id: string
  valence: number // -1 to 1 (negative to positive)
  arousal: number // -1 to 1 (calm to excited)
  dominance: number // -1 to 1 (submissive to dominant)
  emotion: string
  timestamp: Date
  intensity: number
}

interface MultidimensionalEmotionChartProps {
  data?: EmotionPoint[]
  showTrails?: boolean
  showAxes?: boolean
  className?: string
}

const EmotionSphere: React.FC<{ point: EmotionPoint; index: number }> = ({ point, index }) => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + index) * 0.002
      
      // Scale based on hover
      const targetScale = hovered ? 1.2 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
    }
  })

  // Map emotion values to 3D coordinates
  const position: [number, number, number] = [
    point.valence * 3, // X-axis: valence
    point.arousal * 3, // Y-axis: arousal  
    point.dominance * 3 // Z-axis: dominance
  ]

  // Color based on emotion quadrant
  const getEmotionColor = () => {
    const { valence, arousal } = point
    if (valence > 0 && arousal > 0) return '#10B981' // Green - positive high arousal
    if (valence > 0 && arousal < 0) return '#3B82F6' // Blue - positive low arousal
    if (valence < 0 && arousal > 0) return '#EF4444' // Red - negative high arousal
    return '#8B5CF6' // Purple - negative low arousal
  }

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.1 * point.intensity, 16, 16]} />
      <meshStandardMaterial 
        color={getEmotionColor()} 
        transparent 
        opacity={hovered ? 0.9 : 0.7}
        emissive={getEmotionColor()}
        emissiveIntensity={hovered ? 0.2 : 0.1}
      />
      {hovered && (
        <Text
          position={[0, 0.3, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {point.emotion}
        </Text>
      )}
    </mesh>
  )
}

const EmotionTrail: React.FC<{ points: EmotionPoint[] }> = ({ points }) => {
  const trailPoints = useMemo(() => {
    return points
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(point => new THREE.Vector3(
        point.valence * 3,
        point.arousal * 3,
        point.dominance * 3
      ))
  }, [points])

  if (trailPoints.length < 2) return null

  return (
    <Line
      points={trailPoints}
      color="#64748B"
      lineWidth={2}
      transparent
      opacity={0.6}
    />
  )
}

const CoordinateAxes: React.FC = () => {
  return (
    <group>
      {/* X-axis (Valence) */}
      <Line
        points={[[-4, 0, 0], [4, 0, 0]]}
        color="#EF4444"
        lineWidth={2}
      />
      <Text position={[4.2, 0, 0]} fontSize={0.3} color="#EF4444">
        Valence+
      </Text>
      <Text position={[-4.2, 0, 0]} fontSize={0.3} color="#EF4444">
        Valence-
      </Text>

      {/* Y-axis (Arousal) */}
      <Line
        points={[[0, -4, 0], [0, 4, 0]]}
        color="#10B981"
        lineWidth={2}
      />
      <Text position={[0, 4.2, 0]} fontSize={0.3} color="#10B981">
        Arousal+
      </Text>
      <Text position={[0, -4.2, 0]} fontSize={0.3} color="#10B981">
        Arousal-
      </Text>

      {/* Z-axis (Dominance) */}
      <Line
        points={[[0, 0, -4], [0, 0, 4]]}
        color="#3B82F6"
        lineWidth={2}
      />
      <Text position={[0, 0, 4.2]} fontSize={0.3} color="#3B82F6">
        Dominance+
      </Text>
      <Text position={[0, 0, -4.2]} fontSize={0.3} color="#3B82F6">
        Dominance-
      </Text>
    </group>
  )
}

const Scene: React.FC<{ 
  data: EmotionPoint[]
  showTrails: boolean
  showAxes: boolean 
}> = ({ data, showTrails, showAxes }) => {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} />

      {/* Coordinate system */}
      {showAxes && <CoordinateAxes />}

      {/* Emotion points */}
      {data.map((point, index) => (
        <EmotionSphere key={point.id} point={point} index={index} />
      ))}

      {/* Emotion trail */}
      {showTrails && <EmotionTrail points={data} />}

      {/* Controls */}
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        zoomSpeed={0.6}
        panSpeed={0.8}
        rotateSpeed={0.4}
      />
    </>
  )
}

const MultidimensionalEmotionChart: React.FC<MultidimensionalEmotionChartProps> = ({
  data,
  showTrails = true,
  showAxes = true,
  className = '',
}) => {
  const [emotionData, setEmotionData] = useState<EmotionPoint[]>([])

  // Default sample data
  const defaultData: EmotionPoint[] = useMemo(() => [
    {
      id: '1',
      valence: 0.8,
      arousal: 0.6,
      dominance: 0.4,
      emotion: 'Joy',
      timestamp: new Date(Date.now() - 300000),
      intensity: 1.2,
    },
    {
      id: '2',
      valence: -0.6,
      arousal: 0.8,
      dominance: -0.2,
      emotion: 'Anger',
      timestamp: new Date(Date.now() - 240000),
      intensity: 1.1,
    },
    {
      id: '3',
      valence: -0.4,
      arousal: -0.7,
      dominance: -0.6,
      emotion: 'Sadness',
      timestamp: new Date(Date.now() - 180000),
      intensity: 0.9,
    },
    {
      id: '4',
      valence: 0.2,
      arousal: -0.8,
      dominance: 0.3,
      emotion: 'Calm',
      timestamp: new Date(Date.now() - 120000),
      intensity: 0.8,
    },
    {
      id: '5',
      valence: 0.6,
      arousal: 0.4,
      dominance: 0.7,
      emotion: 'Confidence',
      timestamp: new Date(Date.now() - 60000),
      intensity: 1.0,
    },
    {
      id: '6',
      valence: 0.1,
      arousal: 0.1,
      dominance: 0.1,
      emotion: 'Neutral',
      timestamp: new Date(),
      intensity: 0.7,
    },
  ], [])

  useEffect(() => {
    setEmotionData(data || defaultData)
  }, [data, defaultData])

  return (
    <div className={`w-full h-96 bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [8, 6, 8], fov: 50 }}
        style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}
      >
        <Scene 
          data={emotionData} 
          showTrails={showTrails} 
          showAxes={showAxes} 
        />
      </Canvas>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white p-3 rounded text-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Positive High Arousal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Positive Low Arousal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Negative High Arousal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span>Negative Low Arousal</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MultidimensionalEmotionChart
