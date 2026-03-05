import { vi } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

// Initialize global mocks
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

// Mock fetch if not available
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn();
}

// Set essential environment variables for tests
process.env.PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-chars-long-!!';
