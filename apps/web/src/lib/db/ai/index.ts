// Export the types

// Export a singleton instance of the repository
import { AIRepository } from './repository.js'

export * from './initialize.js' // Export the initialization function
export * from './repository.js' // Export the repository
export * from './schema.js' // Export the schema definitions
export * from './types.js'

export const aiRepository = new AIRepository()
