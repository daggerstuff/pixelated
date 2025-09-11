import request from 'supertest'
import app from '../server'

describe('/api/evaluation', () => {
  it('returns empty for missing session', async () => {
    const res = await request(app).get('/api/evaluation?sessionId=missing')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('stores and retrieves feedback', async () => {
    const feedback = 'Excellent session.'
    await request(app)
      .post('/api/evaluation')
      .send({ sessionId: 'test-session', feedback })
      .expect(201)
    const res = await request(app).get('/api/evaluation?sessionId=test-session')
    expect(res.status).toBe(200)
    expect(res.body[0].feedback).toBe(feedback)
  })
})
