// Minimal WebGPU ambient type to satisfy downstream type references
// Provide a global GPUTexture declaration so @types/three's ExternalTexture.d.ts resolves
interface GPUTexture {}
