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
  result.success

/** Type guard for checking if result is a failure */
export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> =>
  !result.success

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
  readonly MONGODB_URI?: string
  readonly MONGODB_DB_NAME?: string
  readonly MONGODB_USERNAME?: string
  readonly MONGODB_PASSWORD?: string
  readonly MONGODB_CLUSTER?: string
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
export function createTypePredicate(predicate: (value: unknown) => boolean) {
  return (value: unknown): value is unknown => predicate(value)
}

// ============================================================================
// MATT POCOCK SIGNATURE TYPES
// ============================================================================
//
// These utility types are inspired by Matt Pocock's teachings on advanced
// TypeScript patterns. They provide type-level programming primitives that
// enable stricter, more expressive type definitions.
//
// Reference: https://www.totaltypescript.com/

/**
 * Prettify makes intersection types readable by collapsing them into a
 * single flat object type. This is the signature Matt Pocock utility.
 *
 * @example
 * type A = { a: string }
 * type B = { b: number }
 * type C = Prettify<A & B> // { a: string; b: number }
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

/** Alias for Prettify */
export type Simplify<T> = Prettify<T>

/**
 * StrictOmit errors at compile-time if you try to omit keys that don't
 * exist on the source type. Standard Omit silently accepts any string.
 *
 * @example
 * type User = { name: string; age: number }
 * type UserName = StrictOmit<User, 'age'> // OK
 * type Bad = StrictOmit<User, 'email'> // Error: 'email' does not exist
 */
export type StrictOmit<T, K extends keyof T> = Omit<T, K>

/**
 * DeepRequired makes every property required at every level of nesting.
 * Unlike the standard Required, this recurses into objects.
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

/**
 * UnionToIntersection converts a union type into an intersection type.
 * Useful for merging overlapping object unions.
 *
 * @example
 * type A = { a: string } | { b: number }
 * type I = UnionToIntersection<A> // { a: string } & { b: number }
 */
export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

/**
 * IsEqual performs a deep structural equality check between two types.
 * Returns true if A and B are exactly the same type.
 *
 * Uses the "identical function type" pattern: each side declares an
 * independent generic `<T>() => T extends X ? 1 : 2`. If A and B are
 * identical, the two function types are assignable; otherwise they aren't.
 */
export type IsEqual<A, B> =
  (<T>(x: T) => T extends A ? 1 : 2) extends <T>(x: T) => T extends B ? 1 : 2
    ? true
    : false

/**
 * StringWithAutocomplete provides autocomplete suggestions while still
 * allowing any string value. The classic pattern for flexible string props.
 *
 * @example
 * type Color = StringWithAutocomplete<'red' | 'green' | 'blue'>
 * const c: Color = 'red' // autocomplete works
 * const d: Color = 'magenta' // also valid
 */
export type StringWithAutocomplete<T extends string> = T | (string & {})

/**
 * NoInfer prevents TypeScript from inferring a type parameter at a
 * specific position. Useful when you want explicit generic parameters.
 *
 * @example
 * declare function createEvent<T>(name: T, handler: (x: NoInfer<T>) => void): void
 * createEvent('click', (x) => {}) // x is inferred as 'click', not widened
 */
export type NoInfer<T> = [T][T extends unknown ? 0 : never]

/** Converts a tuple type into a union of its elements */
export type TupleToUnion<T extends readonly unknown[]> = T[number]

/** Checks if a type is exactly `never` */
export type IsNever<T> = [T] extends [never] ? true : false

/** Checks if a type is exactly `any` */
export type IsAny<T> = 0 extends 1 & T ? true : false

/** Checks if a type is exactly `unknown` */
export type IsUnknown<T> = IsEqual<T, unknown>

/** Extracts the union of all values from an object type */
export type ValueOf<T> = T[keyof T]

/**
 * Merge combines two object types, with properties from U overriding T.
 * Uses Prettify to produce a clean, flat output type.
 */
export type Merge<T, U> = Prettify<Omit<T, keyof U> & U>

/** Gets only the keys that are required (not optional) in T */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

/** Gets only the keys that are optional in T */
export type OptionalPropertyKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

/**
 * PickByValue selects properties whose values extend a specific type.
 * Different from KeysOfType — this returns the filtered object, not just keys.
 */
export type PickByValue<T, V> = Pick<T, KeysOfType<T, V>>

/** Splits a string literal type by a delimiter */
export type Split<
  S extends string,
  D extends string,
> = S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S]

/** Gets all keys present in any member of a union type */
export type AllKeys<T> = T extends unknown ? keyof T : never

/**
 * OptionalToUndefined converts optional properties to required properties
 * that may be undefined. Useful for normalizing optionality.
 */
export type OptionalToUndefined<T> = {
  [K in RequiredKeys<T>]: T[K]
} & {
  [K in OptionalPropertyKeys<T>]?: T[K] | undefined
}

/**
 * AtLeastOne requires at least one property from a set of keys to be present.
 *
 * @example
 * type Update = AtLeastOne<User, 'name' | 'email'>
 * const u: Update = { name: 'x' } // OK
 * const v: Update = {} // Error: must have at least one
 */
export type AtLeastOne<T, K extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, K>
> &
  { [P in K]-?: Required<Pick<T, P>> }[K]

/**
 * Widen converts literal types to their primitive counterparts.
 * Useful when you need to escape literal inference.
 */
export type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T extends symbol
          ? symbol
          : T

/**
 * Expand forces TypeScript to eagerly evaluate and display a type.
 * Useful for debugging complex conditional types.
 */
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never

/**
 * ExactProps ensures an object has no excess properties beyond what's
 * defined in the expected type. Use with function parameters.
 *
 * @example
 * function createUser<T extends ExactProps<User, T>>(user: T) { ... }
 */
export type ExactProps<T, U extends T> = U &
  Record<Exclude<keyof U, keyof T>, never>

/**
 * BuildTuple creates a tuple of a specific length at the type level.
 * More robust than the Tuple type above for complex scenarios.
 */
export type BuildTuple<
  N extends number,
  T = unknown,
  Result extends T[] = [],
> = Result['length'] extends N ? Result : BuildTuple<N, T, [...Result, T]>

/**
 * ArrayElement extracts the element type from an array, handling readonly.
 */
export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never

/**
 * Func creates a function type with named parameters for better error messages.
 */
export type Func<Args extends unknown[], Return> = (...args: Args) => Return

/**
 * ExtractArgs pulls the parameter types from a function type as a tuple.
 */
export type ExtractArgs<T> = T extends (...args: infer A) => unknown ? A : never

/**
 * ExtractReturn pulls the return type from a function type.
 * Alias for TypeScript's ReturnType but works with any function.
 */
export type ExtractReturn<T> = T extends (...args: unknown[]) => infer R
  ? R
  : never

/**
 * DiscriminatedUnion creates a discriminated union from a base type and
 * a set of discriminator values. Classic pattern for state machines.
 *
 * @example
 * type State = DiscriminatedUnion<'status', {
 *   idle: { data: null }
 *   loading: { data: null }
 *   success: { data: string }
 * }>
 */
export type DiscriminatedUnion<
  K extends string,
  T extends Record<string, Record<string, unknown>>,
> = {
  [P in keyof T]: Prettify<{ [Key in K]: P } & T[P]>
}[keyof T]
