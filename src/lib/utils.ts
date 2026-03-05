import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standardized error messages for consistent error handling
 */
export const ERRORS = {
  /** Node environment detection */
  NOT_NODE_ENVIRONMENT: "Not in Node.js environment",

  /** Crypto utilities */
  NODE_CRYPTO_UNAVAILABLE: "Node crypto module not available",
  CRYPTO_UNSUPPORTED:
    "Cryptographically secure random number generation is not supported in this environment. Math.random() fallback has been removed for security. Please run in a secure context (browser with crypto.getRandomValues or Node.js with crypto.randomBytes).",
  BYTES_TO_UINT32BE_SHORT: "bytesToUint32BE: input must have at least 4 bytes",
  INVALID_RANDOM_INT_PARAM: "maxExclusive must be positive integer",

  /** ID generation */
  GENERATE_UNIQUE_ID_UNEXPECTED_BYTE:
    "generateUniqueId: Unexpected undefined byte",
  GENERATE_SHORT_ID_UNEXPECTED_BYTE:
    "generateShortId: Unexpected undefined byte",

  /** Array utilities */
  SPARSE_ARRAY_DETECTED: (index: number) =>
    `Sparse array detected at index ${index}`,
  CANNOT_SHUFFLE_SPARSE_ARRAY:
    "Cannot shuffle sparse arrays: input contains holes.",

  /** Number utilities */
  RANDOM_INT_MIN_MAX: "min must be <= max",
};

// Helper to synchronously require Node modules in Node-only environments without
// triggering static bundlers or TypeScript/ESLint `no-require-imports` errors.
export function tryRequireNode(moduleName: string): unknown | null {
  try {
    if (isNodeEnvironment()) {
      // Use global require if available (Node.js environment)

      const globalRequire = (globalThis as { require?: unknown }).require;
      if (typeof globalRequire === "function") {
        return (globalRequire as (id: string) => unknown)(moduleName);
      }

      // Try to access via global scope
      const module = (globalThis as Record<string, unknown>)[moduleName];
      if (module) return module;
    }
  } catch {
    // ignore failures and return null to trigger fallback logic
  }
  return null;
}

/**
 * Checks if current environment is browser/client-side
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined";
}

/**
 * Checks if current environment is Node.js
 */
function isNodeEnvironment(): boolean {
  return !isBrowserEnvironment() && typeof process !== "undefined";
}

// Use Node crypto via guarded require when available; fallback to runtime checks for browsers
const nodeCrypto: typeof import("crypto") | undefined =
  tryRequireNode("crypto") || undefined;

/**
 * Type guard for checking if value is a non-null object
 */
export function isNonNullObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Gets random bytes using Web Crypto API (browser) or Node.js crypto (server)
 * @param size - Number of bytes to generate
 * @returns Uint8Array of random bytes
 */
export function getRandomBytes(size: number): Uint8Array {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.getRandomValues
  ) {
    // Browser environment - use Web Crypto API
    const bytes = new Uint8Array(size);
    window.crypto.getRandomValues(bytes);
    return bytes;
  } else {
    // Node.js environment
    try {
      const randomBytes = nodeCrypto?.randomBytes;
      if (randomBytes) {
        return new Uint8Array(randomBytes(size));
      }
      throw new Error(ERRORS.NODE_CRYPTO_UNAVAILABLE);
    } catch {
      // No cryptographically secure random available
      throw new Error(ERRORS.CRYPTO_UNSUPPORTED);
    }
  }
}

/**
 * Converts bytes to a 32-bit unsigned integer (big-endian)
 * @param bytes - Byte array (at least 4 bytes)
 * @returns 32-bit unsigned integer
 */
function bytesToUint32BE(bytes: Uint8Array): number {
  if (bytes.length < 4) {
    throw new Error(ERRORS.BYTES_TO_UINT32BE_SHORT);
  }
  return (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!;
}

/**
 * Cryptographically secure random integer in [0, maxExclusive)
 * Uniform even for non-power-of-two upper bounds (no modulo bias).
 * Throws if maxExclusive < 1 or not integer.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
    throw new Error(ERRORS.INVALID_RANDOM_INT_PARAM);
  }
  const maxUint32 = 0xffffffff;
  // Find rejection sampling threshold: only accept random values < rangeLimit
  const rangeLimit = Math.floor(maxUint32 / maxExclusive) * maxExclusive;
  while (true) {
    const bytes = getRandomBytes(4);
    const randUint = bytesToUint32BE(bytes);
    if (randUint < rangeLimit) {
      return randUint % maxExclusive;
    }
    // Otherwise, extremely rare (<<0.5% for small maxExclusive), try again.
  }
}

// ============================================================================
// CLASS NAME UTILITIES
// ============================================================================

/**
 * Combines CSS classes using clsx and tailwind-merge for proper Tailwind class merging
 * @param inputs - Class values to combine
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ============================================================================
// ID GENERATION UTILITIES
// ============================================================================

/**
 * Generates a unique ID using crypto.randomUUID()
 * @returns A unique UUID string
 */
export function generateUniqueId(): string {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.randomUUID
  ) {
    // Browser environment with Web Crypto API
    return window.crypto.randomUUID();
  } else if (
    typeof (globalThis as { crypto?: unknown }).crypto !== "undefined" &&
    typeof (globalThis as { crypto?: { randomUUID?: unknown } }).crypto
      ?.randomUUID === "function"
  ) {
    // Browser or Node.js global crypto (Node 18+ exposes globalThis.crypto)
    return (
      globalThis as { crypto: { randomUUID: () => string } }
    ).crypto.randomUUID();
  } else {
    // Fallback UUID generation
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const bytes = getRandomBytes(1);
        const byte = bytes[0];
        if (byte === undefined) {
          throw new Error(ERRORS.GENERATE_UNIQUE_ID_UNEXPECTED_BYTE);
        }
        const r = byte & 0xf;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}

/**
 * Generates a simple unique ID using timestamp and random number
 * @param prefix - Optional prefix for the ID
 * @returns A unique ID string
 */
export function generateSimpleId(prefix = "id"): string {
  // Use crypto for random value
  const bytes = getRandomBytes(4);
  const randPart = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${prefix}_${Date.now()}_${randPart}`;
}

/**
 * Generates a nanoid-style short ID
 * @param length - Length of the ID (default: 8)
 * @returns A short unique ID
 */
export function generateShortId(length = 8): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  // Secure random index selection, safely guard bytes access
  const bytes = getRandomBytes(length);
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte === undefined) {
      throw new Error(ERRORS.GENERATE_SHORT_ID_UNEXPECTED_BYTE);
    }
    result += chars.charAt(byte % chars.length);
  }
  return result;
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Creates a promise that resolves after the specified delay
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff
 * @param fn - Function to retry
 * @param maxAttempts - Maximum number of attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delayMs = baseDelay * Math.pow(2, attempt - 1);
      await delay(delayMs);
    }
  }

  throw lastError!;
}

/**
 * Creates a debounced version of a function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Creates a throttled version of a function
 * @param fn - Function to throttle
 * @param interval - Interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallTime >= interval) {
      lastCallTime = now;
      fn(...args);
    }
  };
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Chunks an array into smaller arrays of specified size
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Removes duplicates from an array
 * @param array - Array to deduplicate
 * @param keyFn - Optional key function for objects
 * @returns Array without duplicates
 */
export function unique<T>(array: T[], keyFn?: (item: T) => unknown): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }

  const seen = new Set<unknown>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Groups array items by a key function
 * @param array - Array to group
 * @param keyFn - Function that returns the group key
 * @returns Object with grouped items
 */
export function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    },
    {} as Record<K, T[]>,
  );
}

/**
 * Asserts that an array is dense (no holes), otherwise throws.
 * The main value is to type-narrow arr from (T | undefined)[] to T[] for strict TypeScript assignment.
 */
const assertDense: <U>(array: (U | undefined)[]) => asserts array is U[] = <U>(
  array: (U | undefined)[],
): asserts array is U[] => {
  for (let i = 0; i < array.length; ++i) {
    if (!(i in array)) {
      throw new Error(ERRORS.SPARSE_ARRAY_DETECTED(i));
    }
  }
};

/**
 * Returns a shuffled copy of the input using Fisher-Yates and crypto secure random.
 * @param input - The array to shuffle (never mutated)
 * @returns New shuffled array
 */
export function shuffle<T>(input: readonly T[]): T[] {
  if (input.some((_, i, a) => !(i in a))) {
    throw new Error(ERRORS.CANNOT_SHUFFLE_SPARSE_ARRAY);
  }
  // Defensive copy. Still, TS cannot infer runtime density, so we assert.
  const arr = input.map((x) => x);
  assertDense(arr);
  const denseArr = arr as T[]; // TS type-narrow after runtime assertion

  for (let i = denseArr.length - 1; i > 0; i--) {
    // Secure, bias-free random int between 0 and i (inclusive)
    const j = secureRandomInt(i + 1);
    // No need for bounds check: arr is dense (checked above)
    // The preceding assertDense() guarantees no holes, safe to non-null '!'.
    const temp: T = denseArr[i]!;
    denseArr[i] = denseArr[j]!;
    denseArr[j] = temp;
  }
  return denseArr;
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Deep clones an object with performance optimizations
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (isObject(obj)) {
    const clonedObj = {} as T;
    const keys = Object.keys(obj);
    for (const key of keys) {
      clonedObj[key as keyof T] = deepClone(obj[key as keyof T]);
    }
    return clonedObj;
  }

  return obj;
}

/**
 * Checks if an object is empty (no enumerable properties)
 * @param obj - Object to check
 * @returns True if object is empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Safely accesses nested object properties with optional chaining alternative
 * @param obj - Object to access
 * @param path - Path to property (e.g., 'a.b.c')
 * @param defaultValue - Default value if path doesn't exist
 * @returns Value at path or defaultValue
 */
export function getNestedProperty<T>(
  obj: unknown,
  path: string,
  defaultValue: T,
): T {
  if (!isNonNullObject(obj)) {
    return defaultValue;
  }

  // Pre-split path for better performance
  const keys = path.split(".");
  let result: unknown = obj;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (
      !isNonNullObject(result) ||
      !(key in (result as Record<string, unknown>))
    ) {
      return defaultValue;
    }
    result = (result as Record<string, unknown>)[key];
  }

  return result as T;
}

/**
 * Picks specified properties from an object
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns Object with picked properties
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omits specified properties from an object
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns Object without omitted properties
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Converts a string to title case
 * @param str - String to convert
 * @returns Title case string
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Converts a string to kebab-case
 * @param str - String to convert
 * @returns Kebab-case string
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Converts a string to camelCase
 * @param str - String to convert
 * @returns CamelCase string
 */
export function camelCase(str: string): string {
  return str
    .replace(/(^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase(),
    )
    .replace(/\s+/g, "");
}

/**
 * Truncates a string to a specified length
 * @param str - String to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to add if truncated
 * @returns Truncated string
 */
export function truncate(str: string, length: number, suffix = "..."): string {
  if (str.length <= length) {
    return str;
  }
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Removes all whitespace from a string
 * @param str - String to clean
 * @returns String without whitespace
 */
export function removeWhitespace(str: string): string {
  return str.replace(/\s/g, "");
}

// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/**
 * Clamps a number between min and max values
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Checks if a value is within a range (inclusive)
 * @param value - Value to check
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns True if value is in range
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Formats a number with commas as thousands separators
 * @param num - Number to format
 * @returns Formatted string
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Rounds a number to a specified number of decimal places
 * @param num - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Formats a date to a readable string
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
): string {
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Gets the time ago string for a date
 * @param date - Date to compare
 * @returns Time ago string
 */
export function timeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      const pluralSuffix = count === 1 ? "" : "s";
      return `${count} ${interval.label}${pluralSuffix} ago`;
    }
  }

  return "just now";
}

/**
 * Checks if a date is today
 * @param date - Date to check
 * @returns True if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Checks if a date is yesterday
 * @param date - Date to check
 * @returns True if date is yesterday
 */
export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  // Normalize both dates to midnight for accurate comparison
  yesterday.setHours(0, 0, 0, 0);

  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);

  return yesterday.getTime() === compareDate.getTime();
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Checks if a string is a valid email address
 * @param email - Email string to validate
 * @returns True if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if a string is a valid URL
 * @param url - URL string to validate
 * @returns True if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    // The construction of the URL object is the validation.
    // If it doesn't throw, the URL is valid.
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a value is not null or undefined
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Checks if a string is not empty (not null, undefined, or whitespace-only)
 * @param str - String to check
 * @returns True if string is not empty
 */
export function isNotEmpty(str: string | null | undefined): str is string {
  return isDefined(str) && str.trim().length > 0;
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Creates a standardized error object
 * @param message - Error message
 * @param code - Error code
 * @param details - Additional error details
 * @returns Error object
 */
export function createError(
  message: string,
  code?: string,
  details?: Record<string, unknown>,
): Error & { code?: string; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & {
    code?: string;
    details?: Record<string, unknown>;
  };
  if (code !== undefined) {
    error.code = code;
  }
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

/**
 * Safely executes a function and returns a result or error
 * @param fn - Function to execute
 * @returns Result object with success/error state
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
): Promise<{ success: true; data: T } | { success: false; error: Error }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for checking if value is an object
 * @param value - Value to check
 * @returns True if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return isNonNullObject(value) && !Array.isArray(value);
}

/**
 * Type guard for checking if value is an array
 * @param value - Value to check
 * @returns True if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for checking if value is a string
 * @param value - Value to check
 * @returns True if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Type guard for checking if value is a number
 * @param value - Value to check
 * @returns True if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Type guard for checking if value is a boolean
 * @param value - Value to check
 * @returns True if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

// ============================================================================
// STORAGE UTILITIES
// ============================================================================

/**
 * Safely gets an item from localStorage
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist
 * @returns Stored value or default
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (!isBrowserEnvironment()) {
    return defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    return item !== null ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely sets an item in localStorage
 * @param key - Storage key
 * @param value - Value to store
 */
export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if storage is not available
  }
}

/**
 * Safely removes an item from localStorage
 * @param key - Storage key
 */
export function removeStorageItem(key: string): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Silently fail if storage is not available
  }
}

// ============================================================================
// URL UTILITIES
// ============================================================================

/**
 * Builds a URL with query parameters
 * @param baseUrl - Base URL
 * @param params - Query parameters object
 * @returns URL with query parameters
 */
export function buildUrl(
  baseUrl: string,
  params: Record<string, string | number | boolean>,
): string {
  const url = new URL(
    baseUrl,
    isBrowserEnvironment() ? window.location.origin : "http://localhost",
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

/**
 * Parses query parameters from a URL
 * @param url - URL to parse
 * @returns Object with query parameters
 */
export function parseQueryParams(url: string): Record<string, string> {
  const urlObj = new URL(
    url,
    isBrowserEnvironment() ? window.location.origin : "http://localhost",
  );
  const params: Record<string, string> = {};

  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

// ============================================================================
// MISC UTILITIES
// ============================================================================

/**
 * Generates a random integer between min and max (inclusive)
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error(ERRORS.RANDOM_INT_MIN_MAX);
  }
  const range = max - min + 1;
  // Use crypto to get random integer in range
  const randomBuffer = getRandomBytes(4);
  const randUint = bytesToUint32BE(randomBuffer);
  return min + (randUint % range);
}

/**
 * Sleeps for a specified number of milliseconds (alias for delay)
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after sleep
 */
export const sleep = delay;

/**
 * Creates a range of numbers
 * @param start - Start number
 * @param end - End number
 * @param step - Step size
 * @returns Array of numbers in range
 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Gets a random element from an array
 * @param array - Array to pick from
 * @returns Random element
 */
export function randomElement<T>(array: readonly T[]): T | undefined {
  if (array.length === 0) {
    return undefined;
  }
  // Secure, bias-free random index
  const idx = secureRandomInt(array.length);
  return array[idx];
}

/**
 * Creates a memoized version of a function with a simple cache
 * @param fn - Function to memoize
 * @returns Memoized function
 */
export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    // Use faster cache key generation for better performance
    const key = args.length === 1 ? String(args[0]) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
}
