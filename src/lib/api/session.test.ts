import { describe, it, expect } from 'vitest'
import { GET, POST } from './session'

describe('API /session', () => {
  it('returns 404 for missing session', async () => {
    const response = await GET({ request: { query: { id: 'missing' } } })
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  it('creates and retrieves session', async () => {
    const sessionData = {
      id: 'test-id',
      therapist_id: 'therapist-1',
      started_at: new Date().toISOString(),
      state: 'active',
    }
    // POST
    const postResponse = await POST({ request: { body: sessionData } })
    expect(postResponse.status).toBe(201)
    const postData = await postResponse.json()
    expect(postData).toMatchObject({ ...sessionData, saved: true })
    // GET
    const getResponse = await GET({ request: { query: { id: 'test-id' } } })
    expect(getResponse.status).toBe(200)
    const getData = await getResponse.json()
    expect(getData).toMatchObject(sessionData)
  })
})
