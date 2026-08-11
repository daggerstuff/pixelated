import type { FormatOptions } from './formatters.js'
import { formatAgentResponse } from './formatters.js'

export function formatInteractiveResponse(data: unknown, opts?: FormatOptions): string {
  return formatAgentResponse(data, opts ?? {})
}

export function formatAsyncResponse(taskId: string, channel?: string): string {
  const ch = channel ?? '#slack-channel'
  return `Queued — task ${taskId}\nResults will be posted to ${ch}`
}

export function formatJsonResponse(data: unknown): string {
  return JSON.stringify(data, null, 2)
}
