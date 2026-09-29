// @vitest-environment node

import type { Event } from '@sentry/astro'
import { describe, expect, it } from 'vitest'

import { beforeSend, isLocalDevServerEvent, isLoopbackHostname } from './config'

const makeEvent = (partial: Event = {}): Event => ({
  level: 'error',
  ...partial,
})

describe('isLoopbackHostname', () => {
  it('matches loopback hostnames', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isLoopbackHostname('LocalHost')).toBe(true)
  })

  it('rejects non-loopback hostnames and undefined', () => {
    expect(isLoopbackHostname('pixelatedempathy.tech')).toBe(false)
    expect(isLoopbackHostname('192.168.1.10')).toBe(false)
    expect(isLoopbackHostname(undefined)).toBe(false)
  })
})

describe('isLocalDevServerEvent', () => {
  it('detects the PIXEL-ASTRO-D event shape (request.url on 127.0.0.1)', () => {
    expect(
      isLocalDevServerEvent(
        makeEvent({ request: { url: 'http://127.0.0.1:5173/' } }),
      ),
    ).toBe(true)
  })

  it('detects localhost and IPv6 loopback request URLs', () => {
    expect(
      isLocalDevServerEvent(
        makeEvent({ request: { url: 'http://localhost:4321/foo' } }),
      ),
    ).toBe(true)
    expect(
      isLocalDevServerEvent(
        makeEvent({ request: { url: 'http://[::1]:5173/' } }),
      ),
    ).toBe(true)
  })

  it('falls back to the url tag when request data is absent', () => {
    expect(
      isLocalDevServerEvent(
        makeEvent({ tags: { url: 'http://127.0.0.1:5173/' } }),
      ),
    ).toBe(true)
  })

  it('keeps external production requests', () => {
    expect(
      isLocalDevServerEvent(
        makeEvent({ request: { url: 'https://pixelatedempathy.tech/' } }),
      ),
    ).toBe(false)
  })

  it('keeps events without any request information', () => {
    expect(isLocalDevServerEvent(makeEvent())).toBe(false)
  })

  it('ignores malformed URLs instead of throwing', () => {
    expect(
      isLocalDevServerEvent(
        makeEvent({
          request: { url: 'not a url' },
          tags: { url: 'https://example.com/' },
        }),
      ),
    ).toBe(false)
    expect(
      isLocalDevServerEvent(
        makeEvent({
          request: { url: 'not a url' },
          tags: { url: 'http://localhost:5173/' },
        }),
      ),
    ).toBe(true)
  })
})

describe('beforeSend (server-side, no window)', () => {
  it('drops events from the local Vite dev server', () => {
    const event = makeEvent({
      request: { url: 'http://127.0.0.1:5173/' },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'transport invoke timed out after 60000ms',
          },
        ],
      },
    })
    expect(beforeSend(event)).toBeNull()
  })

  it('keeps events from external requests', () => {
    const event = makeEvent({
      request: { url: 'https://pixelatedempathy.tech/' },
    })
    expect(beforeSend(event)).toBe(event)
  })

  it('keeps events without request data', () => {
    const event = makeEvent()
    expect(beforeSend(event)).toBe(event)
  })

  it('still drops synthetic Test: events', () => {
    const event = makeEvent({
      message: 'Test: synthetic smoke test',
      request: { url: 'https://pixelatedempathy.tech/' },
    })
    expect(beforeSend(event)).toBeNull()
  })
})
