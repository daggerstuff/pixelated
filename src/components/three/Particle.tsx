import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'

// Extend Three.js objects for react-three-fiber
extend({ OrbitControls })

interface ParticleProps {
  position: [number, number, number]
  velocity: [number, number, number]
  color: string
  size: number
  emotion?:
    | 'joy'
    | 'sadness'
    | 'anger'
    | 'fear'
    | 'surprise'
    | 'disgust'
    | 'neutral'
  intensity: number
}

interface ParticleSystemProps {
  particleCount?: number
  emotion?:
    | 'joy'
    | 'sadness'
    | 'anger'
    | 'fear'
    | 'surprise'
    | 'disgust'
    | 'neutral'
  interactive?: boolean
  autoAnimate?: boolean
  className?: string
  enableMouse?: boolean
  showTrails?: boolean
}

const ParticleSystem: React.FC<{
  particles: ParticleProps[]
  mousePosition: THREE.Vector3
  interactive: boolean
  showTrails: boolean
}> = ({ particles, mousePosition, interactive, showTrails }) => {
  const groupRef = useRef<THREE.Group>(null!)
  const trailGeometryRef = useRef<THREE.BufferGeometry>(null!)
  const [trailPoints, setTrailPoints] = useState<THREE.Vector3[]>([])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Update particle positions and behaviors
    groupRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh
      const particle = particles[index]

      if (!particle) return

      // Emotion-based movement patterns
      const time = state.clock.elapsedTime
      const emotionFactor = getEmotionMovementFactor(
        particle.emotion || 'neutral',
        time,
      )

      // Base movement
      mesh.position.x += particle.velocity[0] * delta * emotionFactor.speed
      mesh.position.y += particle.velocity[1] * delta * emotionFactor.speed
      mesh.position.z += particle.velocity[2] * delta * emotionFactor.speed

      // Emotion-specific behaviors
      switch (particle.emotion) {
        case 'joy':
          mesh.position.y +=
            Math.sin(time * 2 + index) * 0.02 * particle.intensity
          break
        case 'sadness':
          mesh.position.y -=
            Math.abs(Math.sin(time * 0.5 + index)) * 0.01 * particle.intensity
          break
        case 'anger':
          mesh.position.x +=
            Math.sin(time * 4 + index) * 0.03 * particle.intensity
          mesh.position.z +=
            Math.cos(time * 4 + index) * 0.03 * particle.intensity
          break
        case 'fear':
          // Jittery movement
          mesh.position.add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.02 * particle.intensity,
              (Math.random() - 0.5) * 0.02 * particle.intensity,
              (Math.random() - 0.5) * 0.02 * particle.intensity,
            ),
          )
          break
        case 'surprise':
          // Sudden movements
          if (Math.sin(time * 3 + index) > 0.95) {
            mesh.position.add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 0.1 * particle.intensity,
                (Math.random() - 0.5) * 0.1 * particle.intensity,
                (Math.random() - 0.5) * 0.1 * particle.intensity,
              ),
            )
          }
          break
      }

      // Interactive mouse attraction/repulsion
      if (interactive && mousePosition) {
        const distance = mesh.position.distanceTo(mousePosition)
        const maxDistance = 5

        if (distance < maxDistance) {
          const direction = new THREE.Vector3()
            .subVectors(mesh.position, mousePosition)
            .normalize()

          const force = (1 - distance / maxDistance) * 0.02 * particle.intensity
          mesh.position.add(direction.multiplyScalar(force))
        }
      }

      // Boundary constraints
      const boundary = 10
      if (Math.abs(mesh.position.x) > boundary) {
        mesh.position.x = Math.sign(mesh.position.x) * boundary
        particle.velocity[0] *= -0.8
      }
      if (Math.abs(mesh.position.y) > boundary) {
        mesh.position.y = Math.sign(mesh.position.y) * boundary
        particle.velocity[1] *= -0.8
      }
      if (Math.abs(mesh.position.z) > boundary) {
        mesh.position.z = Math.sign(mesh.position.z) * boundary
        particle.velocity[2] *= -0.8
      }

      // Rotation based on emotion
      mesh.rotation.x += emotionFactor.rotation * delta
      mesh.rotation.y += emotionFactor.rotation * delta * 0.7
      mesh.rotation.z += emotionFactor.rotation * delta * 0.3

      // Scale pulsing
      const scale =
        1 +
        Math.sin(time * emotionFactor.pulse + index) * 0.2 * particle.intensity
      mesh.scale.setScalar(scale)
    })

    // Update trails if enabled
    if (showTrails && groupRef.current.children.length > 0) {
      const newTrailPoints = groupRef.current.children
        .slice(0, 5)
        .map((child) => (child as THREE.Mesh).position.clone())
      setTrailPoints((prev) => [...prev.slice(-50), ...newTrailPoints])
    }
  })

  return (
    <group ref={groupRef}>
      {particles.map((particle, index) => (
        <mesh key={index} position={particle.position}>
          <sphereGeometry args={[particle.size, 8, 8]} />
          <meshStandardMaterial
            color={particle.color}
            transparent
            opacity={0.7 + particle.intensity * 0.3}
            emissive={particle.color}
            emissiveIntensity={0.1 + particle.intensity * 0.2}
          />
        </mesh>
      ))}

      {/* Trail visualization */}
      {showTrails && trailPoints.length > 1 && (
        <line>
          <bufferGeometry ref={trailGeometryRef}>
            <bufferAttribute
              attach="attributes-position"
              count={trailPoints.length}
              array={
                new Float32Array(trailPoints.flatMap((p) => [p.x, p.y, p.z]))
              }
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#64748B" transparent opacity={0.4} />
        </line>
      )}
    </group>
  )
}

const getEmotionMovementFactor = (emotion: string, _time: number) => {
  switch (emotion) {
    case 'joy':
      return { speed: 1.2, rotation: 2, pulse: 3 }
    case 'sadness':
      return { speed: 0.5, rotation: 0.5, pulse: 1 }
    case 'anger':
      return { speed: 1.8, rotation: 4, pulse: 5 }
    case 'fear':
      return { speed: 0.8, rotation: 3, pulse: 6 }
    case 'surprise':
      return { speed: 1.5, rotation: 2.5, pulse: 4 }
    case 'disgust':
      return { speed: 0.7, rotation: 1, pulse: 2 }
    default:
      return { speed: 1, rotation: 1, pulse: 2 }
  }
}

const getEmotionColor = (emotion: string, intensity: number) => {
  const colors = {
    joy: '#FFD700', // Gold
    sadness: '#4682B4', // Steel Blue
    anger: '#DC143C', // Crimson
    fear: '#9932CC', // Dark Orchid
    surprise: '#FF69B4', // Hot Pink
    disgust: '#228B22', // Forest Green
    neutral: '#708090', // Slate Gray
  }

  const baseColor = colors[emotion as keyof typeof colors] || colors.neutral

  // Adjust color intensity
  const color = new THREE.Color(baseColor)
  const factor = 0.5 + intensity * 0.5
  return `#${color.multiplyScalar(factor).getHexString()}`
}

const Particle: React.FC<ParticleSystemProps> = ({
  particleCount = 50,
  emotion = 'neutral',
  interactive = true,
  autoAnimate = true,
  className = '',
  enableMouse = true,
  showTrails = false,
}) => {
  const [mousePosition, setMousePosition] = useState(new THREE.Vector3())
  const [currentEmotion, setCurrentEmotion] = useState(emotion)

  // Generate particles based on emotion
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2
      const radius = 3 + Math.random() * 4
      const intensity = 0.3 + Math.random() * 0.7

      return {
        position: [
          Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 6,
          Math.sin(angle) * radius + (Math.random() - 0.5) * 2,
        ] as [number, number, number],
        velocity: [
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
        ] as [number, number, number],
        color: getEmotionColor(currentEmotion, intensity),
        size: 0.1 + Math.random() * 0.15,
        emotion: currentEmotion,
        intensity,
      }
    })
  }, [particleCount, currentEmotion])

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!enableMouse) return

    const rect = (event.target as Element).getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    setMousePosition(new THREE.Vector3(x * 8, y * 8, 0))
  }

  return (
    <div className={`relative ${className}`} style={{ height: '500px' }}>
      <Canvas
        camera={{ position: [8, 8, 8], fov: 60 }}
        onMouseMove={handleMouseMove}
        style={{
          background:
            'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
          cursor: interactive ? 'pointer' : 'default',
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.6} />
        <pointLight
          position={[-10, -10, -10]}
          intensity={0.3}
          color="#4444ff"
        />
        <pointLight position={[0, 0, 0]} intensity={0.4} color="#ff4444" />

        {/* Background stars */}
        <Stars
          radius={100}
          depth={50}
          count={1000}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />

        {/* Particle system */}
        <ParticleSystem
          particles={particles}
          mousePosition={mousePosition}
          interactive={interactive}
          showTrails={showTrails}
        />

        {/* Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          zoomSpeed={0.6}
          panSpeed={0.8}
          rotateSpeed={0.4}
          autoRotate={autoAnimate}
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* Emotion Controls */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Emotion Controls</h3>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              'joy',
              'sadness',
              'anger',
              'fear',
              'surprise',
              'disgust',
              'neutral',
            ] as const
          ).map((emotionType) => (
            <button
              key={emotionType}
              onClick={() => setCurrentEmotion(emotionType)}
              className={`px-3 py-2 rounded text-sm capitalize transition-colors ${
                currentEmotion === emotionType
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {emotionType}
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-300">
          <div>Particles: {particleCount}</div>
          <div>Interactive: {interactive ? 'On' : 'Off'}</div>
          <div>Trails: {showTrails ? 'On' : 'Off'}</div>
        </div>
      </div>

      {/* Instructions */}
      {interactive && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white p-3 rounded text-sm max-w-xs">
          <p>
            Move your mouse to interact with particles. Use mouse wheel to zoom
            and drag to rotate the view.
          </p>
        </div>
      )}
    </div>
  )
}

export default Particle
