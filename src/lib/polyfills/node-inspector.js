/**
 * Polyfill for node:inspector module
 */

export function open() {}
export function close() {}
export function url() {
  return null
}
export function waitForDebugger() {}

export const console = {
  markTimeline() {},
  timeline() {},
  timelineEnd() {},
}

export class Session {
  connect() {}
  disconnect() {}
  post() {}
  on() {}
}

export default {
  open,
  close,
  url,
  waitForDebugger,
  console,
  Session,
}
