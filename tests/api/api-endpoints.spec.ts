import { test, expect } from '@playwright/test';
import { APITestUtils } from './utils/APITestUtils';

/**
 * API Endpoints Test Suite
 * Comprehensive testing of all API endpoints
 */

test.describe('API Endpoints Test Suite', () => {
  let apiUtils: APITestUtils;

  test.beforeAll(async () => {
    apiUtils = new APITestUtils();
    await apiUtils.setupTestEnvironment();
  });

  test.afterAll(async () => {
    await apiUtils.cleanupTestEnvironment();
  });

  test.describe('Authentication API', () => {
    test('POST /api/auth/login - should authenticate valid user', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: 'validPassword123'
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe('test@example.com');
    });

    test('POST /api/auth/login - should reject invalid credentials', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: 'wrongPassword'
        }
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid credentials');
    });

    test('POST /api/auth/register - should create new user', async ({ request }) => {
      const uniqueEmail = `test${Date.now()}@example.com`;
      const response = await request.post('/api/auth/register', {
        data: {
          email: uniqueEmail,
          password: 'newPassword123',
          name: 'Test User'
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe(uniqueEmail);
    });

    test('POST /api/auth/logout - should invalidate token', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.post('/api/auth/logout', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      
      // Verify token is invalidated
      const protectedResponse = await request.get('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      expect(protectedResponse.status()).toBe(401);
    });
  });

  test.describe('User Management API', () => {
    test('GET /api/user/profile - should return user profile', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.get('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('name');
    });

    test('PUT /api/user/profile - should update user profile', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const updateData = {
        name: 'Updated Name',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const response = await request.put('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: updateData
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.name).toBe(updateData.name);
      expect(data.preferences.theme).toBe(updateData.preferences.theme);
    });

    test('DELETE /api/user/account - should delete user account', async ({ request }) => {
      const token = await apiUtils.createTestUser();
      const response = await request.delete('/api/user/account', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      
      // Verify account is deleted
      const profileResponse = await request.get('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      expect(profileResponse.status()).toBe(401);
    });
  });

  test.describe('Chat API', () => {
    test('GET /api/chat/conversations - should return user conversations', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.get('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.conversations)).toBe(true);
    });

    test('POST /api/chat/conversations - should create new conversation', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.post('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          title: 'Test Conversation',
          type: 'general'
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.title).toBe('Test Conversation');
    });

    test('POST /api/chat/messages - should send message', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const conversationId = await apiUtils.createTestConversation();
      
      const response = await request.post('/api/chat/messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          conversationId,
          content: 'Test message content',
          type: 'text'
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.content).toBe('Test message content');
    });

    test('GET /api/chat/messages/:conversationId - should return conversation messages', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const conversationId = await apiUtils.createTestConversation();
      
      const response = await request.get(`/api/chat/messages/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.messages)).toBe(true);
    });
  });

  test.describe('AI Service API', () => {
    test('POST /api/ai/analyze - should analyze user input', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.post('/api/ai/analyze', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          text: 'I am feeling anxious about my upcoming presentation',
          context: 'emotional_support'
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('analysis');
      expect(data).toHaveProperty('suggestions');
      expect(data).toHaveProperty('confidence');
    });

    test('POST /api/ai/generate-response - should generate AI response', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.post('/api/ai/generate-response', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          prompt: 'Help me manage stress',
          context: 'wellness_coaching',
          parameters: {
            temperature: 0.7,
            max_tokens: 150
          }
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('metadata');
      expect(typeof data.response).toBe('string');
    });

    test('GET /api/ai/models - should return available AI models', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.get('/api/ai/models', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThan(0);
    });
  });

  test.describe('Analytics API', () => {
    test('GET /api/analytics/dashboard - should return dashboard metrics', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.get('/api/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('charts');
      expect(data).toHaveProperty('summary');
    });

    test('POST /api/analytics/events - should track user events', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.post('/api/analytics/events', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          event: 'message_sent',
          properties: {
            conversation_id: 'test_conv_123',
            message_length: 50,
            timestamp: new Date().toISOString()
          }
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  test.describe('File Upload API', () => {
    test('POST /api/files/upload - should upload file', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const testFile = Buffer.from('test file content', 'utf8');
      
      const response = await request.post('/api/files/upload', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        multipart: {
          file: {
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: testFile
          },
          metadata: JSON.stringify({
            description: 'Test file upload',
            category: 'document'
          })
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('fileId');
      expect(data).toHaveProperty('url');
    });

    test('GET /api/files/:fileId - should retrieve file', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const fileId = await apiUtils.uploadTestFile();
      
      const response = await request.get(`/api/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/plain');
    });

    test('DELETE /api/files/:fileId - should delete file', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const fileId = await apiUtils.uploadTestFile();
      
      const response = await request.delete(`/api/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response.status()).toBe(200);
      
      // Verify file is deleted
      const getResponse = await request.get(`/api/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Error Handling', () => {
    test('should return 401 for unauthorized requests', async ({ request }) => {
      const response = await request.get('/api/user/profile');
      expect(response.status()).toBe(401);
    });

    test('should return 404 for non-existent endpoints', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const response = await request.get('/api/non-existent-endpoint', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      expect(response.status()).toBe(404);
    });

    test('should return 400 for invalid request data', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'invalid-email',
          password: ''
        }
      });
      expect(response.status()).toBe(400);
    });

    test('should return 429 for rate limited requests', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array.from({ length: 100 }, () =>
        request.get('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      );
      
      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance Tests', () => {
    test('API response times should be acceptable', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      const startTime = Date.now();
      
      const response = await request.get('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const responseTime = Date.now() - startTime;
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle concurrent requests', async ({ request }) => {
      const token = await apiUtils.getValidToken();
      
      const promises = Array.from({ length: 10 }, () =>
        request.get('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      );
      
      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
    });
  });
});
