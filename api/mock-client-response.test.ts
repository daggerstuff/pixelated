import request from 'supertest'
import app from '../server'

describe('/api/mock-client-response', () => {
  it('returns error for missing message', async () => {
    const res = await request(app).post('/api/mock-client-response').send({})
    expect(res.status).toBe(400)
  })

  it('returns mock response for message', async () => {
    const res = await request(app)
      .post('/api/mock-client-response')
      .send({ message: 'Hello' })
    expect(res.status).toBe(200)
    expect(res.body.response).toMatch(/Mock client says: Hello/)
  })
})
