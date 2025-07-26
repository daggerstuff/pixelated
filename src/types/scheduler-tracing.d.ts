declare module 'scheduler/tracing' {
  export interface Interaction {
    readonly id: number;
    readonly name: string;
    readonly timestamp: number;
    readonly tags?: Set<string>;
  }
}
