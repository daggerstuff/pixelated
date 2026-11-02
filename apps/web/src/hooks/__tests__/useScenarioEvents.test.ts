// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useScenarioEvents } from '../useScenarioEvents'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState = 0
  onopen: ((e?: unknown) => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: ((e?: unknown) => void) | null = null
  onclose: ((e?: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  close = vi.fn(() => {
    this.readyState = 3
    this.onclose?.()
  })
}

const originalWebSocket = globalThis.WebSocket

describe('useScenarioEvents', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('connects to /sessions/{id}/events', () => {
    const { result } = renderHook(() => useScenarioEvents({ sessionId: 'abc' }))

    const ws = MockWebSocket.instances[0]
    expect(ws.url).toBe('ws://localhost:3000/sessions/abc/events')
    expect(result.current.status).toBe('connecting')

    act(() => ws.onopen?.())
    expect(result.current.status).toBe('connected')
  })

  it('parses event payloads and stores latestEvent', () => {
    const onEvent = vi.fn()
    const { result } = renderHook(() =>
      useScenarioEvents({ sessionId: 'abc', onEvent }),
    )
    const ws = MockWebSocket.instances[0]
    act(() => ws.onopen?.())

    const payload = {
      updated_vitals: { heart_rate: 128, oxygen_saturation: 96 },
      emotional_state: 'distressed',
      branch: 'acute_spike',
    }
    act(() => ws.onmessage?.({ data: JSON.stringify(payload) }))

    expect(result.current.latestEvent).toEqual(payload)
    expect(onEvent).toHaveBeenCalledWith(payload)
  })

  it('accepts the backend vitals_update ServerMessage form', () => {
    const { result } = renderHook(() => useScenarioEvents({ sessionId: 'abc' }))
    const ws = MockWebSocket.instances[0]
    act(() => ws.onopen?.())

    act(() =>
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'vitals_update',
          payload: { vitals: { heart_rate: 110 } },
        }),
      }),
    )

    expect(result.current.latestEvent).toEqual({
      updated_vitals: { heart_rate: 110 },
      emotional_state: undefined,
      branch: undefined,
    })
  })

  it('ignores non-event frames and malformed JSON', () => {
    const onEvent = vi.fn()
    const { result } = renderHook(() =>
      useScenarioEvents({ sessionId: 'abc', onEvent }),
    )
    const ws = MockWebSocket.instances[0]
    act(() => ws.onopen?.())

    act(() => ws.onmessage?.({ data: 'not json' }))
    act(() => ws.onmessage?.({ data: JSON.stringify({ type: 'ping' }) }))

    expect(result.current.latestEvent).toBeNull()
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('reconnects after close with backoff', async () => {
    const { result } = renderHook(() => useScenarioEvents({ sessionId: 'abc' }))
    expect(MockWebSocket.instances).toHaveLength(1)

    act(() => {
      MockWebSocket.instances[0].onclose?.()
    })
    expect(result.current.status).toBe('reconnecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('stops after max reconnect attempts', async () => {
    renderHook(() => useScenarioEvents({ sessionId: 'abc' }))

    for (let attempt = 0; attempt < 6; attempt++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]
      act(() => {
        ws.onclose?.()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16000)
      })
    }

    const { result } = renderHook(() => useScenarioEvents({ sessionId: 'abc' }))
    expect(result.current.status).toBe('connecting')
  })
})
