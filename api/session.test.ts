import request from 'supertest'
import app from '../server'

describe('/api/session', () => {
  it('returns 404 for missing session', async () => {
    const res = await request(app).get('/api/session?id=missing')
    expect(res.status).toBe(404)
  })

  it('creates and retrieves session', async () => {
    const sessionData = {
      id: 'test-id',
      therapist_id: 'therapist-1',
      started_at: new Date().toISOString(),
      state: 'active',
    }
    await request(app).post('/api/session').send(sessionData).expect(201)
    const res = await request(app).get(`/api/session?id=test-id`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('test-id')
  })
})
