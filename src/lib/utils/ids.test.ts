import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateUUID, generateId, generatePrefixedId, generateTimestampId } from './ids';

describe('ids', () => {
  describe('generateUUID', () => {
    it('generates a valid UUID string', () => {
      const uuid = generateUUID();
      expect(typeof uuid).toBe('string');
      // UUID format check (simplified)
      expect(uuid.length).toBe(36);
      expect(uuid.split('-').length).toBe(5);
    });

    it('uses crypto.randomUUID', () => {
      const mockRandomUUID = vi.fn().mockReturnValue('12345678-1234-4234-8234-1234567890ab');
      const originalCrypto = global.crypto;

      // Setup mock
      Object.defineProperty(global, 'crypto', {
        value: { randomUUID: mockRandomUUID },
        writable: true
      });

      const uuid = generateUUID();

      expect(mockRandomUUID).toHaveBeenCalled();
      expect(uuid).toBe('12345678-1234-4234-8234-1234567890ab');

      // Restore
      Object.defineProperty(global, 'crypto', {
        value: originalCrypto,
        writable: true
      });
    });
  });

  describe('generateId', () => {
    it('generates an ID of default length 16', () => {
      expect(generateId().length).toBe(16);
    });
    it('generates an ID of custom length', () => {
      expect(generateId(8).length).toBe(8);
    });
  });

  describe('generatePrefixedId', () => {
    it('generates an ID with the prefix', () => {
      const id = generatePrefixedId('test');
      expect(id.startsWith('test-')).toBe(true);
      expect(id.length).toBeGreaterThan(5);
    });
  });

  describe('generateTimestampId', () => {
    it('generates a timestamp-based ID', () => {
      const id1 = generateTimestampId();
      const id2 = generateTimestampId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
    });
  });
});
