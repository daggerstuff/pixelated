import { vi } from 'vitest';

/**
 * Global test setup for Vitest
 * This file is loaded before all tests and initializes the test environment
 */

// Set core environment variables
process.env.PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-characters-long';

// Global fetch mock
if (!global.fetch) {
  global.fetch = vi.fn();
}

// Global TextEncoder/TextDecoder polyfills if needed (for Node.js environments)
import { TextEncoder, TextDecoder } from 'node:util';
if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

// Mock other global APIs that might be missing in jsdom/node
if (typeof window !== 'undefined') {
  // Add any browser-specific global mocks here
}
