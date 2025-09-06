import { vi } from 'vitest'

export class WebSocketServer {
  static getInstance = vi.fn().mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
  })
  constructor() {
    //
  }
  start() {
    //
  }
  stop() {
    //
  }
  close() {
    //
  }
}
