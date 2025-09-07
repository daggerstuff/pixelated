import type { StorageAPI } from '../types'
import { createClient } from 'redis'

export class RedisStorageAPI implements StorageAPI {
  private client
  private connected = false

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
    })

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    this.client.on('connect', () => {
      this.connected = true
      console.info('Redis Client Connected')
    })

    this.client.on('end', () => {
      this.connected = false
      console.info('Redis Client Disconnected')
    })

    // Connect to Redis
    this.client.connect().catch(console.error)
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis client is not connected')
    }
  }

  async get<T = unknown>(key: string): Promise<T> {
    await this.ensureConnection()
    const value = await this.client.get(key)
    if (value === null) {
      throw new Error(`Key not found: ${key}`)
    }
    return JSON.parse(value) as T
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ensureConnection()
    await this.client.set(key, JSON.stringify(value))
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnection()
    await this.client.del(key)
  }

  async cleanup(): Promise<void> {
    if (this.connected) {
      await this.client.quit()
    }
  }
}
