import { redis } from '@/lib/redis'

import { oAuthConnectionSchema, type IntegrationProvider, type OAuthConnection } from './types'

const OAUTH_CREDENTIAL_TTL_SECONDS = 90 * 24 * 60 * 60
const keyPrefix = 'oauth:connection'

function buildKey(tenantId: string, provider: IntegrationProvider): string {
  return `${keyPrefix}:${tenantId}:${provider}`
}

export const oauthCredentials = {
  async store(connection: OAuthConnection): Promise<void> {
    const validated = oAuthConnectionSchema.parse(connection)
    const key = buildKey(validated.tenantId, validated.provider)
    await redis.setex(key, OAUTH_CREDENTIAL_TTL_SECONDS, JSON.stringify(validated))
  },

  async get(tenantId: string, provider: IntegrationProvider): Promise<OAuthConnection | null> {
    const key = buildKey(tenantId, provider)
    const raw = await redis.get(key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as unknown
      return oAuthConnectionSchema.parse(parsed)
    } catch {
      return null
    }
  },

  async delete(tenantId: string, provider: IntegrationProvider): Promise<void> {
    const key = buildKey(tenantId, provider)
    await redis.del(key)
  },

  async updateTokens(
    tenantId: string,
    provider: IntegrationProvider,
    tokens: {
      accessToken: string
      refreshToken?: string
      expiresAt?: string
    },
  ): Promise<void> {
    const existing = await this.get(tenantId, provider)
    if (!existing) return
    const updated: OAuthConnection = {
      ...existing,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? existing.refreshToken,
      expiresAt: tokens.expiresAt ?? existing.expiresAt,
      lastRefreshedAt: new Date().toISOString(),
    }
    const key = buildKey(tenantId, provider)
    await redis.setex(key, OAUTH_CREDENTIAL_TTL_SECONDS, JSON.stringify(updated))
  },
}
