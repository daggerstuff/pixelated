// Export the types

// Export a singleton instance of the repository
import { AIRepository } from './repository'

export * from './initialize' // Export the initialization function
export * from './repository' // Export the repository
export * from './schema' // Export the schema definitions
export * from './types'

export const aiRepository = new AIRepository()
