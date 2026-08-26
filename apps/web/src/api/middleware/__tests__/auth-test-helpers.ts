import type { Request, Response } from 'express'
import { vi } from 'vitest'

export type MockAuthUser = {
  id: string
  email: string
  roles: string[]
  emailVerified: boolean
  permissions?: string[]
}

export type MockAuthRequest = Omit<Request, 'user'> & {
  protocol: string
  originalUrl: string
  method: string
  headers: Record<string, string | undefined>
  get: {
    (name: 'set-cookie'): string[] | undefined
    (name: string): string | undefined
  }
  user?: MockAuthUser
}

export type MockAuthResponse = Pick<Response, 'status' | 'json'>

export function createMockAuthUser(
  overrides: Partial<MockAuthUser> = {},
): MockAuthUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
    emailVerified: false,
    ...overrides,
  }
}

export function createMockAuthRequest(
  overrides: Partial<MockAuthRequest> = {},
): MockAuthRequest {
  const headers: Record<string, string> = {
    host: 'localhost:3000',
    authorization: 'Bearer test-token',
    ...Object.fromEntries(
      Object.entries(overrides.headers ?? {}).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  }

  return {
    protocol: 'http',
    originalUrl: '/api/users',
    method: 'GET',
    headers,
    get: ((header: string) =>
      headers[header.toLowerCase()] ?? undefined) as MockAuthRequest['get'],
    ...overrides,
  } as MockAuthRequest
}

export function createMockAuthResponse(): {
  response: MockAuthResponse
  statusSpy: ReturnType<typeof vi.fn>
  jsonSpy: ReturnType<typeof vi.fn>
} {
  const statusSpy = vi.fn().mockReturnThis()
  const jsonSpy = vi.fn()

  return {
    response: {
      status: statusSpy,
      json: jsonSpy,
    },
    statusSpy,
    jsonSpy,
  }
}
