/**
 * Global Vitest setup file
 * This file is required by the test configuration to initialize mocks
 */

import { vi } from 'vitest';

// Global fetch mock
global.fetch = vi.fn();

// Mock process.env for tests
process.env.PUBLIC_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Add any other global mocks or initializations needed for tests
