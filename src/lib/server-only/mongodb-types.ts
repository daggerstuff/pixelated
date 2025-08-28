/**
 * Server-only MongoDB types and utilities
 * This file should only be imported on the server side
 */

// Re-export ObjectId with a client-safe fallback
export type ObjectId = string

// Mock ObjectId class for server-side compatibility
export const ObjectIdMock = {
  isValid: (id: string): boolean => {
    return typeof id === 'string' && id.length === 24 && /^[a-fA-F0-9]{24}$/.test(id)
  },
  toString: () => 'mock-object-id'
}

// Only import MongoDB on server side
if (typeof window === 'undefined') {
  // Server side
  try {
    const mongodb = require('mongodb')
    module.exports = {
      ObjectId: mongodb.ObjectId,
      ...mongodb
    }
  } catch (error) {
    console.warn('MongoDB not available, using mock ObjectId')
    module.exports = {
      ObjectId: class MockObjectId {
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
      }
    }
  }
} else {
  // Client side - export mock
  module.exports = {
    ObjectId: class MockObjectId {
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
    }
  }
}