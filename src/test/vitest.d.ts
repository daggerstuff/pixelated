/// <reference types="vitest" />

interface CustomMatchers<R = unknown> {
  toBeInTheDocument(): R
  toHaveAttribute(name: string, value?: string): R
  toHaveClass(...classNames: string[]): R
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {
    // Extending the Vitest Assertion interface with our custom matchers
  }
  interface AsymmetricMatchersContaining extends CustomMatchers {
    // Extending the AsymmetricMatchersContaining interface with our custom matchers
  }
}
