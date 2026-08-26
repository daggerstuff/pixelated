/// <reference types="vitest/node" />
/** @vitest-environment node */

import { describe, it, expect } from 'vitest'

import { POST } from '../pages/api/auth/register/route'

const parseErrorResponse = async (
  response: Response,
): Promise<{ error: unknown }> => {
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object') {
    return { error: null }
  }

  return {
    error: Reflect.get(value, 'error'),
  }
}

const buildRequest = (body: Record<string, unknown>) =>
  new Request('https://example.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/auth/register', () => {
  it('should reject a request missing the email field', async () => {
    const response = await POST({
      request: buildRequest({
        fullName: 'Test User',
        password: 'secret123',
        termsAccepted: true,
      }),
    })

    expect(response.status).toBe(400)
    const data = await parseErrorResponse(response)
    expect(data.error).toBeTruthy()
  })

  it('should reject a weak password', async () => {
    const response = await POST({
      request: buildRequest({
        fullName: 'Test User',
        email: 'test@example.com',
        password: '123',
        termsAccepted: true,
      }),
    })
    expect(response.status).toBe(400)
    const data = await parseErrorResponse(response)
    expect(data.error).toBeTruthy()
  })
})
