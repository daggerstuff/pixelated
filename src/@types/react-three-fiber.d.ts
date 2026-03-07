/**
 * Type definitions for React Three Fiber JSX elements
 * This extends the JSX namespace to include Three.js object properties
 */

import type * as THREE from 'three'
import type {
  Object3DNode,
  MaterialNode,
  BufferGeometryNode,
} from '@react-three/fiber'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Geometry
      sphereGeometry: Object3DNode<
        THREE.SphereGeometry,
        typeof THREE.SphereGeometry
      >
      bufferGeometry: Object3DNode<
        THREE.BufferGeometry,
        typeof THREE.BufferGeometry
      >
      gridHelper: Object3DNode<THREE.GridHelper, typeof THREE.GridHelper>

      // Materials
      meshBasicMaterial: MaterialNode<
        THREE.MeshBasicMaterial,
        typeof THREE.MeshBasicMaterial
      >
      lineBasicMaterial: MaterialNode<
        THREE.LineBasicMaterial,
        typeof THREE.LineBasicMaterial
      >
      spriteMaterial: MaterialNode<
        THREE.SpriteMaterial,
        typeof THREE.SpriteMaterial
      >

      // Objects
      mesh: Object3DNode<THREE.Mesh, typeof THREE.Mesh>
      sprite: Object3DNode<THREE.Sprite, typeof THREE.Sprite>
      group: Object3DNode<THREE.Group, typeof THREE.Group>
      line: Object3DNode<THREE.Line, typeof THREE.Line>
      instancedMesh: Object3DNode<
        THREE.InstancedMesh,
        typeof THREE.InstancedMesh
      >

      // Textures
      canvasTexture: Object3DNode<
        THREE.CanvasTexture,
        typeof THREE.CanvasTexture
      >

      // Buffer attributes
      bufferAttribute: {
        attach: string
        args: [ArrayLike<number>, number]
      }

      // Color
      color: {
        attach: string
        args: [number | string | THREE.Color, number?, number?]
      }
    }
  }
}
