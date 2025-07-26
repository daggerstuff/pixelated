declare module 'scheduler/tracing' {
  // Define a more specific interface for the tracing object
  interface Tracing {
    __interactionsRef?: object;
    __subscriberRef?: object;
    unstable_clear?: (callback: Function) => unknown;
    unstable_getCurrent?: () => Set<unknown>;
    unstable_getThreadID?: () => number;
    unstable_trace?: (name: string, timestamp: number, callback: Function, ...args: unknown[]) => unknown;
    unstable_wrap?: (callback: Function) => Function;
  }
  
  const tracing: Tracing
  export default tracing
}
