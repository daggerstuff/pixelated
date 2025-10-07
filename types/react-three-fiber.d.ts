declare module '@react-three/fiber' {
  import type * as THREE from 'three'
  import type * as React from 'react'

  interface CanvasProps {
    children?: React.ReactNode
    camera?: THREE.Camera | Partial<THREE.CameraProps>
    gl?: THREE.WebGLRenderer | Partial<THREE.WebGLRendererParameters>
    shadows?: boolean
    raycaster?: THREE.Raycaster
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
    camera: THREE.Camera
    scene: THREE.Scene
    gl: THREE.WebGLRenderer
    size: { width: number; height: number }
    viewport: { width: number; height: number }
    pointer: THREE.Vector2
    clock: THREE.Clock
    mouse: THREE.Vector2
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
    objects: Record<string, THREE.Object3D | THREE.Material | THREE.Geometry>,
  ): void

  export function useThree(): RootState
}
