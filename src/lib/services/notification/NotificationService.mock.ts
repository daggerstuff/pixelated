import { vi } from 'vitest'

export class NotificationService {
  static getInstance = vi.fn().mockReturnValue({
    sendCrisisAlert: vi.fn(),
    startProcessing: vi.fn(),
  })
  constructor() {
    //
  }
  async sendCrisisAlert() {
    //
  }
  async startProcessing(interval: number) {
    //
  }
}
