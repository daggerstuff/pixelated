// This file provides a minimal 'process' polyfill for the browser
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  window.process = {
    env: {},
    nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
    browser: true,
    cwd: () => '/',
    platform: 'browser',
    version: '',
    versions: {},
  }
}

export default window.process
