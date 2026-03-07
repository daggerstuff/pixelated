const request = require('supertest')
const app = require('../src/server.prod')

describe('Security Tests', () => {
  describe('Rate Limiting', () => {
    it('should block excessive requests', async () => {
      const promises = []
      for (let i = 0; i < 110; i++) {
        promises.push(request(app).get('/api/health'))
      }
      const responses = await Promise.all(promises)
      const blockedRequests = responses.filter((r) => r.status === 429)
      expect(blockedRequests.length).toBeGreaterThan(0)
    })
  })

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in login', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: "admin@example.com'; DROP TABLE users; --",
        password: 'password',
      })
      expect(response.status).not.toBe(200)
    })
  })

  describe('XSS Prevention', () => {
    it('should sanitize user input', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: '<script>alert("XSS")</script>',
          content: 'Test content',
        })
      expect(response.body.title).not.toContain('<script>')
    })
  })

  describe('CORS Configuration', () => {
    it('should enforce CORS policy', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.com')
      expect(response.headers['access-control-allow-origin']).not.toBe(
        'https://malicious-site.com',
      )
    })
  })

  describe('File Upload Security', () => {
    it('should reject executable files', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('file', Buffer.from('malicious code'), 'malware.exe')
      expect(response.status).toBe(400)
    })
  })
})
