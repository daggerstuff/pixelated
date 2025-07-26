declare module '@react-three/drei' {
  import type * as React from 'react'
  import * as THREE from 'three'

  // Define a proper interface for OrbitControls props
  interface OrbitControlsProps {
    makeDefault?: boolean;
    camera?: THREE.Camera;
    domElement?: HTMLElement;
    enableDamping?: boolean;
    enablePan?: boolean;
    enableRotate?: boolean;
    enableZoom?: boolean;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
    minAzimuthAngle?: number;
    maxAzimuthAngle?: number;
    dampingFactor?: number;
    rotateSpeed?: number;
    panSpeed?: number;
    zoomSpeed?: number;
    target?: [number, number, number] | THREE.Vector3;
    [key: string]: unknown;
  }

  export const OrbitControls: React.FC<OrbitControlsProps>

  export const Text: React.FC<{
    children: React.ReactNode
    position?: [number, number, number]
    color?: string
    fontSize?: number
    [key: string]: unknown
  }>
}
