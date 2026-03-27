import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebSocket } from 'ws'

const parseWsMessage = (data: unknown) => JSON.parse(String(data))

vi.mock('ws', () => {
  return vi.importActual('ws')
})

vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('WebSocket /api/websocket/pixel-multimodal', () => {
  let wsPort = 8091

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          try {
            expect(ws.readyState).toBe(WebSocket.OPEN)
            ws.close()
          } catch (error) {
            fail(error)
          }
        })
        ws.once('close', () => resolve())
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })

    it('should send connection status on open', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        let receivedStatus = false
        let receivedMessage = false
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.on('message', (data) => {
            try {
              const message = parseWsMessage(data)
              if (message.type === 'status' && message.status === 'connected') {
                receivedStatus = true
              } else if (message.type === 'status' && message.status === 'text_received') {
                receivedMessage = true
                ws.close()
                expect(receivedStatus).toBe(true)
                resolve() // Move resolve() inside the try-catch block
              }
            } catch (error) {
              fail(error)
            }
          })
        })
        ws.once('close', () => {
          if (!receivedMessage) {
            fail(new Error('No result message received'))
          }
        })
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })

    // ... rest of the file remains the same ...