// Declarations for common three.js elements so TSX/JSX can accept them as intrinsic elements.
// Avoid executing runtime code (like extend()) inside a declaration file.

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any
      mesh: any
      meshBasicMaterial: any
      perspectiveCamera: any
      ambientLight: any
      directionalLight: any
    }
  }
}
export {}
