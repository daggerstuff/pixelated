/**
 * Polyfill for node:readline module
 */

export function createInterface() {
  return {
    question: (_, cb) => cb(''),
    close: () => {},
    on: () => {},
    once: () => {},
    removeListener: () => {},
    setPrompt: () => {},
    prompt: () => {},
  }
}

export default {
  createInterface,
}
