declare module 'three/examples/jsm/controls/OrbitControls' {
  import type { Camera, Vector3 } from 'three'
  import { EventDispatcher } from 'three'

  export class OrbitControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement)
    enabled: boolean
    target: THREE.Vector3
    enableZoom: boolean
    enablePan: boolean
    enableRotate: boolean
    zoomSpeed: number
    panSpeed: number
    rotateSpeed: number
    update(): void
    dispose(): void
  }
}
