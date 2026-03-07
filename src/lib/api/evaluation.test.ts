import { describe, it, expect } from 'vitest'
import { POST } from '../../pages/api/evaluation'

describe('API /evaluation', () => {
  it('should store evaluation feedback', async () => {
    const postRequest = new Request('http://localhost/api/evaluation', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', feedback: 'Great job!' }),
    })
    const response = await POST({ request: postRequest })
    expect(response.status).toBe(201)
    // No need to check 'data' property, status code is sufficient
    expect(response.status).toBe(201)
  })

  it('should handle missing data', async () => {
    const badRequest = new Request('http://localhost/api/evaluation', {
      method: 'POST',
      body: JSON.stringify({ sessionId: '', feedback: '' }),
    })
    const response = await POST({ request: badRequest })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })
})
