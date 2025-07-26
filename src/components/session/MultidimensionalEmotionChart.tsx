import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { Object3D, Sphere } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { cn } from '../../lib/utils.js'

// Types for dimensional emotion data and patterns
interface DimensionalEmotionMap {
  primaryVector: {
    valence: number
    arousal: number
    dominance: number
  }
  quadrant: string
  timestamp: Date
  // Add more fields as needed
}

interface MultidimensionalPattern {
  id?: string
  type:
    | 'oscillation'
    | 'progression'
    | 'quadrant_transition'
    | 'dimension_dominance'
    | string
  strength: number
  description: string
  startTime: string | number | Date
  endTime: string | number | Date
  // Add more fields as needed
}

// Define Three.js types to fix TypeScript namespace errors
type WebGLRenderer = typeof THREE.WebGLRenderer.prototype
type Scene = typeof THREE.Scene.prototype
type PerspectiveCamera = typeof THREE.PerspectiveCamera.prototype
type Points = typeof THREE.Points.prototype

type Frustum = typeof THREE.Frustum.prototype
type Vector3 = typeof THREE.Vector3.prototype

interface MultidimensionalEmotionChartProps {
  dimensionalMaps: DimensionalEmotionMap[]
  patterns?: MultidimensionalPattern[]
  className?: string
  height?: number
  isLoading?: boolean
}

// Color map for different emotional quadrants
const quadrantColors: Record<string, string> = {
  'high-arousal positive-valence': '#4ade80', // green-400
  'high-arousal negative-valence': '#f97316', // orange-500
  'low-arousal positive-valence': '#60a5fa', // blue-400
  'low-arousal negative-valence': '#6366f1', // indigo-500
  'neutral': '#94a3b8', // slate-400
}

// Get color for a quadrant, with fallback
const getQuadrantColor = (quadrant: string): string => {
  // Check for partial matches to handle cases with dominance included
  for (const [key, color] of Object.entries(quadrantColors)) {
    if (quadrant.includes(key)) {
      return color
    }
  }
  return '#94a3b8' // slate-400 default
}

// Constants for performance tuning
const LOD_THRESHOLDS = {
  HIGH: 50, // Use high detail under 50 points
  MEDIUM: 200, // Use medium detail under 200 points
  LOW: Infinity, // Use low detail above 200 points
}

// Performance monitoring
const usePerformanceMonitor = () => {
  const [fps, setFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  const measure = () => {
    frameCountRef.current += 1
    const now = performance.now()
    const delta = now - lastTimeRef.current

    if (delta >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / delta))
      frameCountRef.current = 0
      lastTimeRef.current = now
    }
  }

  return { fps, measure }
}

/**
 * Component for visualizing multi-dimensional emotion mapping
 * Displays emotional states in a 3D space using valence, arousal, and dominance dimensions
 */
export default function MultidimensionalEmotionChart({
  dimensionalMaps,
  patterns = [],
  className,
  height = 400,
  isLoading = false,
}: MultidimensionalEmotionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'3d' | 'patterns'>('3d')
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const pointsRef = useRef<Points | null>(null)
  const labelsRef = useRef<Object3D[]>([])
  const objectPoolRef = useRef<Map<string, Object3D[]>>(new Map())
  const animationFrameRef = useRef<number | null>(null)

  const frustrumRef = useRef<Frustum | null>(null)
  const { fps, measure } = usePerformanceMonitor()

  // Determine level of detail based on point count
  const detailLevel = useMemo(() => {
    const count = dimensionalMaps.length
    if (count <= LOD_THRESHOLDS.HIGH) {
      return 'high'
    }
    if (count <= LOD_THRESHOLDS.MEDIUM) {
      return 'medium'
    }
    return 'low'
  }, [dimensionalMaps.length])

  // Memoize sorted maps to avoid recomputation
  const sortedMaps = useMemo(() => {
    return [...dimensionalMaps].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )
  }, [dimensionalMaps])

  // Object pooling logic
  const getOrCreateObject = (type: string, creator: () => Object3D) => {
    if (!objectPoolRef.current.has(type)) {
      objectPoolRef.current.set(type, [])
    }

    const pool = objectPoolRef.current.get(type)!
    if (pool.length > 0) {
      return pool.pop()!
    }

    return creator()
  }

  // Initialize and set up the 3D scene
  useEffect(() => {
    // Copy refs to local variables for cleanup
    const initialContainer = containerRef.current
    const initialRenderer = rendererRef.current
    const initialControls = controlsRef.current
    const initialScene = sceneRef.current
    const initialObjectPool = objectPoolRef.current

    if (!initialContainer || !dimensionalMaps.length || isLoading) {
      return
    }

    // Clean up any existing scene
    if (rendererRef.current) {
      initialContainer.removeChild(rendererRef.current.domElement)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0xf8fafc) // slate-50

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      (containerRef.current?.clientWidth ?? 1) /
        (containerRef.current?.clientHeight ?? 1),
      0.1,
      1000,
    )
    cameraRef.current = camera
    camera.position.z = 2

    // Renderer setup with optimized parameters
    const renderer = new THREE.WebGLRenderer({
      antialias: detailLevel === 'high', // Only use antialiasing for high detail
      powerPreference: 'high-performance',
      precision: detailLevel === 'high' ? 'highp' : 'mediump',
    })
    rendererRef.current = renderer
    renderer.setSize(
      containerRef.current?.clientWidth ?? 1,
      containerRef.current?.clientHeight ?? 1,
    )
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1) // Limit pixel ratio

    // Enable frustum culling
    frustrumRef.current = new THREE.Frustum()

    containerRef.current?.appendChild(renderer.domElement)

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls['enableDamping'] = true
    controls['dampingFactor'] = 0.25

    // Optimize controls based on detail level
    if (detailLevel !== 'high') {
      controls.enableZoom = true
      controls.zoomSpeed = 0.5
      controls.rotateSpeed = 0.5
    }

    // Add axis helper - simplified for performance on lower detail
    if (detailLevel !== 'low') {
      const axisHelper = new THREE.AxesHelper(1.2)
      scene.add(axisHelper)
    } else {
      // Simplified axis representation for low detail
      const axisGeometry = new THREE.BufferGeometry()
      const axisVertices = new Float32Array([
        0, 0, 0, 1.2, 0, 0, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, 0, 0, 1.2,
      ])
      axisGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(axisVertices, 3),
      )
      const axisMaterial = new THREE.LineBasicMaterial({ color: 0x888888 })
      const axisLines = new THREE.LineSegments(axisGeometry, axisMaterial)
      scene.add(axisLines)
    }

    // Add axis labels - only for high and medium detail
    if (detailLevel !== 'low') {
      const createLabel = (text: string, position: Vector3, color: string) => {
        // Use object pooling for labels
        return getOrCreateObject('label', () => {
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            return new Object3D() // Empty fallback
          }

          // Optimize canvas size based on detail level
          const canvasSize = detailLevel === 'high' ? 128 : 64
          canvas.width = canvasSize
          canvas.height = canvasSize / 2

          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)

          context.font = detailLevel === 'high' ? '24px Arial' : '16px Arial'
          context.fillStyle = color
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(text, canvas.width / 2, canvas.height / 2)

          const texture = new THREE.Texture(canvas)
          texture.needsUpdate = true

          const material = new THREE.SpriteMaterial({ map: texture })
          const sprite = new THREE.Sprite(material)
          sprite.position.copy(position)
          sprite.scale.set(0.3, 0.15, 1)

          return sprite
        })
      }

      // Add axis labels
      const xLabel = createLabel(
        'Valence',
        new THREE.Vector3(1.3, 0, 0),
        '#ef4444',
      ) // red-500
      const yLabel = createLabel(
        'Arousal',
        new THREE.Vector3(0, 1.3, 0),
        '#22c55e',
      ) // green-600
      const zLabel = createLabel(
        'Dominance',
        new THREE.Vector3(0, 0, 1.3),
        '#3b82f6',
      ) // blue-500

      if (xLabel) {
        scene.add(xLabel)
      }
      if (yLabel) {
        scene.add(yLabel)
      }
      if (zLabel) {
        scene.add(zLabel)
      }

      labelsRef.current = [xLabel, yLabel, zLabel].filter(Boolean) as Object3D[]
    }

    // Add grid helper - simplify for lower detail
    if (detailLevel === 'high') {
      const gridHelper = new THREE.GridHelper(2, 20)
      gridHelper.rotation.x = Math.PI / 2
      scene.add(gridHelper)
    } else if (detailLevel === 'medium') {
      const gridHelper = new THREE.GridHelper(2, 10)
      gridHelper.rotation.x = Math.PI / 2
      scene.add(gridHelper)
    } else {
      // For low detail, use a minimal grid
      const gridHelper = new THREE.GridHelper(2, 4)
      gridHelper.rotation.x = Math.PI / 2
      scene.add(gridHelper)
    }

    // Create the points geometry - optimize based on detail level
    const vertices: number[] = []
    const colors: number[] = []
    const sizes: number[] = []

    dimensionalMaps.forEach((map) => {
      // Add point for primary vector
      const { valence, arousal, dominance } = map.primaryVector

      // Position in 3D space
      vertices.push(valence, arousal, dominance)

      // Color based on quadrant
      const color = new THREE.Color(getQuadrantColor(map.quadrant))
      colors.push(color.r, color.g, color.b)

      // Vary point size based on time recency for visual interest
      const age = Date.now() - map.timestamp.getTime()
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days in ms
      const normalizedAge = Math.min(age / maxAge, 1)
      const size = 0.05 * (1 - normalizedAge * 0.7) // Newer points are bigger
      sizes.push(size)
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    )
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    // Only add size attribute for high detail (variable point sizes)
    if (detailLevel === 'high') {
      geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1))
    }

    // Create points material with optimizations
    const material = new THREE.PointsMaterial({
      size:
        detailLevel === 'high' ? 0.05 : detailLevel === 'medium' ? 0.04 : 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: detailLevel !== 'low', // disable for low detail
    })

    // Use shader customization for high detail only
    if (detailLevel === 'high') {
      // Custom vertex shader to use the size attribute
      material.onBeforeCompile = (shader: unknown) => {
        // Type assertion for Three.js Shader object
        const typedShader = shader as { vertexShader: string }
        typedShader.vertexShader = typedShader.vertexShader
          .replace(
            'uniform float size;',
            'uniform float size; attribute float size;',
          )
          .replace('gl_PointSize = size;', 'gl_PointSize = size * size;')
      }
    }

    // Create points and add to scene
    const points = new THREE.Points(geometry, material)
    pointsRef.current = points
    scene.add(points)

    // Add time trajectory line
    if (dimensionalMaps.length > 1) {
      const lineVertices: number[] = []

      // For performance, limit the number of line segments based on detail level
      const stride =
        detailLevel === 'high' ? 1 : detailLevel === 'medium' ? 2 : 4

      for (let i = 0; i < sortedMaps.length; i += stride) {
        const map = sortedMaps[i]
        if (map && map.primaryVector) {
          const { valence, arousal, dominance } = map.primaryVector
          lineVertices.push(valence, arousal, dominance)
        }
      }

      const lineGeometry = new THREE.BufferGeometry()
      lineGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(lineVertices, 3),
      )

      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x888888,
        linewidth: 1,
        opacity: 0.6,
        transparent: true,
      })

      const line = new THREE.Line(lineGeometry, lineMaterial)
      scene.add(line)
    }

    // Add origin point (0,0,0) - simpler for low detail
    if (detailLevel !== 'low') {
      const originGeometry = new THREE.SphereGeometry(
        0.02,
        detailLevel === 'high' ? 16 : 8,
        detailLevel === 'high' ? 16 : 8,
      )
      const originMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
      const origin = new THREE.Mesh(originGeometry, originMaterial)
      scene.add(origin)
    }

    // Add render frames
    if (detailLevel === 'high') {
      // Use instanced rendering for frame edges in high detail mode
      const edgeGeometry = new THREE.BoxGeometry(2, 2, 2)
      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x888888,
        linewidth: 1,
        opacity: 0.3,
        transparent: true,
      })

      const boxEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(edgeGeometry),
        edgesMaterial,
      )
      scene.add(boxEdges)
    }

    // Throttled animation loop for better performance
    let lastFrameTime = 0
    const targetFPS = 60
    const frameInterval = 1000 / targetFPS

    // Animation loop
    const animate = (now: number) => {
      animationFrameRef.current = requestAnimationFrame(animate)

      // Measure performance
      measure()

      // Skip frames to maintain target FPS
      const elapsed = now - lastFrameTime
      if (elapsed < frameInterval) {
        return
      }

      // Update time tracking
      lastFrameTime = now - (elapsed % frameInterval)

      if (controlsRef.current) {
        controlsRef.current.update()
      }

      // Update frustum for culling
      if (cameraRef.current && frustrumRef.current) {
        const frustum = frustrumRef.current
        frustum.setFromProjectionMatrix(
          new THREE.Matrix4().multiplyMatrices(
            cameraRef.current.projectionMatrix,
            cameraRef.current.matrixWorldInverse,
          ),
        )

        scene.traverse((object: Object3D) => {
          const { userData } = object as {
            userData?: { isCullable?: boolean; boundingSphere?: Sphere }
          }
          if (userData?.isCullable) {
            const { boundingSphere: sphere } = userData
            if (sphere instanceof Sphere) {
              object.visible = frustum.intersectsSphere(sphere)
            } else {
              object.visible = true
            }
          }
        })
      }

      // Make labels always face the camera - only in higher detail modes
      if (detailLevel !== 'low') {
        labelsRef.current.forEach((label: Object3D) => {
          if (cameraRef.current) {
            label.lookAt(cameraRef.current.position)
          }
        })
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }

    animate(performance.now())

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) {
        return
      }

      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight

      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()

      rendererRef.current.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize)

      const animationFrame = animationFrameRef.current
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }

      if (initialRenderer && initialContainer) {
        initialRenderer.dispose()
        if (initialRenderer.domElement.parentNode === initialContainer) {
          initialContainer.removeChild(initialRenderer.domElement)
        }
      }

      if (initialControls) {
        initialControls.dispose()
      }

      if (initialScene) {
        initialScene.traverse((object: Object3D) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) {
              object.geometry.dispose()
            }
            if (object.material) {
              if (Array.isArray(object.material)) {
                ;(object.material as (typeof THREE.Material)[]).forEach(
                  (material) => material.dispose(),
                )
              } else {
                ;(object.material as typeof THREE.Material).dispose()
              }
            }
          }
        })
      }

      // Clear object pools
      initialObjectPool.clear()
    }
  }, [dimensionalMaps, isLoading, viewMode, detailLevel, sortedMaps, measure])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg">
        <div className="animate-pulse flex flex-col w-full">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2.5"></div>
          <div className="h-40 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!dimensionalMaps.length) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
        <p className="text-gray-500 mb-2">
          No dimensional emotion data available
        </p>
        <p className="text-sm text-gray-400">
          More data needs to be collected for multi-dimensional analysis
        </p>
      </div>
    )
  }

  // Patterns display component
  const PatternsDisplay = () => (
    <div className="p-4">
      <h3 className="text-base font-medium mb-3">Emotion Dimension Patterns</h3>

      {patterns.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No significant patterns detected in the dimensional data
        </p>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <div
              key={
                pattern.id ??
                `${pattern.type}-${pattern.startTime}-${pattern.endTime}`
              }
              className="p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="font-medium">
                  {pattern.type === 'oscillation' && 'Oscillation Pattern'}
                  {pattern.type === 'progression' && 'Progression Pattern'}
                  {pattern.type === 'quadrant_transition' &&
                    'Quadrant Transition'}
                  {pattern.type === 'dimension_dominance' &&
                    'Dominant Dimension'}
                </div>
                <div className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                  Strength: {(pattern.strength * 100).toFixed(0)}%
                </div>
              </div>

              <p className="text-gray-600 mt-1 text-sm">
                {pattern.description}
              </p>

              <div className="mt-2 text-xs text-gray-500 flex justify-between">
                <span>
                  Start: {new Date(pattern.startTime).toLocaleString()}
                </span>
                <span>End: {new Date(pattern.endTime).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div
      className={cn('bg-white rounded-lg shadow-sm overflow-hidden', className)}
    >
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Multi-dimensional Emotion Mapping {fps > 0 && `(${fps} FPS)`}
          </h3>

          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('3d')}
              className={cn(
                'px-3 py-1 text-sm rounded-full',
                viewMode === '3d'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600',
              )}
            >
              3D View
            </button>
            <button
              onClick={() => setViewMode('patterns')}
              className={cn(
                'px-3 py-1 text-sm rounded-full',
                viewMode === 'patterns'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600',
              )}
            >
              Patterns
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: `${height}px` }}>
        {viewMode === '3d' ? (
          <div
            ref={containerRef}
            className="w-full h-full"
            style={{ touchAction: 'none' }}
          />
        ) : (
          <div className="w-full h-full overflow-y-auto">
            <PatternsDisplay />
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          <p className="mb-1">
            <strong>Valence:</strong> Horizontal axis (red) - positive to
            negative emotions
          </p>
          <p className="mb-1">
            <strong>Arousal:</strong> Vertical axis (green) - high to low energy
          </p>
          <p>
            <strong>Dominance:</strong> Depth axis (blue) - feeling in control
            vs. controlled
          </p>
        </div>
      </div>
    </div>
  )
}
