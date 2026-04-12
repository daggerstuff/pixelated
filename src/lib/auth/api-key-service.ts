import { createHash, randomBytes } from 'crypto';
import { query } from '../db';

export interface APIKeyRecord {
  id: string;
  user_id: string;
  key_hash: string;
  scopes: string[];
  created_at: Date;
  expires_at?: Date;
  last_used?: Date;
}

export class APIKeyService {
  async validateAPIKey(key: string): Promise<{ valid: boolean; userId?: string; scopes?: string[] }> {
    const hash = createHash('sha256').update(key).digest('hex');
    
    try {
      const result = await query<APIKeyRecord>(
        'SELECT user_id, scopes FROM api_keys WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())',
        [hash]
      );
      
      if (result.rows.length === 0) {
        return { valid: false };
      }
      
      const record = result.rows[0];
      
      // Parse scopes from JSON string
      let scopes: string[] = [];
      try {
        scopes = JSON.parse(record.scopes || '[]');
      } catch (error) {
        console.error('Error parsing scopes JSON:', error);
        scopes = [];
      }
      
      // Update last_used
      await query('UPDATE api_keys SET last_used = NOW() WHERE key_hash = $1', [hash]);
      
      return { valid: true, userId: record.user_id, scopes };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { valid: false };
    }
  }
  
  async createAPIKey(userId: string, scopes: string[] = ['read']): Promise<string> {
    try {
      const key = randomBytes(32).toString('hex');
      const hash = createHash('sha256').update(key).digest('hex');
      
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      
      await query(
        'INSERT INTO api_keys (user_id, key_hash, scopes, created_at, expires_at) VALUES ($1, $2, $3, NOW(), $4)',
        [userId, hash, JSON.stringify(scopes), expiresAt]
      );
      
      return key;
    } catch (error) {
      console.error('Error creating API key:', error);
      throw new Error('Failed to create API key');
    }
  }
  
  async getUserById(id: string): Promise<any> {
    try {
      const result = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }
}

export const apiKeyService = new APIKeyService();