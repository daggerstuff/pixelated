import type { EHRProvider } from '../types'

interface OAuth2Token {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

interface TokenStore {
  [providerId: string]: {
    token: OAuth2Token
    expiresAt: number
  }
}

export class OAuth2Service {
  private tokenStore: TokenStore = {}
  private readonly EXPIRY_BUFFER = 300 // 5 minutes buffer before token expiry

  constructor(private readonly logger: Console = console) {}

  async getAccessToken(provider: EHRProvider): Promise<string> {
    const storedToken = this.tokenStore[provider.id]

    if (storedToken && this.isTokenValid(storedToken)) {
      return storedToken.token.access_token
    }

    if (storedToken?.token.refresh_token) {
      try {
        const newToken = await this.refreshToken(
          provider,
          storedToken.token.refresh_token,
        )
        return newToken.access_token
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to refresh token for provider ${provider.id}:`,
          error,
        )
        // Fall through to request new token
      }
    }

    const newToken = await this.requestNewToken(provider)
    return newToken.access_token
  }

  private async requestNewToken(provider: EHRProvider): Promise<string> {
    const tokenEndpoint = `${provider.baseUrl}/oauth2/token`
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      scope: provider.scopes.join(' '),
    })

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      })

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`)
      }

      const token: OAuth2Token = await response.json()
      this.storeToken(provider.id, token)
      return token.access_token
    } catch (error: unknown) {
      this.logger.error(
        `Failed to request token for provider ${provider.id}:`,
        error,
      )
      throw error
    }
  }

  private async refreshToken(
    provider: EHRProvider,
    refreshToken: string,
  ): Promise<OAuth2Token> {
    const tokenEndpoint = `${provider.baseUrl}/oauth2/token`
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
    })

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`)
    }

    const token: OAuth2Token = await response.json()
    this.storeToken(provider.id, token)
    return token
  }

  private storeToken(providerId: string, token: OAuth2Token): void {
    this.tokenStore[providerId] = {
      token,
      expiresAt: Date.now() + token.expires_in * 1000,
    }
  }

  private isTokenValid(storedToken: {
    token: OAuth2Token
    expiresAt: number
  }): boolean {
    return storedToken.expiresAt > Date.now() + this.EXPIRY_BUFFER * 1000
  }
}
