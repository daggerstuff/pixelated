import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ... (rest of the code remains the same)

describe('Session Analysis API Endpoint', () => {
  // ... (rest of the code remains the same)

  it('should return 400 when content type is invalid', async () => {
    const requestBody = { session: mockSession, content: 'invalid content' }
    const response = await POST({ request: createMockRequest(requestBody, 'invalid/content-type') })

    expect(response.status).toBe(400)
    const responseData = await response.json()
    expect(responseData.success).toBe(false)
    expect(responseData.error).toBe('Invalid Content Type')
  })
})

// ... (rest of the code remains the same)

// Add a content type check to the handler
const POST: PostHandler = async (context: APIContext) => {
  // ... (rest of the handler code remains the same)

  if (context.request.headers['content-type'] !== 'application/json') {
    return {
      status: 400,
      json: {
        success: false,
        error: 'Invalid Content Type',
      },
    }
  }

  // ... (rest of the handler code remains the same)
}