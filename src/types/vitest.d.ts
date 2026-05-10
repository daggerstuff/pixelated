export {}

declare namespace VitestCompat {
  type MockCall<TArgs extends readonly any[] = readonly any[]> = TArgs
  type MockReturn<TFn> = TFn extends (...args: never[]) => Promise<infer R>
    ? R | undefined
    : TFn extends (...args: never[]) => infer R
      ? R
      : unknown
  type MockFunction<
    T extends (...args: any[]) => any = (...args: any[]) => any,
  > = T & {
    mock: {
      calls: Parameters<T>[]
      instances: unknown[]
      results: Array<{ value: MockReturn<T> }>
    }
    mockClear: () => MockFunction<T>
    mockReset: () => MockFunction<T>
    mockRestore: () => void
    mockImplementation: (
      fn: (...args: Parameters<T>) => ReturnType<T>,
    ) => MockFunction<T>
    mockImplementationOnce: (
      fn: (...args: Parameters<T>) => ReturnType<T>,
    ) => MockFunction<T>
    mockReturnThis: () => MockFunction<T>
    mockReturnValue: (value: ReturnType<T>) => MockFunction<T>
    mockReturnValueOnce: (value: ReturnType<T>) => MockFunction<T>
    mockResolvedValue: (value: Awaited<ReturnType<T>>) => MockFunction<T>
    mockResolvedValueOnce: (value: Awaited<ReturnType<T>>) => MockFunction<T>
    mockRejectedValue: (value: unknown) => MockFunction<T>
    mockRejectedValueOnce: (value: unknown) => MockFunction<T>
    mockName: (name: string) => MockFunction<T>
  }
  type Matcher = {
    toHaveBeenCalled: () => void
    toHaveBeenCalledTimes: (value: number) => void
    toHaveBeenCalledWith: (...args: unknown[]) => void
    toHaveBeenCalledOnce: () => void
    toBeCalled: () => void
    toBeCalledTimes: (value: number) => void
    toBeCalledWith: (...args: unknown[]) => void
    toHaveBeenCalledOnceWith: (...args: unknown[]) => void
    toBe: (value: unknown) => void
    toEqual: (value: unknown) => void
    toBeDefined: () => void
    toBeUndefined: () => void
    toBeTruthy: () => void
    toThrow: () => void
    not: {
      toHaveBeenCalled: () => void
      toBeCalled: () => void
      toBeTruthy: () => void
      toThrow: () => void
      toHaveBeenCalledWith: (...args: unknown[]) => void
    }
    resolves: {
      toBe: (value: unknown) => void
      toEqual: (value: unknown) => void
      toBeDefined: () => void
      toThrow: () => void
      not: {
        toThrow: () => void
      }
    }
    rejects: {
      toBe: (value: unknown) => void
      toEqual: (value: unknown) => void
      toBeDefined: () => void
      not: {
        toThrow: () => void
      }
    }
  }
}

type VitestTestFn = () => void | Promise<void>

declare global {
  const vi: {
    fn: <T extends (...args: any[]) => any>(
      fn?: T,
    ) => VitestCompat.MockFunction<T>
    mock: (id: string, factory?: () => unknown) => void
    mocked: <T>(value: T) => T
    clearAllMocks: () => void
    restoreAllMocks: () => void
    spyOn: <T extends object, K extends keyof T>(
      obj: T,
      method: K,
    ) => VitestCompat.MockFunction<
      T[K] extends (...args: any[]) => any ? T[K] : (...args: any[]) => any
    >
    mockResolvedValue: (
      value: unknown,
    ) => VitestCompat.MockFunction<(...args: any[]) => Promise<unknown>>
    mockRejectedValue: (
      value: unknown,
    ) => VitestCompat.MockFunction<(...args: any[]) => Promise<never>>
  }
  const describe: (title: string, callback: VitestTestFn) => void
  const it: (title: string, callback: VitestTestFn) => void
  const test: (title: string, callback: VitestTestFn) => void
  const beforeEach: (callback: VitestTestFn) => void
  const afterEach: (callback: VitestTestFn) => void
  const beforeAll: (callback: VitestTestFn) => void
  const afterAll: (callback: VitestTestFn) => void
  const expect: {
    (value: unknown): VitestCompat.Matcher
    any: (constructor: new (...args: unknown[]) => unknown) => unknown
  }
}
