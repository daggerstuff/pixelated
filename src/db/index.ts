// Re-export MongoDB client from its actual location
// This file exists to support the @/db import alias used throughout the codebase

export { mongoClient as client } from '../lib/db/mongoClient'
export * from '../lib/db/mongoClient'
