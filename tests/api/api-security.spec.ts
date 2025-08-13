import { test, expect } from '@playwright/test';
import { APITestUtils } from './utils/APITestUtils';

/**
 * API Security Tests
 * Comprehensive security testing for API endpoints
 */

test.describe('API Security Tests', () => {
  let apiUtils: APITestUtils;

  test.beforeAll(async () => {
    apiUtils = new APITestUtils();
    await apiUtils.setupTestEnvironment();
  });

  test.afterAll(async () => {
    await apiUtils.cleanupTestEnvironment();
  });

  test.describe('Input Validation Security', () => {
    test('should prevent SQL injection in login', async ({ request }) => {
      const sqlPayloads = [
        "admin'; DROP TABLE users; --",
        "' OR '1'='1' --",
        "admin'/**/OR/**/1=1--"
      ];

      for (const payload of sqlPayloads) {
        const response = await request.post('/api/auth/login', {
          data: {
            email: payload,
            password: 'password'
          }
        });

        // Should return validation error, not execute SQL
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Invalid');
      }
    });

    test('should sanitize XSS attempts in messages', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const conversationId = await apiUtils.createTestConversation();
      
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await request.post('/api/chat/messages', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          data: {
            conversationId,
            content: payload,
            type: 'text'
          }
        });

        expect(response.status()).toBe(201);
        const data = await response.json();
        
        // Content should be sanitized
        expect(data.content).not.toContain('<script>');
        expect(data.content).not.toContain('javascript:');
        expect(data.content).not.toContain('onerror=');
      }
    });
  });

  test.describe('Authentication Security', () => {
    test('should reject requests with invalid JWT tokens', async ({ request }) => {
      const invalidTokens = [
        'invalid.jwt.token',
        'Bearer invalid',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        ''
      ];

      for (const token of invalidTokens) {
        const response = await request.get('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        expect(response.status()).toBe(401);
      }
    });

    test('should enforce token expiration', async ({ request }) => {
      // This would require a way to generate expired tokens
      // In a real implementation, you'd have a test endpoint or mock
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      
      const response = await request.get('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('expired');
    });
  });

  test.describe('File Upload Security', () => {
    test('should reject malicious file types', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const maliciousFiles = [
        { name: 'malicious.exe', content: 'MZ\x90\x00\x03', mimeType: 'application/x-executable' },
        { name: 'script.php', content: '<?php echo "malicious"; ?>', mimeType: 'application/x-php' },
        { name: 'virus.bat', content: '@echo off\necho malicious', mimeType: 'application/x-bat' }
      ];

      for (const file of maliciousFiles) {
        const response = await request.post('/api/files/upload', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          multipart: {
            file: {
              name: file.name,
              mimeType: file.mimeType,
              buffer: Buffer.from(file.content)
            }
          }
        });

        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Invalid file type');
      }
    });

    test('should enforce file size limits', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      
      // Create a large file (simulate 100MB)
      const largeContent = 'A'.repeat(100 * 1024 * 1024);
      
      const response = await request.post('/api/files/upload', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        multipart: {
          file: {
            name: 'large_file.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from(largeContent)
          }
        }
      });

      expect(response.status()).toBe(413); // Payload Too Large
      const data = await response.json();
      expect(data.error).toContain('File too large');
    });
  });

  test.describe('Rate Limiting Security', () => {
    test('should enforce rate limits on sensitive endpoints', async ({ request }) => {
      const sensitiveEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/user/profile'
      ];

      for (const endpoint of sensitiveEndpoints) {
        // Make rapid requests to trigger rate limiting
        const promises = Array.from({ length: 50 }, () =>
          request.post(endpoint, {
            data: { email: 'test@example.com', password: 'password' }
          })
        );

        const responses = await Promise.all(promises);
        const rateLimitedResponses = responses.filter(r => r.status() === 429);
        
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Data Privacy Security', () => {
    test('should not expose sensitive data in error messages', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        }
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      
      // Should not reveal whether email exists or not
      expect(data.error).not.toContain('email not found');
      expect(data.error).not.toContain('user does not exist');
      expect(data.error).toBe('Invalid credentials');
    });

    test('should not expose internal system information', async ({ request }) => {
      const response = await request.get('/api/non-existent-endpoint');
      
      expect(response.status()).toBe(404);
      const data = await response.json();
      
      // Should not expose stack traces or internal paths
      expect(data.error).not.toContain('/home/');
      expect(data.error).not.toContain('node_modules');
      expect(data.error).not.toContain('Error:');
    });
  });
});