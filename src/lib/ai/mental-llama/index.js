// Re-export from TypeScript implementation for compatibility
// This ensures the .js file exports what other files expect
// Fixed circular dependency by importing from the actual TypeScript file
export {
  createMentalLLaMAFromEnv,
  createMentalLLaMAFactory,
  createMentalLLaMAFactoryFromEnv,
  MentalLLaMAAdapter,
  MentalLLaMAModelProvider,
  MentalHealthTaskRouter,
  createMentalLLaMAPythonBridge,
} from './index.ts'
