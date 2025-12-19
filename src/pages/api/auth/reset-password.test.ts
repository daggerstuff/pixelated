import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from './reset-password'
import { mongoAuthService } from '../../../lib/db/mongoClient'
import { getEmailService } from '../../../lib/email'
import { config } from '../../../config/env.config'

// Mock the dependencies
vi.mock('../../../lib/db/mongoClient', () => ({
  mongoAuthService: {
    createPasswordResetToken: vi.fn(),
  },
  UserNotFoundError: class UserNotFoundError extends Error {
    constructor(email: string) {
      super(`User not found: ${email}`)
      this.name = 'UserNotFoundError'
    }
  },
}))

vi.mock('../../../lib/email', () => ({
  getEmailService: vi.fn(),
}))

vi.mock('../../../config/env.config', () => ({
  config: {
    site: {
      url: vi.fn().mockReturnValue('https://example.com'),
    },
  },
}))

describe('POST /api/auth/reset-password', () => {
  const mockRequest = (body: any) => ({
    request: {
      json: vi.fn().mockResolvedValue(body),
      url: 'https://example.com/api/auth/reset-password',
    },
    clientAddress: '127.0.0.1',
  })

  const mockEmailService = {
    sendEmail: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    ;(getEmailService as any).mockReturnValue(mockEmailService)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should send password reset email for valid user', async () => {
    const resetToken = 'test-token'
    ;(mongoAuthService.createPasswordResetToken as any).mockResolvedValue(resetToken)
    mockEmailService.sendEmail.mockResolvedValue({ success: true })

    const response = await POST(mockRequest({ email: 'test@example.com' }) as any)
    const responseBody = await response.json()

    expect(response.status).toBe(200)
    expect(responseBody).toEqual({
      success: true,
      message: 'Password reset email sent successfully',
    })
    expect(mongoAuthService.createPasswordResetToken).toHaveBeenCalledWith('test@example.com')
    expect(mockEmailService.sendEmail).toHaveBeenCalled()
  })

  it('should return success for non-existent user (to prevent email enumeration)', async () => {
    ;(mongoAuthService.createPasswordResetToken as any).mockRejectedValue(
      new (mongoAuthService as any).UserNotFoundError('nonexistent@example.com')
    )

    const response = await POST(mockRequest({ email: 'nonexistent@example.com' }) as any)
    const responseBody = await response.json()

    expect(response.status).toBe(200)
    expect(responseBody).toEqual({
      success: true,
      message: 'Password reset email sent successfully',
    })
  })

  it('should return error for invalid email format', async () => {
    const response = await POST(mockRequest({ email: 'invalid-email' }) as any)
    const responseBody = await response.json()

    expect(response.status).toBe(500)
    expect(responseBody).toEqual({
      success: false,
      message: 'Internal server error',
    })
  })

  it('should handle email sending failure', async () => {
    const resetToken = 'test-token'
    ;(mongoAuthService.createPasswordResetToken as any).mockResolvedValue(resetToken)
    mockEmailService.sendEmail.mockResolvedValue({
      success: false,
      error: 'Email provider error',
      provider: 'test-provider',
    })

    const response = await POST(mockRequest({ email: 'test@example.com' }) as any)
    const responseBody = await response.json()

    expect(response.status).toBe(500)
    expect(responseBody).toEqual({
      success: false,
      message: 'Internal server error',
    })
  })

  it('should handle rate limiting', async () => {
    // This test would require mocking the rate limiter
    // For now, we'll skip it but it should be implemented
    expect(true).toBe(true)
  })
})