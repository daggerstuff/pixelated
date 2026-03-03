/**
 * Global Vitest setup file
 * Provides necessary global mocks for tests
 */

import { vi } from 'vitest';

// Use built-in fetch if available, otherwise mock it
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn();
}

// Set up environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.DATABASE_URL = 'postgres://localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.AUTH0_DOMAIN = 'test.auth0.com';
process.env.AUTH0_CLIENT_ID = 'test-client-id';
process.env.AUTH0_CLIENT_SECRET = 'test-client-secret';
process.env.AUTH0_AUDIENCE = 'https://api.test.com';

// Mocking some common modules that might not be available in test environment
vi.mock('@/lib/redis', () => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
}));

vi.mock('@/lib/security', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    AUTHENTICATION_SUCCESS: 'AUTHENTICATION_SUCCESS',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    CSRF_VIOLATION: 'CSRF_VIOLATION',
    MFA_REQUIRED: 'MFA_REQUIRED',
    ROLE_ASSIGNED: 'ROLE_ASSIGNED',
    ROLE_REMOVED: 'ROLE_REMOVED',
  },
}));
