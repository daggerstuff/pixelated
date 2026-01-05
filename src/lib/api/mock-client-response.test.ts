import { describe, it, expect } from 'vitest'
import { POST } from '../../pages/api/mock-client-response'

describe('API /mock-client-response', () => {
  it('should return a mock client response', async () => {
    const postRequest = new Request(
      'http://localhost/api/mock-client-response',
      { method: 'POST', body: JSON.stringify({ message: 'Hello' }) },
    )
    const response = await POST({ request: postRequest })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(typeof data.response).toBe('string')
  })

  it('should handle missing message', async () => {
    const badRequest = new Request(
      'http://localhost/api/mock-client-response',
      { method: 'POST', body: JSON.stringify({ message: '' }) },
    )
    const response = await POST({ request: badRequest })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })
})
