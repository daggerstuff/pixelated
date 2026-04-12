import { createHash } from 'crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiKeyService } from '../api-key-service';
import { query } from '../../db';

vi.mock('../../db', () => ({
  query: vi.fn(),
}));

describe('APIKeyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new API key and store its hash', async () => {
    const userId = 'user_123';
    const scopes = ['api:read'];
    const key = await apiKeyService.createAPIKey(userId, scopes);
    
    expect(key).toBeDefined();
    expect(key.length).toBe(64); // 32 bytes hex
    
    const expectedHash = createHash('sha256').update(key).digest('hex');
    
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO api_keys'),
      expect.arrayContaining([userId, expectedHash, JSON.stringify(scopes)])
    );
  });

  it('should validate a valid API key', async () => {
    const userId = 'user_123';
    const key = 'valid_key_example';
    const hash = createHash('sha256').update(key).digest('hex');
    
    (query as any).mockResolvedValueOnce({
      rows: [{ user_id: userId, scopes: ['api:read'] }],
    });

    const result = await apiKeyService.validateAPIKey(key);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe(userId);
    expect(result.scopes).toEqual(['api:read']);
    
    // Should update last_used
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE api_keys SET last_used'),
      [hash]
    );
  });

  it('should reject an invalid API key', async () => {
    (query as any).mockResolvedValueOnce({ rows: [] });
    
    const result = await apiKeyService.validateAPIKey('invalid_key');
    expect(result.valid).toBe(false);
    expect(result.userId).toBeUndefined();
  });

  it('should handle database errors gracefully', async () => {
    (query as any).mockRejectedValueOnce(new Error('DB Error'));
    
    const result = await apiKeyService.validateAPIKey('some_key');
    expect(result.valid).toBe(false);
  });

  it('should fetch user by id', async () => {
    const userId = 'user_123';
    const mockUser = { id: userId, email: 'test@example.com' };
    
    (query as any).mockResolvedValueOnce({
      rows: [mockUser],
    });

    const result = await apiKeyService.getUserById(userId);
    expect(result).toEqual(mockUser);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM users'),
      [userId]
    );
  });
});
