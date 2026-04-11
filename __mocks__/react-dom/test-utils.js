import * as React from 'react'

/**
 * @param {() => void | Promise<unknown>} callback
 */
const fallbackAct = async (callback) => {
  const result = callback()
  if (result && typeof result.then === 'function') {
    await result
  }
}

export const act =
  typeof React.act === 'function'
    ? React.act.bind(React)
    : fallbackAct

export default {
  act,
}
