async function act(callback) {
  const { flushSync } = require('react-dom')
  const invoke = () =>
    typeof flushSync === 'function' ? flushSync(callback) : callback()
  const result = invoke()
  if (result && typeof result.then === 'function') {
    await result
  }

  if (typeof queueMicrotask !== 'undefined') {
    await new Promise((resolve) => {
      queueMicrotask(resolve)
    })
  }
}

const reactModule = require('react')
if (typeof reactModule.act !== 'function') {
  Object.defineProperty(reactModule, 'act', {
    value: act,
    configurable: true,
    writable: true,
    enumerable: false,
  })
}

const reactTestUtils = require('react-dom/test-utils')
if (typeof reactTestUtils.act !== 'function') {
  Object.defineProperty(reactTestUtils, 'act', {
    value: act,
    configurable: true,
    writable: true,
    enumerable: false,
  })
}

module.exports = {
  act,
}
