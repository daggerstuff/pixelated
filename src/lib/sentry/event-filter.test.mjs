// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  isSyntheticSentryTestEvent,
  sentryEventTitles,
} from '../../../config/sentry-event-filter.mjs'

describe('Sentry event filtering', () => {
  it('extracts message and exception titles from events', () => {
    expect(
      sentryEventTitles({
        message: 'top-level message',
        exception: { values: [{ value: 'exception value' }] },
      }),
    ).toEqual(['top-level message', 'exception value'])
  })

  it('drops synthetic Sentry test events by message title', () => {
    expect(
      isSyntheticSentryTestEvent({
        message: 'Test: KeyError in process_order',
      }),
    ).toBe(true)
  })

  it('drops synthetic Sentry test events by exception value', () => {
    expect(
      isSyntheticSentryTestEvent({
        exception: {
          values: [{ value: 'Test: KeyError in process_order' }],
        },
      }),
    ).toBe(true)
  })

  it('keeps production-looking events', () => {
    expect(
      isSyntheticSentryTestEvent({
        exception: {
          values: [{ value: 'KeyError in process_order' }],
        },
      }),
    ).toBe(false)
  })
})
