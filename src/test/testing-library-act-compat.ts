import { act as reactAct } from './react-compat'

function getGlobalThisRef(): typeof globalThis {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof self !== 'undefined') return self as typeof globalThis
  if (typeof window !== 'undefined') return window as typeof globalThis
  if (typeof global !== 'undefined') return global as typeof globalThis
  throw new Error('unable to locate global object')
}

export function setReactActEnvironment(isReactActEnvironment: boolean) {
  getGlobalThisRef().IS_REACT_ACT_ENVIRONMENT = isReactActEnvironment
}

export function getIsReactActEnvironment() {
  return getGlobalThisRef().IS_REACT_ACT_ENVIRONMENT
}

function withGlobalActEnvironment(
  actImplementation: (callback: () => void | Promise<void>) => Promise<void> | void,
) {
  return (callback: () => void | Promise<void>) => {
    const previousActEnvironment = getIsReactActEnvironment()
    setReactActEnvironment(true)
    try {
      const actResult = actImplementation(callback)
      if (actResult && typeof (actResult as PromiseLike<unknown>).then === 'function') {
        return {
          then: (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) =>
            (actResult as PromiseLike<unknown>).then(
              (returnValue) => {
                setReactActEnvironment(previousActEnvironment)
                resolve(returnValue)
              },
              (error) => {
                setReactActEnvironment(previousActEnvironment)
                reject(error)
              },
            ),
        }
      }

      setReactActEnvironment(previousActEnvironment)
      return actResult
    } catch (error) {
      setReactActEnvironment(previousActEnvironment)
      throw error
    }
  }
}

const act = withGlobalActEnvironment(reactAct)

export default act
