/**
 * Server-only MongoDB types and utilities
 * This file should only be imported on the server side
 */

// Re-export ObjectId with a client-safe fallback
/**
 * Server-only MongoDB types and utilities
 * This file should only be imported on the server side
 */

// Re-export ObjectId with a client-safe fallback
export type ObjectId = string

// Mock ObjectId class for server-side compatibility
export const ObjectIdMock = {
  isValid: (id: string): boolean => {
    return (
      typeof id === 'string' && id.length === 24 && /^[a-fA-F0-9]{24}$/.test(id)
    )
  },
  toString: () => 'mock-object-id',
}

// Provide a function to get a server ObjectId if available
export async function getServerMongoExports() {
  if (typeof window !== 'undefined') {
    return {
      ObjectId: class MockObjectId {
        public id: string
        constructor(id?: string) {
          this.id = id || 'mock-object-id'
        }
        toString() {
          return this.id
        }
        toHexString() {
          return this.id
        }
        static isValid(id: string) {
          return ObjectIdMock.isValid(id)
        }
      },
    }
  }

  try {
    return await import('mongodb')
  } catch (err) {
    console.warn('MongoDB not available, using mock ObjectId')
    return {
      ObjectId: class MockObjectId {
        public id: string
        constructor(id?: string) {
          this.id = id || 'mock-object-id'
        }
        toString() {
          return this.id
        }
        toHexString() {
          return this.id
        }
        static isValid(id: string) {
          return ObjectIdMock.isValid(id)
        }
      },
    }
  }
}
