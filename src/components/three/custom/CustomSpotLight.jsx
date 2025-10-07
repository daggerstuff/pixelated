/* eslint-disable */
import PropTypes from 'prop-types'

import * as React from 'react'
import {
  Vector3,
  WebGLRenderTarget,
  RGBAFormat,
  ShaderMaterial,
  Mesh,
  SpotLight as SpotLightImpl,
  MathUtils,
} from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { FullScreenQuad } from 'three-stdlib'

// Create compatibility shim for removed encoding constants

// Implementation copied from drei's SpotLight but fixed to work with latest three.js
export default function CustomSpotLight({
  children,
  color = 'white',
  intensity = 1,
  angle = 0.15,
  penumbra = 0,
  decay = 2,
  distance = 5,
  shadow,
  volumetric = false,
  debug = false,
  position = [0, 0, 0],
  ...props
}) {
  const { size, camera } = useThree()
  const groupRef = React.useRef(null)
  const lightRef = React.useRef(null)
  const virtualCamRef = React.useRef(null)

  const [
    virtualCam,
    spotLight,
    targetMesh,
    renderTarget,
    renderTargetBlur,
    blurPass,
    quad,
  ] = React.useMemo(() => {
    const virtualCam = camera.clone()
    const spotLight = new SpotLightImpl(
      color,
      intensity,
      distance,
      angle,
      penumbra,
      decay,
    )
    spotLight.position.set(...position)

    if (shadow) {
      spotLight.castShadow = true
      spotLight.shadow.bias = -0.001
      spotLight.shadow.mapSize.width = 1024
      spotLight.shadow.mapSize.height = 1024
      spotLight.shadow.camera.near = 0.5
      spotLight.shadow.camera.far = distance + 2
      spotLight.shadow.camera.fov = MathUtils.radToDeg(angle) * 2
    }

    const targetMesh = new Mesh()
    targetMesh.visible = false

    // If not volumetric, we don't need the rest
    if (!volumetric) {
      return [virtualCam, spotLight, targetMesh]
    }

    const renderTarget = new WebGLRenderTarget(
      size.width / 2,
      size.height / 2,
      {
        format: RGBAFormat,
      },
    )
    const renderTargetBlur = new WebGLRenderTarget(
      size.width / 2,
      size.height / 2,
      {
        format: RGBAFormat,
      },
    )

    // Blur pass
    const blurPass = new ShaderMaterial({
      uniforms: {
        tMap: { value: null },
        uResolution: { value: new Vector3() },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tMap;
        uniform vec3 uResolution;
        varying vec2 vUv;
        #include <common>

        void main() {
          vec4 color = texture2D(tMap, vUv);
          gl_FragColor = color;
        }
      `,
    })

    // Quad for rendering to screen
    const quad = new FullScreenQuad(null)

    return [
      virtualCam,
      spotLight,
      targetMesh,
      renderTarget,
      renderTargetBlur,
      blurPass,
      quad,
    ]
  }, [
    camera,
    color,
    intensity,
    distance,
    angle,
    penumbra,
    decay,
    shadow,
    volumetric,
    position,
    size.width,
    size.height,
  ])

  // Update spotlight and references
  React.useEffect(() => {
    lightRef.current = spotLight
    virtualCamRef.current = virtualCam

    const group = groupRef.current
    if (group) {
      group.add(spotLight, targetMesh)

      return () => {
        group.remove(spotLight, targetMesh)
      }
    }
  }, [spotLight, targetMesh, virtualCam])

  // Handle resizing
  React.useEffect(() => {
    if (volumetric && renderTarget && renderTargetBlur) {
      renderTarget.setSize(size.width / 2, size.height / 2)
      renderTargetBlur.setSize(size.width / 2, size.height / 2)
      blurPass.uniforms.uResolution.value.set(size.width, size.height, 1)
    }
  }, [blurPass, renderTarget, renderTargetBlur, size, volumetric])

  // Setup animation loop
  useFrame((state) => {
    const group = groupRef.current
    const light = lightRef.current

    if (group && light) {
      // Update light target
      light.target.position.set(0, 0, -1).applyMatrix4(group.matrixWorld)

      // If volumetric, handle volumetric rendering
      if (volumetric && quad && renderTarget && renderTargetBlur) {
        const { gl, scene } = state

        // Setup virtual camera to match the spotlight
        virtualCam.position.copy(light.position)
        virtualCam.lookAt(light.target.position)
        virtualCam.updateMatrixWorld()

        // Render the scene from spotlight's perspective
        const initialBackground = scene.background
        scene.background = null

        // Store current GL state
        const initialClearAlpha = gl.getClearAlpha()
        const initialRenderTarget = gl.getRenderTarget()

        // Render light view to target
        gl.setRenderTarget(renderTarget)
        gl.setClearAlpha(0)
        gl.clear()
        gl.render(scene, virtualCam)

        // Apply blur if needed
        blurPass.uniforms.tMap.value = renderTarget.texture
        quad.material = blurPass

        gl.setRenderTarget(renderTargetBlur)
        gl.clear()
        quad.render(gl)

        // Restore state
        gl.setRenderTarget(initialRenderTarget)
        gl.setClearAlpha(initialClearAlpha)
        scene.background = initialBackground
      }
    }
  })

  return (
    <group ref={groupRef} {...props}>
      {debug && spotLight && spotLight.shadow && spotLight.shadow.camera && (
        <primitive object={spotLight.shadow.camera} />
      )}
      {children}
    </group>
  )
}

CustomSpotLight.propTypes = {
  children: PropTypes.node,
  color: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  intensity: PropTypes.number,
  angle: PropTypes.number,
  penumbra: PropTypes.number,
  decay: PropTypes.number,
  distance: PropTypes.number,
  shadow: PropTypes.bool,
  volumetric: PropTypes.bool,
  debug: PropTypes.bool,
  position: PropTypes.arrayOf(PropTypes.number),
}
