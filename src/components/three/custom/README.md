# Custom Three.js Components

This directory contains custom implementations of components from popular libraries like @react-three/drei that have been replaced to fix compatibility issues.

## CustomSpotLight

A custom implementation of the SpotLight component from @react-three/drei that fixes issues with duplicate imports of `FullScreenQuad` from three-stdlib.

### Usage

Instead of importing SpotLight from drei:

```jsx
// DON'T DO THIS - it will cause build errors
import { SpotLight } from '@react-three/drei';
```

Import our custom component:

```jsx
import { CustomSpotLight } from '../components/three/custom';

// Then use it just like the original SpotLight
function Scene() {
  return (
    <Canvas>
      <CustomSpotLight
        position={[10, 10, 10]}
        intensity={1.5}
        angle={0.6}
        penumbra={0.5}
        color="white"
        castShadow
      />
      <mesh>
        {/* Your other scene elements */}
      </mesh>
    </Canvas>
  );
}
```

### Props

The CustomSpotLight component supports all the same props as the original SpotLight:

- `position`: [x, y, z] array for light position
- `color`: Light color (default: 'white')
- `intensity`: Light intensity (default: 1)
- `angle`: Light cone angle in radians (default: 0.15)
- `penumbra`: Percent of the spotlight cone that is attenuated due to penumbra (default: 0)
- `decay`: Light decay (default: 2)
- `distance`: Maximum range of the light (default: 5)
- `shadow`: Boolean to enable shadows
- `volumetric`: Boolean to enable volumetric lighting effect
- `debug`: Boolean to show helper wireframes for debugging

### Why This Exists

The original SpotLight component in @react-three/drei has issues with duplicate imports of `FullScreenQuad` from three-stdlib, which causes build errors in production. This custom implementation resolves those issues while maintaining the same functionality.
