// Re-export from TypeScript implementation for compatibility
// This ensures the .js file exports what other files expect
// Note: The build system will resolve this to index.ts
// Types are exported from index.ts and don't need to be re-exported from .js
export {
  createMentalLLaMAFromEnv,
  createMentalLLaMAFactory,
  createMentalLLaMAFactoryFromEnv,
  MentalLLaMAAdapter,
  MentalLLaMAModelProvider,
  MentalHealthTaskRouter,
  createMentalLLaMAPythonBridge,
} from './index'
