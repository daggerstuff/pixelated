/**
 * Enhanced Utility Types for Strict TypeScript Configuration
 *
 * This file provides comprehensive utility types that enable stricter
 * type checking and better type safety throughout the application.
 */

// ============================================================================
// STRICT NULLABLE TYPES
// ============================================================================

/** Represents a value that cannot be null or undefined */
export type NonNullable<T> = T extends null | undefined ? never : T

/** Represents a strictly required version of a partial type */
export type StrictRequired<T> = {
  [P in keyof T]-?: NonNullable<T[P]>
}

/** Represents a type where specific keys are required */
export type RequireKeys<T, K extends keyof T> = T & StrictRequired<Pick<T, K>>

/** Represents a type where specific keys are optional */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>

// ============================================================================
// STRICT OBJECT TYPES
// ============================================================================

/** Ensures an object has exact properties (no excess properties) */
export type Exact<T> = T & Record<Exclude<keyof T, keyof T>, never>

/** Creates a readonly version with strict immutability */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/** Creates a mutable version of a readonly type */
export type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P]
}

/** Ensures all properties are defined (no optional properties) */
export type Complete<T> = {
  [P in keyof T]-?: T[P]
}

// ============================================================================
// ARRAY AND TUPLE TYPES
// ============================================================================

/** Represents a non-empty array */
export type NonEmptyArray<T> = [T, ...T[]]

/** Represents a tuple with a specific length */
export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : TupleOf<T, N, []>
  : never

type TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
  ? R
  : TupleOf<T, N, [...R, T]>

/** Represents the head of a tuple */
export type Head<T extends readonly unknown[]> = T extends readonly [
  infer H,
  ...unknown[],
]
  ? H
  : never

/** Represents the tail of a tuple */
export type Tail<T extends readonly unknown[]> = T extends readonly [
  unknown,
  ...infer Rest,
]
  ? Rest
  : []

// ============================================================================
// FUNCTION TYPES
// ============================================================================

/** Represents a function that returns a specific type */
export type Returns<T> = (...args: unknown[]) => T

/** Represents async function types */
export type AsyncFunction<T extends unknown[], R> = (...args: T) => Promise<R>

/** Represents a function with no parameters */
export type NoParamsFunction<R> = () => R

/** Represents a function with exactly one parameter */
export type UnaryFunction<T, R> = (arg: T) => R

/** Represents a function with exactly two parameters */
export type BinaryFunction<T, U, R> = (arg1: T, arg2: U) => R

// ============================================================================
// CONDITIONAL TYPES
// ============================================================================

/** Checks if a type extends another type */
export type Extends<T, U> = T extends U ? true : false

/** Gets the keys of a type that extend a specific type */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never
}[keyof T]

/** Filters object properties by type */
export type FilterByType<T, U> = Pick<T, KeysOfType<T, U>>

/** Omits properties that extend a specific type */
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>

// ============================================================================
// STRING MANIPULATION TYPES
// ============================================================================

// Note: TypeScript provides built-in Uppercase, Lowercase, Capitalize, and Uncapitalize utility types
// These are available globally in TypeScript 4.1+, so we don't need to redefine them here

// If you need custom string manipulation types, define them with different names:
// export type ToUppercase<S extends string> = Uppercase<S>
// export type ToLowercase<S extends string> = Lowercase<S>
// export type ToCapitalize<S extends string> = Capitalize<S>
// export type ToUncapitalize<S extends string> = Uncapitalize<S>

/** Creates a template literal type */
export type Join<
  T extends readonly string[],
  D extends string = ',',
> = T extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : ''

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/** Represents a result that can either be successful or an error */
export type Result<T, E = Error> = Success<T> | Failure<E>

export type Success<T> = {
  success: true
  data: T
  error?: never
}

export type Failure<E> = {
  success: false
  data?: never
  error: E
}

/** Type guard for checking if result is successful */
export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> =>
  result.success === true

/** Type guard for checking if result is a failure */
export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> =>
  result.success === false

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/** Represents a value that has been validated */
export type Validated<T> = T & { readonly __validated: true }

/** Creates a brand type for nominal typing */
export type Brand<T, U> = T & { readonly __brand: U }

/** Creates an opaque type */
export type Opaque<T, K> = T & { readonly __opaque: K }

// ============================================================================
// REACT-SPECIFIC TYPES
// ============================================================================

/** Enhanced component props with strict children typing */
export type StrictComponentProps<T = Record<string, unknown>> = T & {
  'children'?: React.ReactNode
  'className'?: string
  'data-testid'?: string
}

/** Props for components that accept HTML attributes */
export type HTMLProps<T extends HTMLElement = HTMLElement> =
  React.HTMLAttributes<T>

/** Strict event handler types */
export type StrictEventHandler<T extends Element, E extends Event> = (
  event: E & { currentTarget: T },
) => void

// ============================================================================
// API TYPES
// ============================================================================

/** Represents API response structure */
export type ApiResponse<T> = {
  data: T
  success: boolean
  message?: string
  errors?: string[]
  meta?: {
    timestamp: string
    version: string
    requestId: string
  }
}

/** Represents paginated API response */
export type PaginatedResponse<T> = ApiResponse<T[]> & {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ============================================================================
// ENVIRONMENT TYPES
// ============================================================================

/** Represents environment variables with strict typing */
export type EnvironmentVariables = {
  readonly NODE_ENV: 'development' | 'production' | 'test'
  readonly PUBLIC_SITE_URL: string
  readonly DATABASE_URL?: string
  readonly SUPABASE_URL?: string
  readonly SUPABASE_ANON_KEY?: string
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/** Configuration object with strict validation */
export type StrictConfig<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? StrictConfig<T[K]>
    : NonNullable<T[K]>
}

/** Deep partial type for configuration overrides */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// ============================================================================
// TYPE ASSERTION HELPERS
// ============================================================================

/** Asserts that a value is defined (not null or undefined) */
export function assertDefined<T>(
  value: T,
  message?: string,
): asserts value is NonNullable<T> {
  if (value == null) {
    throw new Error(message ?? 'Value is null or undefined')
  }
}

/** Asserts that a value is of a specific type */
export function assertType<T>(
  value: unknown,
  predicate: (value: unknown) => value is T,
): asserts value is T {
  if (!predicate(value)) {
    throw new Error('Type assertion failed')
  }
}

/** Creates a type predicate function */
export function createTypePredicate<T>(predicate: (value: unknown) => boolean) {
  return (value: unknown): value is T => predicate(value)
}
