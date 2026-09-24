/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuthCodeGrant = vi.fn()
const mockGetUserInfo = vi.fn()
const mockSecurityLog = vi.fn()

vi.mock('auth0', () => {
  return {
    AuthenticationClient: vi.fn().mockImplementation(function (this: any) {
      this.oauth = {
        authorizationCodeGrant: mockAuthCodeGrant,
        passwordGrant: vi.fn(),
        refreshTokenGrant: vi.fn(),
        revokeRefreshToken: vi.fn(),
      }
    }),
    UserInfoClient: vi.fn().mockImplementation(function (this: any) {
      this.getUserInfo = mockGetUserInfo
    }),
    ManagementClient: vi.fn().mockImplementation(function (this: any) {
      this.users = {
        get: vi.fn().mockResolvedValue({ data: {} }),
      }
    }),
  }
})

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('../../security/index', () => ({
  logSecurityEvent: (...args: unknown[]) => mockSecurityLog(...args),
  SecurityEventType: {
    LOGIN: 'LOGIN',
    AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
    AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  },
}))

describe('Auth0 verifyOAuthCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['AUTH0_DOMAIN'] = 'test-domain.auth0.com'
    process.env['AUTH0_CLIENT_ID'] = 'test-client-id'
    process.env['AUTH0_CLIENT_SECRET'] = 'test-client-secret'
    process.env['AUTH0_CALLBACK_URL'] =
      'http://localhost:4321/api/auth/auth0-callback'
  })

  it('exchanges authorization code and returns authenticated user with tokens', async () => {
    const { verifyOAuthCode } = await import('../auth0.service')

    mockAuthCodeGrant.mockResolvedValueOnce({
      data: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        id_token: 'mock-id-token',
        expires_in: 3600,
      },
    })

    mockGetUserInfo.mockResolvedValueOnce({
      data: {
        sub: 'auth0|12345',
        email: 'clinician@hospital.org',
        name: 'Dr. Jane Doe',
        email_verified: true,
      },
    })

    const result = await verifyOAuthCode('valid-auth-code')

    expect(mockAuthCodeGrant).toHaveBeenCalledWith({
      code: 'valid-auth-code',
      redirect_uri: 'http://localhost:4321/api/auth/auth0-callback',
    })
    expect(mockGetUserInfo).toHaveBeenCalledWith('mock-access-token')
    expect(result.token).toBe('mock-access-token')
    expect(result.refreshToken).toBe('mock-refresh-token')
    expect(result.idToken).toBe('mock-id-token')
    expect(result.expiresIn).toBe(3600)
    expect(result.user.id).toBe('auth0|12345')
    expect(result.user.email).toBe('clinician@hospital.org')
  })

  it('respects a custom redirect_uri when provided', async () => {
    const { verifyOAuthCode } = await import('../auth0.service')

    mockAuthCodeGrant.mockResolvedValueOnce({
      data: {
        access_token: 'mock-token',
        expires_in: 3600,
      },
    })

    mockGetUserInfo.mockResolvedValueOnce({
      data: {
        sub: 'auth0|999',
        email: 'supervisor@clinic.edu',
      },
    })

    await verifyOAuthCode(
      'custom-code',
      'https://app.pixelatedempathy.com/auth/callback',
    )

    expect(mockAuthCodeGrant).toHaveBeenCalledWith({
      code: 'custom-code',
      redirect_uri: 'https://app.pixelatedempathy.com/auth/callback',
    })
  })

  it('throws an error when no access token is returned', async () => {
    const { verifyOAuthCode } = await import('../auth0.service')

    mockAuthCodeGrant.mockResolvedValueOnce({
      data: {},
    })

    await expect(verifyOAuthCode('bad-code')).rejects.toThrow(
      'Invalid authorization code',
    )
  })

  it('throws an error when OAuth exchange fails', async () => {
    const { verifyOAuthCode } = await import('../auth0.service')

    mockAuthCodeGrant.mockRejectedValueOnce(new Error('Invalid grant code'))

    await expect(verifyOAuthCode('expired-code')).rejects.toThrow(
      'Invalid authorization code',
    )
  })
})
