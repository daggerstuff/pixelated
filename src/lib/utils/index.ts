/**
 * Utility functions for the Therapy Chat System
 * Shared between client and server.
 */

/**
 * Generate a unique ID string
 * @returns A unique ID string
 */
export function generateId(): string {
  return `id_${Math.random()
    .toString(36)
    .substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Creates a memoized version of a function that caches its results
 * @param fn Function to memoize
 * @returns Memoized function with same signature
 */
export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Validate a filename for security (allowlist approach)
 * @param filename - The filename to validate
 * @param allowedPattern - Regex pattern for allowed filenames
 * @returns The validated filename
 * @throws Error if the filename doesn't match the allowed pattern
 */
export function validateFilename(
  filename: string,
  allowedPattern: RegExp = /^[a-zA-Z0-9._-]+$/,
): string {
  if (!allowedPattern.test(filename)) {
    throw new Error("Filename contains invalid characters");
  }

  // Additional checks for common attack vectors
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new Error("Filename contains path traversal sequences");
  }

  return filename;
}

/**
 * Tries to require a module safely, returning null if not available or if require is not defined.
 * Useful for optional Node.js dependencies in shared code.
 */
export function tryRequireNode(id: string): unknown {
  try {
    const maybeRequire = (globalThis as unknown as Record<string, unknown>)[
      "require"
    ] as ((m: string) => unknown) | undefined;
    if (typeof maybeRequire === "function") {
      return maybeRequire(id);
    }
  } catch {
    // Ignore errors
  }
  return null;
}
