/**
 * Simple Mock Server Setup for Testing
 * This file provides basic mocking functionality for tests
 */

export const server = {
  listen: () => {
    console.log('Mock server listen (fallback)')
  },
  close: () => {
    console.log('Mock server close (fallback)')
  },
  use: () => {
    console.log('Mock server use (fallback)')
  },
  resetHandlers: () => {
    console.log('Mock server resetHandlers (fallback)')
  },
}

// Simple handlers export
export const handlers: unknown[] = []
