import * as ReactNS from '../../node_modules/react/index.js'

const fallbackAct = async (callback: () => void | Promise<void>) => {
  const result = callback()
  if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
    await result
  }
}

export const act =
  typeof (ReactNS as { act?: unknown }).act === 'function'
    ? ((ReactNS as { act: typeof fallbackAct }).act)
    : fallbackAct

export * from '../../node_modules/react/index.js'
export default {
  ...ReactNS,
  act,
}
