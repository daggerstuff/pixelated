import { extend } from '@react-three/fiber'
import {
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Line,
  BufferGeometry,
  BufferAttribute,
  LineBasicMaterial,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  Group,
  GridHelper,
  InstancedMesh,
  Color,
} from 'three'

// Extend the fiber catalog
extend({
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Line,
  BufferGeometry,
  BufferAttribute,
  LineBasicMaterial,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  Group,
  GridHelper,
  InstancedMesh,
  Color,
})

// This will automatically add the types to JSX.IntrinsicElements
