import * as ReactNS from '../../node_modules/react/index.js'

const fallbackAct = async (callback: () => void | Promise<void>) => {
  const result = callback()
  if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
    await result
  }
}

const resolvedAct =
  typeof (ReactNS as { act?: unknown }).act === 'function'
    ? (ReactNS as { act: typeof fallbackAct }).act
    : fallbackAct

const reactNamespace = ReactNS as Record<string, unknown>
if (typeof reactNamespace.act !== 'function') {
  Object.defineProperty(reactNamespace, 'act', {
    value: resolvedAct,
    configurable: true,
    writable: true,
    enumerable: false,
  })
}

export const act = resolvedAct

export * from '../../node_modules/react/index.js'
export default {
  ...ReactNS,
  act: resolvedAct,
}
