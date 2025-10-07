declare module 'scheduler/tracing' {
  // Define a more specific interface for the tracing object
  interface Tracing {
    __interactionsRef?: object;
    __subscriberRef?: object;
    unstable_clear?: (callback: () => unknown) => unknown;
    unstable_getCurrent?: () => Set<unknown>;
    unstable_getThreadID?: () => number;
    unstable_trace?: (name: string, timestamp: number, callback: (...args: unknown[]) => unknown, ...args: unknown[]) => unknown;
    unstable_wrap?: (callback: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;
  }
  
  const tracing: Tracing
  export default tracing
}
