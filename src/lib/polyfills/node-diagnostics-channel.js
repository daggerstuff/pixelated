/**
 * Polyfill for node:diagnostics_channel module
 */

export function channel(_name) {
  return {
    hasSubscribers: false,
    publish: () => false,
    subscribe: () => {},
    unsubscribe: () => {},
  }
}

export function subscribe(_name, _onMessage) {}
export function unsubscribe(_name, _onMessage) {}
export const tracingChannel = channel('tracing')

export default {
  channel,
  subscribe,
  unsubscribe,
  tracingChannel,
}
