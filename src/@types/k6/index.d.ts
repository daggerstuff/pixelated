/**
 * Type definitions for k6 JavaScript API
 * https://k6.io/docs/javascript-api/
 */

declare module 'k6' {
  export function check(
    obj: unknown,
    checks: Record<string, (obj: unknown) => boolean>,
  ): boolean
  export function sleep(duration: number): void
}

declare module 'k6/data' {
  export function randomString(length: number): string
}

declare module 'k6/http' {
  export interface Response {
    status: number
    body: string
    json<T = unknown>(selector?: string): T
  }

  export interface HttpParams {
    headers?: Record<string, string>
    timeout?: number
    tags?: Record<string, string>
  }

  export function get(url: string, params?: HttpParams): Response
  export function post(url: string, body?: string | object, params?: HttpParams): Response

  const http: {
    get: typeof get
    post: typeof post
  }

  export default http
}

declare module 'k6/metrics' {
  export class Counter {
    constructor(name: string)
    add(value: number): void
  }

  export class Rate {
    constructor(name: string)
    add(value: number): void
  }

  export class Trend {
    constructor(name: string)
    add(value: number): void
  }
}

// Export an empty object from the main module to allow importing
export {}
