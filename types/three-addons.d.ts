// Minimal type placeholders for Three.js modules used in the project.
// These are intentionally loose to silence "could not find declaration file" errors.

declare module 'three' {
  const THREE: any
  export = THREE
}

declare module 'three/build/three.module.js' {
  import * as THREE from 'three';
  export = THREE;
}

declare module 'three/addons/controls/OrbitControls.js' {
  const OrbitControls: any
  export { OrbitControls }
  export default OrbitControls
}

declare module 'three/examples/jsm/controls/OrbitControls.js' {
  const OrbitControls: any
  export { OrbitControls }
  export default OrbitControls
}

declare module 'three/*' {
  const whatever: any
  export = whatever
}
