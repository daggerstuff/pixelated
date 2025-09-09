/* Minimal type declarations for three and OrbitControls used in the project.
   This file provides narrow, project-specific types to satisfy TypeScript
   where the @types/three package is not used or the shipped types are missing.
   If you prefer full typings, install `@types/three` or update to a three build
   that includes types.
*/

declare module 'three' {
  // Minimal placeholder for Three.js runtime for TypeScript.
  // This keeps typing loose but removes the "cannot find declaration file" errors.
  const THREE: any
  export = THREE
}

declare module 'three/addons/controls/OrbitControls.js' {
  const OrbitControls: any
  export { OrbitControls }
  export default OrbitControls
}
