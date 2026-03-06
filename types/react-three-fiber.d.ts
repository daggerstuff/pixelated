declare module '@react-three/fiber' {
  import type * as React from 'react'
  import type {
    BufferGeometry,
    Camera,
    Clock,
    Material,
    Object3D,
    Raycaster,
    Scene,
    Vector2,
    WebGLRenderer,
    WebGLRendererParameters,
  } from 'three'

  interface CanvasProps {
    children?: React.ReactNode
    camera?: Camera | Partial<Camera>
    gl?: WebGLRenderer | Partial<WebGLRendererParameters>
    shadows?: boolean
    raycaster?: Raycaster
    frameloop?: 'always' | 'demand' | 'never'
    performance?: {
      current?: number
      min?: number
      max?: number
      debounce?: number
    }
    orthographic?: boolean
    dpr?: number | [min: number, max: number]
    linear?: boolean
    flat?: boolean
    events?: Record<string, unknown> // Replaced 'any' with more specific type
    eventSource?: HTMLElement | React.MutableRefObject<HTMLElement>
    eventPrefix?: string
    onCreated?: (state: RootState) => void
    onPointerMissed?: (event: MouseEvent) => void
  }

  interface RootState {
    camera: Camera
    scene: Scene
    gl: WebGLRenderer
    size: { width: number; height: number }
    viewport: { width: number; height: number }
    pointer: Vector2
    clock: Clock
    mouse: Vector2
    frameloop: 'always' | 'demand' | 'never'
    performance: {
      current: number
      min: number
      max: number
      debounce: number
    }
    setEvents: (events: object) => void
    setSize: (width: number, height: number) => void
    setDpr: (dpr: number) => void
    setFrameloop: (frameloop: 'always' | 'demand' | 'never') => void
    onPointerMissed?: (event: MouseEvent) => void
  }

  export const Canvas: React.FC<CanvasProps>

  export function useFrame(
    callback: (state: RootState, delta: number) => void,
  ): void

  export function extend(
    objects: Record<string, Object3D | Material | BufferGeometry>,
  ): void

  export function useThree(): RootState
}
