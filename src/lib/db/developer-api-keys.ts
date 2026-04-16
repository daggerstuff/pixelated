import { query } from "./index";
import { randomBytes, createHash } from "crypto";

export interface DeveloperApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  is_active: boolean;
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateApiKeyInput {
  user_id: string;
  name: string;
  scopes?: string[];
  rate_limit?: number;
  expires_in_days?: number;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  api_key?: DeveloperApiKey;
  error?: string;
}

const DEFAULT_SCOPES = ["read", "write"];
const DEFAULT_RATE_LIMIT = 1000;

export class DeveloperApiKeyManager {
  async createApiKey(
    input: CreateApiKeyInput,
  ): Promise<{ api_key: DeveloperApiKey; plain_key: string }> {
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);
    const scopes = input.scopes || DEFAULT_SCOPES;
    const rateLimit = input.rate_limit || DEFAULT_RATE_LIMIT;
    const expiresAt = input.expires_in_days
      ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000)
      : null;

    const result = await query<{
      id: string;
      user_id: string;
      key_hash: string;
      key_prefix: string;
      name: string;
      scopes: string[];
      rate_limit: number;
      is_active: boolean;
      last_used_at: Date | null;
      expires_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO developer_api_keys (
        user_id, key_hash, key_prefix, name, scopes, rate_limit, is_active, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING id, user_id, key_hash, key_prefix, name, scopes, rate_limit, is_active, last_used_at, expires_at, created_at, updated_at`,
      [input.user_id, keyHash, keyPrefix, input.name, scopes, rateLimit, expiresAt],
    );

    const apiKey = result.rows[0];
    return {
      api_key: {
        ...apiKey,
        key_hash: "", // Don't return the hash
      },
      plain_key: rawKey,
    };
  }

  async validateApiKey(rawKey: string): Promise<ApiKeyValidationResult> {
    if (!rawKey) {
      return { valid: false, error: "API key is required" };
    }

    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const result = await query<DeveloperApiKey>(
      `SELECT id, user_id, key_hash, key_prefix, name, scopes, rate_limit, is_active, last_used_at, expires_at, created_at, updated_at
       FROM developer_api_keys
       WHERE key_prefix = $1 AND key_hash = $2 AND is_active = true`,
      [keyPrefix, keyHash],
    );

    const apiKey = result.rows[0];

    if (!apiKey) {
      return { valid: false, error: "Invalid API key" };
    }

    if (apiKey.expires_at && new Date() > apiKey.expires_at) {
      return { valid: false, error: "API key has expired" };
    }

    await query(`UPDATE developer_api_keys SET last_used_at = NOW() WHERE id = $1`, [apiKey.id]);

    return { valid: true, api_key: apiKey };
  }

  async revokeApiKey(apiKeyId: string, userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE developer_api_keys SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [apiKeyId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listApiKeys(userId: string): Promise<Omit<DeveloperApiKey, "key_hash">[]> {
    const result = await query<Omit<DeveloperApiKey, "key_hash">>(
      `SELECT id, user_id, key_prefix, name, scopes, rate_limit, is_active, last_used_at, expires_at, created_at, updated_at
       FROM developer_api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async getApiKeyById(
    apiKeyId: string,
    userId: string,
  ): Promise<Omit<DeveloperApiKey, "key_hash"> | null> {
    const result = await query<Omit<DeveloperApiKey, "key_hash">>(
      `SELECT id, user_id, key_prefix, name, scopes, rate_limit, is_active, last_used_at, expires_at, created_at, updated_at
       FROM developer_api_keys
       WHERE id = $1 AND user_id = $2`,
      [apiKeyId, userId],
    );
    return result.rows[0] || null;
  }

  async updateApiKeyScopes(apiKeyId: string, userId: string, scopes: string[]): Promise<boolean> {
    const result = await query(
      `UPDATE developer_api_keys SET scopes = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [apiKeyId, userId, scopes],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private generateRawKey(): string {
    const prefix = "dev_";
    const randomPart = randomBytes(32).toString("base64url");
    return `${prefix}${randomPart}`;
  }

  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }
}

export const developerApiKeyManager = new DeveloperApiKeyManager();

export async function initializeDeveloperApiKeysTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS developer_api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash VARCHAR(64) NOT NULL UNIQUE,
      key_prefix VARCHAR(8) NOT NULL,
      name VARCHAR(255) NOT NULL,
      scopes TEXT[] NOT NULL DEFAULT '{"read", "write"}',
      rate_limit INTEGER NOT NULL DEFAULT 1000,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_used_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_developer_api_keys_user_id ON developer_api_keys(user_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_developer_api_keys_key_prefix ON developer_api_keys(key_prefix)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_developer_api_keys_is_active ON developer_api_keys(is_active)
  `);
}
