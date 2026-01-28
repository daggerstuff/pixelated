import * as path from "path";

/**
 * Utility functions for the Therapy Chat System
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
 * Secure path validation utility to prevent path traversal attacks
 * @param basePath - The base directory path that should not be escaped
 * @param userPath - The user-provided path segment
 * @param options - Additional validation options
 * @returns The validated and resolved path
 * @throws Error if the path is unsafe or attempts directory traversal
 */
export function securePathJoin(
  basePath: string,
  userPath: string,
  options: {
    allowAbsolute?: boolean;
    allowedExtensions?: string[];
    maxDepth?: number;
  } = {},
): string {
  const {
    allowAbsolute = false,
    allowedExtensions = [],
    maxDepth = 10,
  } = options;

  // Reject absolute paths unless explicitly allowed
  if (!allowAbsolute && path.isAbsolute(userPath)) {
    throw new Error("Absolute paths are not allowed");
  }

  // Reject paths with .. segments (directory traversal)
  if (
    userPath.includes("..") ||
    userPath.includes("../") ||
    userPath.includes("..\\")
  ) {
    throw new Error("Directory traversal sequences (..) are not allowed");
  }

  // Reject paths with unsafe characters (no control characters)
  const unsafeChars = /[<>:"|?*]/; // Windows forbidden chars only
  if (unsafeChars.test(userPath)) {
    throw new Error("Path contains unsafe characters");
  }

  // Check depth limit
  const segments = userPath
    .split(/[/\\]/)
    .filter((segment) => segment.length > 0);
  if (segments.length > maxDepth) {
    throw new Error(`Path depth exceeds maximum allowed depth of ${maxDepth}`);
  }

  // Check file extension allowlist if provided
  if (allowedExtensions.length > 0) {
    const ext = path.extname(userPath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new Error(
        `File extension '${ext}' is not allowed. Allowed extensions: ${allowedExtensions.join(", ")}`,
      );
    }
  }

  // Resolve the path and ensure it stays within the base directory
  const resolvedPath = path.resolve(basePath, userPath);
  const resolvedBase = path.resolve(basePath);

  // Verify the resolved path starts with the base path
  if (
    !resolvedPath.startsWith(resolvedBase + path.sep) &&
    resolvedPath !== resolvedBase
  ) {
    throw new Error(
      "Path traversal detected: resolved path escapes base directory",
    );
  }

  return resolvedPath;
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
