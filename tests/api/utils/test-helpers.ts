// Test utilities for API integration tests
import request from 'supertest'
import type { Express } from 'express'

interface TestUser {
  email: string
  password: string
  name: string
}

interface CreateTestUserResult {
  token: string
  userId: string
}

/**
 * Create a test user for API testing
 * Note: Since we use OAuth (Auth0), this creates a mock authenticated session
 * rather than actually registering a user
 */
export async function createTestUserForTest(
  app: Express,
  userData?: Partial<TestUser>,
): Promise<CreateTestUserResult> {
  const defaultUser: TestUser = {
    email: `test-${Date.now()}@test.com`,
    password: 'TestPassword123!',
    name: 'Test User',
  }
  const user = { ...defaultUser, ...userData }
  
  // For OAuth-based auth, we simulate an authenticated session
  // by generating a mock token. In real tests, you'd use actual OAuth tokens.
  const mockToken = `mock-token-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const mockUserId = `user-${Date.now()}`
  
  return { 
    token: mockToken,
    userId: mockUserId,
  }
}

/**
 * Cleanup test data after tests
 * Note: This is a no-op for now as we don't have a real database in tests
 */
export async function cleanupTestData(userId: string): Promise<void> {
  // In a real test environment with a database, you would delete the user here
  // For now, this is a no-op since our tests use in-memory data
  console.log(`Cleanup requested for user: ${userId}`)
}

/**
 * Generate unique test identifier
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Mock user object for testing
 */
export function createMockUser(overrides?: Partial<any>): any {
  return {
    id: `user-${Date.now()}`,
    email: `user-${Date.now()}@test.com`,
    name: 'Test User',
    role: 'viewer',
    ...overrides,
  }
}

/**
 * Create mock Express request
 */
export function createMockRequest(overrides?: Partial<Request>): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    user: null as any,
    ...overrides,
  } as Request
}

/**
 * Create mock Express response
 */
export function createMockResponse(): Response & { _json: any; _status: number } {
  const res = {
    _status: 200,
    _json: null,
    status(code: number) {
      this._status = code
      return this
    },
    json(data: any) {
      this._json = data
      return this
    },
    send(data: any) {
      this._json = data
      return this
    },
  } as any
  return res
}
